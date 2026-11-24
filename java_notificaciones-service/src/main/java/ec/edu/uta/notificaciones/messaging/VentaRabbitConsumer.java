
package ec.edu.uta.notificaciones.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;

import ec.edu.uta.notificaciones.service.NotificacionService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class VentaRabbitConsumer {

    private static final Logger logger =
            LoggerFactory.getLogger(VentaRabbitConsumer.class);

    private final NotificacionService servicio;
    private final ObjectMapper mapper;

    public VentaRabbitConsumer(
            NotificacionService servicio,
            ObjectMapper mapper) {

        this.servicio = servicio;
        this.mapper = mapper;
    }

    @RabbitListener(
            queues = "notificaciones.ventas",
            ackMode = "MANUAL",
            concurrency = "1"
    )
    public void recibir(
            byte[] contenido,
            Channel canal,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {

        try {

            // Convierte el contenido recibido desde RabbitMQ.
            String json = new String(
                    contenido,
                    StandardCharsets.UTF_8
            );

            JsonNode evento = mapper.readTree(json);

            // Guarda el evento y comprueba si ya existe.
            boolean nueva = servicio.registrarEvento(evento);

            long ventaId = evento.path("ventaId").asLong();

            String eventoId = evento.path("eventoId").asText();

            // Confirma el mensaje solo después de procesarlo.
            canal.basicAck(deliveryTag, false);

            if (nueva) {

                System.out.println(
                        "[RabbitMQ] CONSUMIDA venta #"
                                + ventaId
                                + " | Evento "
                                + eventoId
                                + " | ALMACENADA"
                );

            } else {

                System.out.println(
                        "[RabbitMQ] CONSUMIDA venta #"
                                + ventaId
                                + " | Evento "
                                + eventoId
                                + " | DUPLICADO, sin nuevo registro"
                );

            }

        } catch (Exception error) {

            logger.error(
                    "No fue posible procesar el evento de RabbitMQ",
                    error
            );

            // Si ocurre un error, devuelve el mensaje a la cola.
            try {

                if (canal.isOpen()) {
                    canal.basicNack(
                            deliveryTag,
                            false,
                            true
                    );
                }

            } catch (Exception errorCanal) {

                logger.error(
                        "No se pudo devolver el evento a la cola",
                        errorCanal
                );
            }

            // Evita reintentos demasiado rápidos.
            try {

                Thread.sleep(2000);

            } catch (InterruptedException interrupcion) {

                Thread.currentThread().interrupt();
            }
        }
    }
}
