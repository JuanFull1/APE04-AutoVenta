
package ec.edu.com;

import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.stage.Stage;
import javafx.util.Duration;

import java.util.function.Function;

public final class VehiculosApp extends Application {

    // =====================================================
    // CLIENTES REST
    // =====================================================

    private final VehiculosApiClient vehiculosApi =
            new VehiculosApiClient();

    private final NotificacionesApiClient notificacionesApi =
            new NotificacionesApiClient();

    // =====================================================
    // VEHÍCULOS
    // =====================================================

    private final PasswordField txtJwt =
            new PasswordField();

    private final Button btnVehiculos =
            new Button("Consultar vehículos");

    private final Label lblEstadoVehiculos =
            new Label("Listo para consultar");

    private final Label lblTotalVehiculos =
            new Label("Total de vehículos: 0");

    private final TableView<Vehiculo> tablaVehiculos =
            new TableView<>();

    // =====================================================
    // NOTIFICACIONES
    // =====================================================

    private final PasswordField txtClave =
            new PasswordField();

    private final Button btnNotificaciones =
            new Button("Consultar ahora");

    private final Label lblEstadoNotificaciones =
            new Label("Ingresa la clave del servicio");

    private final Label lblTotalNotificaciones =
            new Label("Total de notificaciones: 0");

    private final TableView<Notificacion> tablaNotificaciones =
            new TableView<>();

    private boolean consultandoNotificaciones = false;

    private Timeline actualizador;

    // =====================================================
    // INICIO
    // =====================================================

    @Override
    public void start(Stage ventana) {

        Label titulo = new Label(
                "AutoVenta | Aplicación de escritorio"
        );

        titulo.setStyle(
                "-fx-font-size: 23px;" +
                "-fx-font-weight: bold;"
        );

        Label subtitulo = new Label(
                "Consulta de vehículos y notificaciones de ventas"
        );

        subtitulo.setTextFill(Color.GRAY);

        VBox encabezado = new VBox(
                5,
                titulo,
                subtitulo
        );

        encabezado.setPadding(
                new Insets(5, 0, 10, 0)
        );

        Tab pestanaVehiculos = new Tab(
                "Vehículos",
                crearPanelVehiculos()
        );

        pestanaVehiculos.setClosable(false);

        Tab pestanaNotificaciones = new Tab(
                "Notificaciones",
                crearPanelNotificaciones()
        );

        pestanaNotificaciones.setClosable(false);

        TabPane pestanas = new TabPane(
                pestanaVehiculos,
                pestanaNotificaciones
        );

        pestanas.setTabClosingPolicy(
                TabPane.TabClosingPolicy.UNAVAILABLE
        );

        VBox.setVgrow(
                pestanas,
                Priority.ALWAYS
        );

        VBox raiz = new VBox(
                12,
                encabezado,
                pestanas
        );

        raiz.setPadding(new Insets(20));

        raiz.setStyle(
                "-fx-background-color: #f7f9fc;" +
                "-fx-font-family: 'Segoe UI';"
        );

        // Actualización automática:
        // una consulta cada cuatro segundos,
        // solamente cuando la pestaña está visible.
        actualizador = new Timeline(
                new KeyFrame(
                        Duration.seconds(4),
                        evento -> {

                            if (pestanaNotificaciones.isSelected()
                                    && !txtClave.getText().isBlank()) {

                                consultarNotificaciones();
                            }
                        }
                )
        );

        actualizador.setCycleCount(
                Timeline.INDEFINITE
        );

        actualizador.play();

        pestanaNotificaciones.setOnSelectionChanged(
                evento -> {

                    if (pestanaNotificaciones.isSelected()
                            && !txtClave.getText().isBlank()) {

                        consultarNotificaciones();
                    }
                }
        );

        ventana.setScene(
                new Scene(raiz, 1180, 700)
        );

        ventana.setMinWidth(930);
        ventana.setMinHeight(550);

        ventana.setTitle(
                "AutoVenta - Vehículos y Notificaciones"
        );

        ventana.setOnCloseRequest(
                evento -> {

                    if (actualizador != null) {
                        actualizador.stop();
                    }
                }
        );

        ventana.show();
    }

    // =====================================================
    // PESTAÑA DE VEHÍCULOS
    // =====================================================

    private VBox crearPanelVehiculos() {

        Label titulo = new Label(
                "Consulta de vehículos registrados"
        );

        titulo.setStyle(
                "-fx-font-size: 18px;" +
                "-fx-font-weight: bold;"
        );

        Label instruccion = new Label(
                "Introduce el JWT del usuario para consultar la API Java."
        );

        instruccion.setTextFill(Color.GRAY);

        txtJwt.setPromptText(
                "JWT de autenticación"
        );

        txtJwt.setMaxWidth(
                Double.MAX_VALUE
        );

        HBox.setHgrow(
                txtJwt,
                Priority.ALWAYS
        );

        btnVehiculos.setOnAction(
                evento -> consultarVehiculos()
        );

        HBox controles = new HBox(
                12,
                txtJwt,
                btnVehiculos
        );

        controles.setAlignment(
                Pos.CENTER_LEFT
        );

        agregarColumna(
                tablaVehiculos,
                "ID",
                Vehiculo::idVehiculo,
                65
        );

        agregarColumna(
                tablaVehiculos,
                "Marca",
                Vehiculo::marca,
                120
        );

        agregarColumna(
                tablaVehiculos,
                "Modelo",
                Vehiculo::modelo,
                130
        );

        agregarColumna(
                tablaVehiculos,
                "Placa",
                Vehiculo::placa,
                110
        );

        agregarColumna(
                tablaVehiculos,
                "Chasis",
                Vehiculo::chasis,
                175
        );

        agregarColumna(
                tablaVehiculos,
                "Año",
                Vehiculo::anio,
                75
        );

        agregarColumna(
                tablaVehiculos,
                "Color",
                Vehiculo::color,
                100
        );

        agregarColumna(
                tablaVehiculos,
                "Precio",
                Vehiculo::precio,
                105
        );

        agregarColumna(
                tablaVehiculos,
                "Estado",
                Vehiculo::estado,
                110
        );

        tablaVehiculos.setPlaceholder(
                new Label(
                        "No hay vehículos para mostrar"
                )
        );

        VBox.setVgrow(
                tablaVehiculos,
                Priority.ALWAYS
        );

        lblEstadoVehiculos.setWrapText(true);

        HBox pie = new HBox(
                20,
                lblTotalVehiculos,
                lblEstadoVehiculos
        );

        pie.setAlignment(
                Pos.CENTER_LEFT
        );

        VBox panel = new VBox(
                15,
                titulo,
                instruccion,
                controles,
                tablaVehiculos,
                pie
        );

        panel.setPadding(
                new Insets(18)
        );

        VBox.setVgrow(
                panel,
                Priority.ALWAYS
        );

        return panel;
    }

    private void consultarVehiculos() {

        String jwt = txtJwt.getText().trim();

        if (jwt.regionMatches(
                true,
                0,
                "Bearer ",
                0,
                7
        )) {

            jwt = jwt.substring(7).trim();
        }

        if (jwt.isBlank()) {

            mostrarEstado(
                    lblEstadoVehiculos,
                    "Debes ingresar el JWT.",
                    true
            );

            return;
        }

        btnVehiculos.setDisable(true);

        mostrarEstado(
                lblEstadoVehiculos,
                "Consultando vehículos...",
                false
        );

        vehiculosApi.consultarVehiculos(jwt)
                .whenComplete((resultado, error) ->

                        Platform.runLater(() -> {

                            btnVehiculos.setDisable(false);

                            if (error != null) {

                                tablaVehiculos.getItems().clear();

                                lblTotalVehiculos.setText(
                                        "Total de vehículos: 0"
                                );

                                mostrarEstado(
                                        lblEstadoVehiculos,
                                        "No fue posible conectar con la API.",
                                        true
                                );

                                return;
                            }

                            if (resultado.codigoHttp() != 200) {

                                tablaVehiculos.getItems().clear();

                                lblTotalVehiculos.setText(
                                        "Total de vehículos: 0"
                                );

                                mostrarEstado(
                                        lblEstadoVehiculos,
                                        "HTTP " + resultado.codigoHttp()
                                                + ": consulta no autorizada "
                                                + "o servicio no disponible.",
                                        true
                                );

                                return;
                            }

                            tablaVehiculos.getItems().setAll(
                                    resultado.vehiculos()
                            );

                            int total =
                                    resultado.vehiculos().size();

                            lblTotalVehiculos.setText(
                                    "Total de vehículos: " + total
                            );

                            mostrarEstado(
                                    lblEstadoVehiculos,
                                    total == 0
                                            ? "La consulta funcionó, "
                                                + "pero no hay registros."
                                            : "Vehículos actualizados correctamente.",
                                    false
                            );
                        })
                );
    }

    // =====================================================
    // PESTAÑA DE NOTIFICACIONES
    // =====================================================

    private VBox crearPanelNotificaciones() {

        Label titulo = new Label(
                "Notificaciones de ventas"
        );

        titulo.setStyle(
                "-fx-font-size: 18px;" +
                "-fx-font-weight: bold;"
        );

        Label descripcion = new Label(
                "Eventos recibidos por Spring Boot desde RabbitMQ "
                        + "y almacenados en la base de datos H2."
        );

        descripcion.setTextFill(
                Color.GRAY
        );

        Label lblClave = new Label(
                "Clave del servicio de notificaciones:"
        );

        txtClave.setPromptText(
                "X-Notification-Key"
        );

        txtClave.setMaxWidth(
                Double.MAX_VALUE
        );

        HBox.setHgrow(
                txtClave,
                Priority.ALWAYS
        );

        btnNotificaciones.setOnAction(
                evento -> consultarNotificaciones()
        );

        HBox controles = new HBox(
                12,
                txtClave,
                btnNotificaciones
        );

        controles.setAlignment(
                Pos.CENTER_LEFT
        );

        Label lblAuto = new Label(
                "Actualización automática cada 4 segundos"
        );

        lblAuto.setTextFill(
                Color.GRAY
        );

        agregarColumna(
                tablaNotificaciones,
                "ID",
                Notificacion::id,
                65
        );

        agregarColumna(
                tablaNotificaciones,
                "Venta",
                Notificacion::ventaId,
                80
        );

        agregarColumna(
                tablaNotificaciones,
                "Vehículo",
                Notificacion::vehiculoId,
                90
        );

        agregarColumna(
                tablaNotificaciones,
                "Tipo",
                Notificacion::tipo,
                110
        );

        agregarColumna(
                tablaNotificaciones,
                "Mensaje",
                Notificacion::mensaje,
                410
        );

        agregarColumna(
                tablaNotificaciones,
                "Fecha de recepción UTC",
                Notificacion::fechaRecepcionUTC,
                240
        );

        tablaNotificaciones.setColumnResizePolicy(
                TableView.CONSTRAINED_RESIZE_POLICY
        );

        tablaNotificaciones.setPlaceholder(
                new Label(
                        "No hay notificaciones registradas"
                )
        );

        VBox.setVgrow(
                tablaNotificaciones,
                Priority.ALWAYS
        );

        lblEstadoNotificaciones.setWrapText(true);

        HBox pie = new HBox(
                20,
                lblTotalNotificaciones,
                lblEstadoNotificaciones
        );

        pie.setAlignment(
                Pos.CENTER_LEFT
        );

        VBox panel = new VBox(
                14,
                titulo,
                descripcion,
                lblClave,
                controles,
                lblAuto,
                tablaNotificaciones,
                pie
        );

        panel.setPadding(
                new Insets(18)
        );

        VBox.setVgrow(
                panel,
                Priority.ALWAYS
        );

        return panel;
    }

    private void consultarNotificaciones() {

        if (consultandoNotificaciones) {
            return;
        }

        String clave = txtClave.getText().trim();

        if (clave.isBlank()) {

            mostrarEstado(
                    lblEstadoNotificaciones,
                    "Ingresa la clave X-Notification-Key.",
                    true
            );

            return;
        }

        consultandoNotificaciones = true;

        btnNotificaciones.setDisable(true);

        mostrarEstado(
                lblEstadoNotificaciones,
                "Consultando notificaciones...",
                false
        );

        notificacionesApi.consultarNotificaciones(clave)
                .whenComplete((resultado, error) ->

                        Platform.runLater(() -> {

                            consultandoNotificaciones = false;
                            btnNotificaciones.setDisable(false);

                            if (error != null) {

                                tablaNotificaciones.getItems().clear();

                                lblTotalNotificaciones.setText(
                                        "Total de notificaciones: —"
                                );

                                mostrarEstado(
                                        lblEstadoNotificaciones,
                                        "Error de conexión con Spring Boot "
                                                + "en el puerto 8081.",
                                        true
                                );

                                return;
                            }

                            if (resultado.codigoHttp() == 401) {

                                tablaNotificaciones.getItems().clear();

                                lblTotalNotificaciones.setText(
                                        "Total de notificaciones: —"
                                );

                                mostrarEstado(
                                        lblEstadoNotificaciones,
                                        "HTTP 401: clave del servicio incorrecta.",
                                        true
                                );

                                return;
                            }

                            if (resultado.codigoHttp() != 200) {

                                tablaNotificaciones.getItems().clear();

                                lblTotalNotificaciones.setText(
                                        "Total de notificaciones: —"
                                );

                                mostrarEstado(
                                        lblEstadoNotificaciones,
                                        "HTTP " + resultado.codigoHttp()
                                                + ": error del servicio.",
                                        true
                                );

                                return;
                            }

                            tablaNotificaciones.getItems().setAll(
                                    resultado.notificaciones()
                            );

                            int total =
                                    resultado.notificaciones().size();

                            lblTotalNotificaciones.setText(
                                    "Total de notificaciones: " + total
                            );

                            mostrarEstado(
                                    lblEstadoNotificaciones,
                                    total == 0
                                            ? "Conectado. No existen notificaciones."
                                            : "Conectado. Notificaciones actualizadas.",
                                    false
                            );
                        })
                );
    }

    // =====================================================
    // MÉTODOS COMUNES
    // =====================================================

    private void mostrarEstado(
            Label etiqueta,
            String mensaje,
            boolean error) {

        etiqueta.setText(mensaje);

        etiqueta.setTextFill(
                error
                        ? Color.FIREBRICK
                        : Color.DARKSLATEGRAY
        );
    }

    private <T, V> void agregarColumna(
            TableView<T> tabla,
            String titulo,
            Function<T, V> obtenerValor,
            double ancho) {

        TableColumn<T, V> columna =
                new TableColumn<>(titulo);

        columna.setCellValueFactory(
                fila -> new ReadOnlyObjectWrapper<>(
                        obtenerValor.apply(
                                fila.getValue()
                        )
                )
        );

        columna.setPrefWidth(ancho);

        tabla.getColumns().add(columna);
    }

    @Override
    public void stop() {

        if (actualizador != null) {
            actualizador.stop();
        }
    }
}
