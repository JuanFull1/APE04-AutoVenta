
"""Caso de uso de creación, conciliación y notificación de ventas."""

import hashlib
import json
import logging
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.db import SessionLocal
from app.models import Venta, Comprador
from app.repositories.venta_repository import VentaRepository
from app.clients.vehiculos_client import (
    VehiculosClient,
    FalloRemoto
)
from app.services.rabbitmq_publisher import (
    publicar_evento_venta
)
from app.errors import ApiError
from app.security import propietario


remote = VehiculosClient()
logger = logging.getLogger(__name__)


# ============================================================
# RESPUESTA PÚBLICA
# ============================================================

def salida(v):
    """Devuelve los datos públicos de una venta."""

    return {
        "id": v.id,
        "operacionId": v.operacion_id,
        "vehiculoId": v.vehiculo_id,
        "compradorId": v.comprador_id,
        "precioAcordado": (
            str(v.precio_acordado)
            if v.precio_acordado is not None
            else None
        ),
        "moneda": v.moneda,
        "estado": v.estado,
        "notificacion": v.notificacion,
        "fechaUTC": (
            v.fecha.isoformat() + "Z"
            if v.fecha is not None
            else None
        )
    }


# ============================================================
# CREACIÓN DE VENTAS
# ============================================================

def crear(datos, clave, usuario):
    """
    Registra una operación idempotente.

    La venta se confirma primero mediante Java.
    Solo las ventas COMPLETADAS pueden generar eventos.
    """

    cuerpo = json.dumps(
        datos.model_dump(),
        sort_keys=True,
        separators=(",", ":")
    )

    huella = hashlib.sha256(
        cuerpo.encode("utf-8")
    ).hexdigest()

    nueva = False

    with SessionLocal() as db:
        repo = VentaRepository(db)

        # Busca una operación anterior con la misma clave.
        v = repo.por_clave(
            usuario["usuario"],
            clave
        )

        if v is None:
            comprador = db.get(
                Comprador,
                datos.compradorId
            )

            if comprador is None:
                raise ApiError(
                    404,
                    "COMPRADOR_NO_EXISTE",
                    "Comprador inexistente"
                )

            # Respeta el control de propietario.
            propietario(
                usuario,
                comprador.usuario
            )

            # Registra una operación nueva.
            v = Venta(
                operacion_id=str(uuid4()),
                usuario=usuario["usuario"],
                vehiculo_id=datos.vehiculoId,
                comprador_id=datos.compradorId,
                idempotency_key=clave,
                request_hash=huella
            )

            db.add(v)

            try:
                # Registra la operación local antes
                # de intentar la reserva en Java.
                db.commit()
                nueva = True

            except IntegrityError:
                # Recupera una carrera de idempotencia.
                db.rollback()

                v = repo.por_clave(
                    usuario["usuario"],
                    clave
                )

                if v is None:
                    raise

        # La misma clave debe conservar el mismo cuerpo.
        if v.request_hash != huella:
            raise ApiError(
                409,
                "CLAVE_REUTILIZADA",
                "La misma clave requiere el mismo cuerpo"
            )

        venta_id = v.id

    # Confirma o concilia la operación con Java.
    procesar(venta_id)

    # Publica un evento únicamente si está COMPLETADA.
    notificar(venta_id)

    # Recupera el resultado real desde MySQL.
    with SessionLocal() as db:
        v = db.get(Venta, venta_id)

        if v.estado == "FALLIDA":
            raise ApiError(
                v.error_status or 409,
                "VENTA_RECHAZADA",
                v.error_detalle or "La venta fue rechazada"
            )

        if v.estado == "COMPLETADA":
            status = 201 if nueva else 200
        else:
            status = 202

        return salida(v), status


# ============================================================
# CONFIRMACIÓN DE VENTA CON JAVA
# ============================================================

def procesar(id):
    """
    Consulta, reserva y confirma el vehículo en Java.

    Conserva los estados:
    PENDIENTE, EN_REVISION, COMPLETADA y FALLIDA.
    """

    with SessionLocal.begin() as db:
        v = VentaRepository(db).bloquear(id)

        if v is None:
            return

        if v.estado in (
            "COMPLETADA",
            "FALLIDA"
        ):
            return

        try:
            # Primero consulta si Java ya conoce
            # el UUID de la operación.
            try:
                r = remote.por_operacion(
                    v.operacion_id
                )

            except FalloRemoto as ex:
                if ex.status != 404:
                    raise

                # Solo reserva cuando Java confirma
                # que la operación no existe.
                try:
                    r = remote.reservar(
                        v.vehiculo_id,
                        v.operacion_id
                    )

                except FalloRemoto as rechazo:
                    if rechazo.status in (
                        404,
                        409,
                        422
                    ):
                        v.estado = "FALLIDA"
                        v.error_status = rechazo.status
                        v.error_detalle = (
                            "Vehículo inexistente "
                            "o no disponible"
                        )
                        return

                    raise

            # Conserva la información oficial
            # obtenida del servicio Java.
            v.reserva_id = r["id"]

            v.precio_acordado = Decimal(
                str(r["precio"])
            )

            v.moneda = r["moneda"]

            if r["estado"] == "LIBERADA":
                v.estado = "FALLIDA"
                v.error_status = 409
                v.error_detalle = "Reserva liberada"
                return

            if r["estado"] == "RESERVADA":
                r = remote.confirmar(
                    r["id"]
                )

            if r["estado"] != "CONFIRMADA":
                raise FalloRemoto(
                    502,
                    "Estado de reserva inesperado"
                )

            # La operación solo se completa después
            # de recibir CONFIRMADA desde Java.
            v.estado = "COMPLETADA"
            v.error_status = None
            v.error_detalle = None

        except (
            FalloRemoto,
            ValueError,
            KeyError
        ):
            # No se crea un evento de venta completada
            # cuando la confirmación sigue siendo incierta.
            v.estado = "EN_REVISION"
            v.error_detalle = (
                "Pendiente de consultar "
                "y conciliar con Java"
            )


# ============================================================
# PUBLICACIÓN DEL EVENTO EN RABBITMQ
# ============================================================

def notificar(id):
    """
    Publica el evento VENTA_REALIZADA.

    ENVIADA significa que RabbitMQ confirmó
    la recepción del evento.

    PENDIENTE permite reintentos mediante worker.py.
    """

    with SessionLocal.begin() as db:
        repo = VentaRepository(db)

        # Bloquea la venta para coordinar el envío
        # entre las peticiones y el trabajador.
        v = repo.bloquear(id)

        if v is None:
            return

        # No notifica operaciones inconclusas
        # ni ventas rechazadas.
        if v.estado != "COMPLETADA":
            return

        # Una operación ya publicada no vuelve
        # a publicarse durante reintentos normales.
        if v.notificacion == "ENVIADA":
            return

        # El UUID existente será el identificador
        # estable del evento para el consumidor.
        evento = {
            "evento": "VENTA_REALIZADA",
            "eventoId": v.operacion_id,
            "tipo": "VENTA",
            "ventaId": v.id,
            "operacionId": v.operacion_id,
            "vehiculoId": v.vehiculo_id,
            "compradorId": v.comprador_id,
            "destinatario": v.comprador.correo,
            "precioAcordado": (
                str(v.precio_acordado)
                if v.precio_acordado is not None
                else None
            ),
            "moneda": v.moneda,
            "estado": v.estado,
            "fechaUTC": (
                v.fecha.isoformat() + "Z"
                if v.fecha is not None
                else None
            ),
            "mensaje": (
                f"Venta {v.id} "
                f"operación {v.operacion_id} completada"
            )
        }

        # Realiza la publicación y espera confirmación
        # del broker RabbitMQ.
        confirmado = publicar_evento_venta(evento)

        if confirmado:
            v.notificacion = "ENVIADA"

        else:
            # La venta sigue COMPLETADA:
            # solamente falta publicar el evento.
            v.notificacion = "PENDIENTE"

            logger.warning(
                "Notificación pendiente de RabbitMQ "
                "para la venta %s",
                v.id
            )
