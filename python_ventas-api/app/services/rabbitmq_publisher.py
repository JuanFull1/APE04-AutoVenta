
"""Publicación de eventos de ventas mediante RabbitMQ."""

import json
import logging
import os
from datetime import datetime, timezone

import pika
from dotenv import load_dotenv


# Lee el archivo .env del proyecto.
load_dotenv()

logger = logging.getLogger(__name__)


def publicar_evento_venta(evento: dict) -> bool:
    """
    Publica VENTA_REALIZADA en una cola durable.

    Devuelve True cuando RabbitMQ confirma la publicación.
    Devuelve False cuando no es posible confirmarla.
    """

    cola = os.getenv(
        "RABBITMQ_QUEUE",
        "notificaciones.ventas"
    )

    host = os.getenv(
        "RABBITMQ_HOST",
        "127.0.0.1"
    )

    usuario = os.getenv(
        "RABBITMQ_USER",
        "ape04"
    )

    contrasena = os.getenv("RABBITMQ_PASSWORD", "")

    if not contrasena:
        logger.error(
            "RabbitMQ: falta configurar RABBITMQ_PASSWORD."
        )
        return False

    conexion = None

    try:
        puerto = int(
            os.getenv("RABBITMQ_PORT", "5679")
        )

        credenciales = pika.PlainCredentials(
            usuario,
            contrasena
        )

        parametros = pika.ConnectionParameters(
            host=host,
            port=puerto,
            virtual_host=os.getenv(
                "RABBITMQ_VHOST",
                "/"
            ),
            credentials=credenciales,
            heartbeat=30,
            socket_timeout=5,
            blocked_connection_timeout=5,
            connection_attempts=1
        )

        # Conecta con RabbitMQ.
        conexion = pika.BlockingConnection(parametros)

        # Abre un canal AMQP.
        canal = conexion.channel()

        # Declara la cola con la misma configuración
        # utilizada en RabbitMQ Management.
        canal.queue_declare(
            queue=cola,
            durable=True,
            exclusive=False,
            auto_delete=False
        )

        # Exige confirmación del broker.
        canal.confirm_delivery()

        mensaje = json.dumps(
            evento,
            ensure_ascii=False,
            separators=(",", ":")
        ).encode("utf-8")

        operacion_id = str(
            evento["operacionId"]
        )

        propiedades = pika.BasicProperties(
            content_type="application/json",
            content_encoding="utf-8",
            delivery_mode=2,
            message_id=operacion_id,
            correlation_id=operacion_id,
            type="VENTA_REALIZADA",
            timestamp=int(
                datetime.now(timezone.utc).timestamp()
            )
        )

        # Exchange predeterminado:
        # routing_key = nombre de la cola.
        canal.basic_publish(
            exchange="",
            routing_key=cola,
            body=mensaje,
            properties=propiedades,
            mandatory=True
        )

        # Si llegamos aquí, Pika no recibió NACK
        # ni una devolución por ruta inexistente.
        print(
            f"[RabbitMQ] VENTA_REALIZADA publicada. "
            f"Venta #{evento['ventaId']} - "
            f"Cola: {cola}",
            flush=True
        )

        return True

    except (
        pika.exceptions.AMQPError,
        OSError,
        ValueError,
        TimeoutError
    ) as error:
        logger.warning(
            "RabbitMQ: publicación pendiente. "
            "Venta %s. Causa: %s",
            evento.get("ventaId"),
            type(error).__name__
        )

        return False

    finally:
        if conexion is not None:
            try:
                if conexion.is_open:
                    conexion.close()
            except pika.exceptions.AMQPError:
                pass
