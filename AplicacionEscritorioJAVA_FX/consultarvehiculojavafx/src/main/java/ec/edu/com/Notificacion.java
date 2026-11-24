package ec.edu.com;

public record Notificacion(
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
