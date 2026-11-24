
package ec.edu.uta.notificaciones.dto;

public record NotificacionDetalle(
        Long id,
        String eventoId,
        Long ventaId,
        Integer vehiculoId,
        Integer compradorId,
        String tipo,
        String destinatario,
        String mensaje,
        String fechaUTC,
        String fechaRecepcionUTC
) {
}
