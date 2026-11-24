
"""Endpoints REST de compradores y ventas."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Venta, Comprador
from app.schemas import CrearVenta, CrearComprador
from app.security import identidad, vendedor, propietario
from app.errors import ApiError
from app.services import venta_service as service


router = APIRouter(prefix="/api")


def autorizar_consulta(usuario):
    """Autoriza los roles de consulta del sistema."""
    roles_permitidos = {
        "ROLE_CONSULTA",
        "ROLE_OPERADOR",
        "ROLE_ADMIN",
    }

    if not roles_permitidos.intersection(usuario["roles"]):
        raise ApiError(
            403,
            "SIN_PERMISO",
            "No tiene permisos para consultar registros",
        )


# --------------------------------------------------
# COMPRADORES
# --------------------------------------------------

@router.post("/compradores", status_code=201)
def crear_comprador(
    d: CrearComprador,
    u=Depends(identidad),
):
    vendedor(u)

    with SessionLocal.begin() as db:
        c = Comprador(
            usuario=u["usuario"],
            **d.model_dump(),
        )

        db.add(c)
        db.flush()

        return {
            "id": c.id,
            "nombre": c.nombre,
            "correo": c.correo,
        }


@router.get("/compradores")
def listar_compradores(u=Depends(identidad)):
    """Lista compradores autorizados desde MySQL."""
    autorizar_consulta(u)

    with SessionLocal() as db:
        consulta = select(Comprador)

        # ADMIN consulta todos los compradores.
        # Los demás roles consultan sus propios registros.
        if "ROLE_ADMIN" not in u["roles"]:
            consulta = consulta.where(
                Comprador.usuario == u["usuario"]
            )

        compradores = db.scalars(
            consulta.order_by(Comprador.id)
        ).all()

        return [
            {
                "id": c.id,
                "documento": c.documento,
                "nombre": c.nombre,
                "correo": c.correo,
            }
            for c in compradores
        ]


# --------------------------------------------------
# VENTAS
# --------------------------------------------------

@router.post("/ventas")
def crear(
    d: CrearVenta,
    response: Response,
    idempotency_key: Annotated[
        str,
        Header(
            min_length=8,
            max_length=100,
            pattern=r"^[A-Za-z0-9_-]+$",
        ),
    ],
    u=Depends(identidad),
):
    vendedor(u)

    resultado, codigo = service.crear(
        d,
        idempotency_key,
        u,
    )

    response.status_code = codigo
    response.headers["Location"] = (
        f"/api/ventas/{resultado['id']}"
    )

    return resultado


@router.get("/ventas")
def listar_ventas(u=Depends(identidad)):
    """Consulta ventas reales registradas en MySQL."""
    autorizar_consulta(u)

    with SessionLocal() as db:
        consulta = select(Venta)

        # ADMIN consulta todas las ventas.
        # Los demás roles consultan las propias.
        if "ROLE_ADMIN" not in u["roles"]:
            consulta = consulta.where(
                Venta.usuario == u["usuario"]
            )

        ventas = db.scalars(
            consulta.order_by(Venta.id.desc())
        ).all()

        return [
            service.salida(v)
            for v in ventas
        ]


@router.get("/ventas/{id}")
def obtener(
    id: int,
    u=Depends(identidad),
):
    with SessionLocal() as db:
        v = db.get(Venta, id)

        if v is None:
            raise ApiError(
                404,
                "VENTA_NO_EXISTE",
                "Venta inexistente",
            )

        propietario(u, v.usuario)

        return service.salida(v)
