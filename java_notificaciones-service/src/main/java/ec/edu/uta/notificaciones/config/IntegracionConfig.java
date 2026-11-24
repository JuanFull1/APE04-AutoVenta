
package ec.edu.uta.notificaciones.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
@EnableRabbit
public class IntegracionConfig {

    @Bean
    public CachingConnectionFactory rabbitConnectionFactory(
            @Value("${RABBITMQ_HOST:127.0.0.1}") String host,
            @Value("${RABBITMQ_PORT:5679}") int puerto,
            @Value("${RABBITMQ_USER:ape04}") String usuario,
            @Value("${RABBITMQ_PASSWORD:}") String password,
            @Value("${RABBITMQ_VHOST:/}") String vhost) {

        if (password == null || password.isBlank()) {
            throw new IllegalStateException(
                    "Falta configurar RABBITMQ_PASSWORD"
            );
        }

        CachingConnectionFactory conexion =
                new CachingConnectionFactory(host, puerto);

        conexion.setUsername(usuario);
        conexion.setPassword(password);
        conexion.setVirtualHost(vhost);

        return conexion;
    }

    @Bean
    public DataSource dataSource() throws IOException {

        Path carpeta = Path.of(
                System.getProperty("user.dir"),
                "data"
        ).toAbsolutePath();

        Files.createDirectories(carpeta);

        Path archivo = carpeta.resolve("notificaciones");

        String ruta = archivo.toString()
                .replace("\\", "/");

        HikariDataSource origen = new HikariDataSource();

        origen.setJdbcUrl(
                "jdbc:h2:file:" + ruta +
                ";DB_CLOSE_ON_EXIT=FALSE"
        );

        origen.setDriverClassName("org.h2.Driver");
        origen.setUsername("sa");
        origen.setPassword("");
        origen.setMaximumPoolSize(3);
        origen.setPoolName("Notificaciones-H2");

        return origen;
    }
}
