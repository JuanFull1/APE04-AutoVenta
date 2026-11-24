
package ec.edu.uta.notificaciones.controller;

import ec.edu.uta.notificaciones.dto.NotificacionDetalle;
import ec.edu.uta.notificaciones.dto.NotificacionRequest;
import ec.edu.uta.notificaciones.dto.NotificacionResponse;
import ec.edu.uta.notificaciones.service.NotificacionService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notificaciones")
public class NotificacionController {

    private final NotificacionService notificacionService;

    public NotificacionController(
            NotificacionService notificacionService) {

        this.notificacionService = notificacionService;
    }

    // Conserva la creación por HTTP.
    @PostMapping
    public ResponseEntity<NotificacionResponse> crear(
            @RequestBody NotificacionRequest request) {

        NotificacionResponse respuesta =
                notificacionService.procesar(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(respuesta);
    }

    // JavaFX consultará este endpoint.
    @GetMapping
    public List<NotificacionDetalle> listar() {
        return notificacionService.listar();
    }

    // Resumen para comprobaciones técnicas.
    @GetMapping("/resumen")
    public Map<String, Object> resumen() {

        return Map.of(
                "success", true,
                "total", notificacionService.total(),
                "servicio", "notificaciones"
        );
    }
}
