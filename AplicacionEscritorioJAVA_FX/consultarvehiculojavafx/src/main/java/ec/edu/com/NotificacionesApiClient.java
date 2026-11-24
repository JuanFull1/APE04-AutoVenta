package ec.edu.com;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

public final class NotificacionesApiClient {

    private static final String URL_API =
        "http://127.0.0.1:8081/api/notificaciones";

    private final HttpClient clienteHttp = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    private final ObjectMapper mapper = new ObjectMapper();

    public CompletableFuture<ResultadoConsulta> consultarNotificaciones(String clave) {

        HttpRequest solicitud = HttpRequest.newBuilder(URI.create(URL_API))
            .timeout(Duration.ofSeconds(10))
            .header("X-Notification-Key", clave)
            .header("Accept", "application/json")
            .GET()
            .build();

        return clienteHttp.sendAsync(
            solicitud,
            HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        ).thenApply(respuesta -> {

            int codigo = respuesta.statusCode();

            if (codigo != 200) {
                return new ResultadoConsulta(codigo, List.of());
            }

            try {
                List<Notificacion> lista = mapper.readValue(
                    respuesta.body(),
                    new TypeReference<List<Notificacion>>() {}
                );

                return new ResultadoConsulta(codigo, lista);

            } catch (JsonProcessingException error) {
                throw new CompletionException(error);
            }
        });
    }

    public record ResultadoConsulta(
        int codigoHttp,
        List<Notificacion> notificaciones
    ) {
    }
}
