# AutoVenta — APE 04 | Aplicaciones Orientadas a Servicios

Sistema académico de venta de vehículos que integra aplicaciones Windows Forms, React, PWA y JavaFX con servicios REST en Java Spring Boot y Python FastAPI, MySQL, un proxy inverso NGINX y mensajería asíncrona RabbitMQ.

> **Estado:** implementación integrada para prácticas académicas; la matriz de pruebas P01–P28 y sus resultados se documentan en el informe. No se debe considerar un sistema listo para producción.

## 1. Objetivo

Demostrar interoperabilidad entre clientes y servicios, autenticación JWT, balanceo de carga, registro idempotente de ventas, persistencia y recuperación de notificaciones, y trazabilidad de los identificadores de vehículo y venta.

## 2. Arquitectura

![Arquitectura del sistema AutoVenta](docs/arquitectura-autoventa.png)

**Flujo principal:**

1. **Windows Forms** administra vehículos y compradores y consulta ventas.
2. **React** consulta vehículos, sus detalles y ventas (no registra ventas).
3. **PWA móvil** inicia sesión, obtiene un JWT y registra ventas por FastAPI.
4. **NGINX** centraliza rutas REST y balancea las instancias Java de vehículos con pesos 3:1.
5. **FastAPI** registra la operación, controla la idempotencia y publica el evento de venta en **RabbitMQ**.
6. **Spring Boot Notificaciones** consume los eventos, los almacena en **H2** y los expone por REST.
7. **JavaFX** consulta periódicamente las notificaciones desde Spring Boot (sin conectarse directamente a RabbitMQ ni a H2).

## 3. Tecnologías y componentes

| Componente | Tecnología | Puerto local actual | Función |
|---|---|---:|---|
| Vehículos A | Java / Spring Boot | `8083` | JWT, vehículos e identidad |
| Vehículos B | Java / Spring Boot | `8082` | Segunda instancia del balanceador |
| Ventas | Python / FastAPI | `8002` | Compradores, ventas, idempotencia |
| Notificaciones | Java / Spring Boot | `8081` | Consumidor RabbitMQ, REST y H2 |
| NGINX | Docker | `8090` | Proxy inverso, balanceo 3:1 |
| RabbitMQ AMQP | Docker | `5679` | Cola durable `notificaciones.ventas` |
| RabbitMQ Management | Docker | `15680` | Administración de colas |
| React | Vite | `5174` | Consulta web |
| PWA | Node.js / PWA | `4173` | Cliente móvil y registro de ventas |
| Windows Forms | .NET 8 | — | Cliente de escritorio administrativo |
| JavaFX | JavaFX 21 | — | Cliente de escritorio de notificaciones |
| MySQL | XAMPP / MySQL | Según instalación (`3306` habitual) | Datos operacionales |

**Nota:** la guía utiliza `8080` como puerto de referencia para Java A, pero este equipo emplea `8083`. En todas las pruebas debe documentarse el puerto realmente configurado.

## 4. Estructura del repositorio

```text
APE04-AutoVenta/
├── README.md
├── .gitignore
├── docs/
│   └── arquitectura-autoventa.png
├── infra/
│   ├── compose.yaml
│   └── nginx.conf
├── API/                           # JAR de ejecución local (no subir binarios)
├── AplicacionWebREACT/
│   └── react-fetch-vehiculos/
├── AplicacionMovilPWA/
├── AplicacionEscritorioWINDOWS_FORMS/
│   └── ConsultaVehiculosWinForms/
├── AplicacionEscritorioJAVA_FX/
│   └── consultarvehiculojavafx/
├── python_ventas-api/
├── java_notificaciones-service/
└── [carpeta-fuente-api-java-vehiculos]/
```

**Pendiente de ajustar antes de publicar:** sustituir `[carpeta-fuente-api-java-vehiculos]` por el nombre real de la carpeta que contiene el código fuente y `pom.xml` de Java Vehículos. El JAR de `API/` no reemplaza ese código fuente.

Cada uno de los siete proyectos debe conservar también su propio README con requisitos, configuración, compilación y ejecución, según la guía.

## 5. Requisitos previos

- Windows 10/11, PowerShell y Git.
- Docker Desktop funcionando.
- XAMPP/MySQL con las bases y esquemas requeridos.
- JDK compatible con el proyecto Java (módulos compilados para Java 17) y Maven o Maven Wrapper.
- .NET SDK 8 para Windows Forms.
- Node.js y npm (en desarrollo se utilizó Node.js 24).
- Python compatible con el proyecto FastAPI y dependencias declaradas en sus archivos de requisitos.
- Scripts SQL o migraciones aplicados sobre una base local de desarrollo.

No subir al repositorio carpetas de dependencias ni bases de datos con información personal.

## 6. Configuración local y credenciales

**No hay claves reales en este README.** Las variables y credenciales deben configurarse localmente:

- FastAPI: usar `python_ventas-api/.env` local basado en una plantilla `.env.example` depurada. No subir `.env`.
- RabbitMQ: establecer `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` y `RABBITMQ_VHOST` según el entorno.
- Spring Boot: preparar `application.properties` local a partir de `application.properties.example` sin secretos reales. Para la clave de notificaciones puede usarse `app.notificacion-key=${APP_NOTIFICACION_KEY}` y definir `APP_NOTIFICACION_KEY` localmente.
- MySQL: configurar host, base, usuario y contraseña en cada servicio según sus propias propiedades y esquemas.
- Los clientes protegidos usan JWT de un usuario autorizado. La **PWA obtiene el JWT mediante su propio login**; no se debe codificar ningún JWT en el repositorio.
- La versión de demostración de JavaFX solicita una clave de notificaciones en su interfaz; **nunca colocar esa clave en el código ni en las capturas**. Se recomienda restringir este mecanismo a entorno local.

**Antes de publicar:** reemplazar las claves utilizadas en las pruebas y revisar `application.properties`, `compose.yaml`, archivos fuente y ejemplos para eliminar valores reales. El archivo `.gitignore` no protege secretos escritos dentro de un archivo que sí se publique.

## 7. Orden de arranque local (PowerShell)

Ejecutar cada servicio en su propia terminal. Los comandos siguientes corresponden al entorno de desarrollo de `C:\soaApe`; ajustar la ubicación si algún proyecto fue movido.

### 7.1. MySQL

Iniciar MySQL desde **XAMPP Control Panel** y comprobar que los esquemas estén disponibles. No iniciar una segunda instancia que ocupe el mismo puerto.

### 7.2. NGINX y RabbitMQ

```powershell
cd C:\soaApe
docker compose -f .\infra\compose.yaml up -d
docker ps
```

Verificación:

```powershell
docker exec ape04-nginx nginx -t
curl.exe -i http://127.0.0.1:8090/nginx-ping
```

### 7.3. Java Vehículos A y B

Arrancar **dos instancias del mismo servicio**, en terminales diferentes, con los ajustes de conexión a MySQL y claves JWT locales. Si el JAR ya fue compilado y se encuentra en `API/`:

```powershell
# Terminal A
cd C:\soaApe
java -jar .\API\venta-vehiculos-api-0.0.1-SNAPSHOT.jar --server.port=8083
```

```powershell
# Terminal B
cd C:\soaApe
java -jar .\API\venta-vehiculos-api-0.0.1-SNAPSHOT.jar --server.port=8082
```

Para reproducir el proyecto desde cero, compilar primero el **código fuente** de la API Java con Maven en su carpeta real. El JAR de ejecución está excluido de Git.

### 7.4. Python FastAPI

```powershell
cd C:\soaApe\python_ventas-api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Si `.venv` no existe, crear el entorno e instalar las dependencias indicadas por el proyecto antes de ejecutar. El servicio necesita su configuración local y las APIs correspondientes.

### 7.5. Spring Boot Notificaciones

```powershell
cd C:\soaApe\java_notificaciones-service
# Configurar previamente las variables RABBITMQ_* y APP_NOTIFICACION_KEY
mvn spring-boot:run
```

**Importante:** ejecutar una sola instancia de este servicio cuando utilice el mismo archivo de H2 persistente, porque H2 puede bloquearlo si se abre simultáneamente en dos procesos.

### 7.6. React

```powershell
cd C:\soaApe\AplicacionWebREACT\react-fetch-vehiculos
npm install
npm run dev -- --port 5174
```

Abrir <http://localhost:5174>.

### 7.7. PWA móvil

```powershell
cd C:\soaApe\AplicacionMovilPWA
npm install
npm run build
$env:API_BASE_URL = "http://127.0.0.1:8090"
npm run preview
```

Abrir <http://localhost:4173>. Si el `package.json` se encuentra en una subcarpeta, ejecutar los comandos desde esa ubicación.

### 7.8. Windows Forms

```powershell
cd C:\soaApe\AplicacionEscritorioWINDOWS_FORMS\ConsultaVehiculosWinForms
dotnet run
```

### 7.9. JavaFX

```powershell
cd C:\soaApe\AplicacionEscritorioJAVA_FX\consultarvehiculojavafx
mvn javafx:run
```

Abrir la pestaña **Notificaciones** para consultar las entradas del servicio Spring Boot (`8081`).

## 8. Rutas de acceso

| Dirección | Descripción |
|---|---|
| <http://localhost:5174> | Aplicación React |
| <http://localhost:4173> | PWA móvil |
| <http://localhost:8002/docs> | Swagger de FastAPI |
| <http://localhost:15680> | RabbitMQ Management |
| <http://localhost:8090/nginx-ping> | Comprobación de NGINX |

Las rutas protegidas pueden devolver HTTP `401` cuando se consultan sin autorización. Esto no implica necesariamente que la API esté detenida.

## 9. Contratos REST principales

Los métodos indicados son los utilizados en la integración; consultar el código y OpenAPI para detalles de autorización y cuerpos JSON.

| Método | Ruta a través de NGINX | Descripción |
|---|---|---|
| POST | `/oauth/token` | Autenticación de usuario |
| GET | `/api/vehiculos` | Consulta de vehículos |
| GET | `/api/identidad` | Identidad y permisos, según ruta expuesta |
| GET / POST | `/api/compradores` | Consultas y altas autorizadas |
| GET / POST | `/api/ventas` | Consulta / creación autorizada de ventas (creación solo desde PWA como cliente) |
| GET | `/api/ventas/{id}` | Estado de una venta |
| GET | `/api/notificaciones` | Consulta protegida de notificaciones |

**Reglas principales:** JWT válido y autorizado, `Idempotency-Key` en la creación de venta, verificación del estado del vehículo y publicación de evento solo cuando corresponde. El frontend no decide por sí solo el resultado definitivo de la venta.

## 10. RabbitMQ y notificaciones

- **Cola:** `notificaciones.ventas` (durable).
- **Publicador:** FastAPI, después del procesamiento de la venta.
- **Consumidor:** Spring Boot Notificaciones (`8081`).
- **Almacenamiento:** H2 persistente.
- **Cliente de consulta:** JavaFX, con actualización periódica cada cuatro segundos.
- **Control de duplicados:** identificador único de evento (`eventoId`) en persistencia.

Consulta local del estado de la cola:

```powershell
docker exec ape04-rabbitmq rabbitmqctl list_queues name durable messages_ready messages_unacknowledged consumers
```

## 11. Comprobaciones rápidas

```powershell
# Sintaxis y estado del balanceador
docker exec ape04-nginx nginx -t
curl.exe -i http://127.0.0.1:8090/nginx-ping

# Swagger FastAPI
curl.exe -I http://127.0.0.1:8002/docs

# Ruta protegida sin JWT: debe rechazar la petición
curl.exe -i http://127.0.0.1:8090/api/ventas

# Estado de contenedores
docker compose -f .\infra\compose.yaml ps
```

Resultados de referencia observados en desarrollo: `/nginx-ping` respondió HTTP 200 y `/api/ventas` devolvió HTTP 401 sin JWT. Los resultados definitivos de las pruebas P01–P28 se consignan en el informe con capturas, fechas, identificadores y registros reales.

## 12. Limitaciones conocidas y pendientes

- La interfaz JavaFX de demostración solicita la clave de acceso al servicio de notificaciones; no debe distribuirse dicha clave en código ni documentación pública.
- Algunos clientes de escritorio/web todavía permiten introducir un JWT manualmente. La PWA sí utiliza login propio para registrar ventas. No se añaden pantallas de login donde el enunciado no las exige.
- El despliegue corresponde a un entorno local de laboratorio; las direcciones `localhost` y `host.docker.internal` no son direcciones para producción.
- Completar y auditar las plantillas de configuración local, scripts SQL y READMEs individuales antes de entregar el repositorio.
- Adjuntar al informe los resultados reales de las pruebas P01–P28; no inventar tasas de balanceo, tiempos de recuperación ni códigos HTTP.

## 13. Evidencias, informe y control de versiones

- **Informe académico:** `INFORME_APE04_APELLIDO_NOMBRE.pdf`.
- **Entrega de código fuente:** `APE04_APELLIDO_NOMBRE.zip` (archivo a preparar según el formato de la guía; no incluir `.git`, compilaciones ni secretos).
- **Repositorio GitHub:** `[Enlace al repositorio privado](https://github.com/USUARIO/APE04-AutoVenta)` — sustituir `USUARIO` por la cuenta real después de crear el repositorio.
- **Diagrama de arquitectura:** `docs/arquitectura-autoventa.png`.

El acceso a un repositorio **privado** debe concederse a los docentes o revisores autorizados desde GitHub. El enlace por sí solo no proporciona permisos.

## 14. Autoría

**Proyecto:** AutoVenta — APE 04, Aplicaciones Orientadas a Servicios.

**Institución:** Universidad Técnica de Ambato.

**Autor(es):** [Completar nombres y apellidos que correspondan a la entrega].

**Año:** 2026.

**Uso:** académico y demostrativo.
