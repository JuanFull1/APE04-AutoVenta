
import { useEffect, useMemo, useState } from "react";
import {
  listarVehiculos,
  listarCompradores,
  listarVentas,
} from "./api/vehiculosApi";
import "./App.css";

const moneda = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

function texto(valor) {
  return valor === undefined || valor === null || valor === ""
    ? "—"
    : String(valor);
}

function precio(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return "—";
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? moneda.format(numero)
    : texto(valor);
}

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buscarEn(consulta, valores) {
  const palabras = normalizar(consulta)
    .split(/\s+/)
    .filter(Boolean);

  const contenido = normalizar(valores.join(" "));

  return palabras.every((palabra) =>
    contenido.includes(palabra)
  );
}

function idVehiculo(v) {
  return v?.idVehiculo ??
    v?.vehiculoId ??
    v?.id_vehiculo ??
    v?.id;
}

function idComprador(c) {
  return c?.id ??
    c?.idComprador ??
    c?.compradorId;
}

function idVenta(v) {
  return v?.id ??
    v?.idVenta ??
    v?.ventaId;
}

function vehiculoIdVenta(v) {
  return v?.vehiculoId ??
    v?.idVehiculo ??
    v?.vehiculo_id;
}

function compradorIdVenta(v) {
  return v?.compradorId ??
    v?.idComprador ??
    v?.comprador_id;
}

function nombreVehiculo(v) {
  if (!v) return "Vehículo no identificado";

  return [v.marca, v.modelo]
    .filter(Boolean)
    .join(" ") || "Vehículo";
}

function disponible(v) {
  return normalizar(v?.estado) === "disponible";
}

function fecha(valor) {
  if (!valor) return "—";

  const fechaConvertida = new Date(valor);

  return Number.isNaN(fechaConvertida.getTime())
    ? texto(valor)
    : fechaConvertida.toLocaleString("es-EC");
}

function claseEstado(estado) {
  const valor = normalizar(estado);

  if (["disponible", "completada"].includes(valor)) {
    return "positivo";
  }

  if (
    ["en_revision", "pendiente", "reservado"].includes(valor)
  ) {
    return "pendiente";
  }

  return "neutro";
}

function Indicador({ icono, titulo, valor, descripcion }) {
  return (
    <article className="indicador">
      <span className="indicador-icono" aria-hidden="true">
        {icono}
      </span>
      <div className="indicador-info">
        <span className="indicador-titulo">{titulo}</span>
        <strong>{valor}</strong>
        <small>{descripcion}</small>
      </div>
    </article>
  );
}

function Aviso({ error, cargado, vacio }) {
  if (error) {
    return (
      <div className="mensaje error" role="alert">
        <strong>No se pudo completar la consulta</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!cargado) {
    return (
      <div className="estado-vacio">
        <span aria-hidden="true">⌕</span>
        <strong>Datos pendientes de consulta</strong>
        <p>Ingresa tu JWT y presiona Consultar servicios.</p>
      </div>
    );
  }

  if (vacio) {
    return (
      <div className="estado-vacio">
        <span aria-hidden="true">⌕</span>
        <strong>Sin resultados</strong>
        <p>No hay registros que coincidan con los filtros.</p>
      </div>
    );
  }

  return null;
}

function FilaDetalle({ nombre, valor }) {
  return (
    <div className="detalle-item">
      <span>{nombre}</span>
      <strong>{texto(valor)}</strong>
    </div>
  );
}

export default function App() {
  const [jwt, setJwt] = useState("");
  const [mostrarJwt, setMostrarJwt] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [seccion, setSeccion] = useState("vehiculos");

  const [vehiculos, setVehiculos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [compradores, setCompradores] = useState([]);

  const [cargado, setCargado] = useState({
    vehiculos: false,
    ventas: false,
    compradores: false,
  });

  const [errores, setErrores] = useState({
    vehiculos: "",
    ventas: "",
    compradores: "",
  });

  const [busquedaVehiculos, setBusquedaVehiculos] = useState("");
  const [estadoVehiculo, setEstadoVehiculo] = useState("TODOS");

  const [busquedaVentas, setBusquedaVentas] = useState("");
  const [estadoVenta, setEstadoVenta] = useState("TODOS");

  const [vehiculoSeleccionado, setVehiculoSeleccionado] =
    useState(null);

  const [ultimaConsulta, setUltimaConsulta] = useState("");
  const [mensajeGeneral, setMensajeGeneral] = useState("");

  const disponibles = vehiculos.filter(disponible).length;

  const mapaVehiculos = useMemo(
    () => new Map(
      vehiculos.map((v) => [
        String(idVehiculo(v)),
        v,
      ])
    ),
    [vehiculos]
  );

  const mapaCompradores = useMemo(
    () => new Map(
      compradores.map((c) => [
        String(idComprador(c)),
        c,
      ])
    ),
    [compradores]
  );

  const estadosVehiculos = useMemo(
    () => [
      ...new Set(
        vehiculos
          .map((v) => String(v.estado || "").toUpperCase())
          .filter(Boolean)
      ),
    ].sort(),
    [vehiculos]
  );

  const estadosVentas = useMemo(
    () => [
      ...new Set(
        ventas
          .map((v) => String(v.estado || "").toUpperCase())
          .filter(Boolean)
      ),
    ].sort(),
    [ventas]
  );

  const vehiculosFiltrados = useMemo(
    () => vehiculos.filter((v) => {
      const cumpleEstado =
        estadoVehiculo === "TODOS" ||
        String(v.estado || "").toUpperCase() === estadoVehiculo;

      const cumpleBusqueda = buscarEn(busquedaVehiculos, [
        idVehiculo(v),
        v.marca,
        v.modelo,
        v.placa,
        v.chasis,
        v.anio,
        v.color,
        v.estado,
      ]);

      return cumpleEstado && cumpleBusqueda;
    }),
    [vehiculos, estadoVehiculo, busquedaVehiculos]
  );

  const ventasFiltradas = useMemo(
    () => ventas
      .filter((v) => {
        const vehiculo = mapaVehiculos.get(
          String(vehiculoIdVenta(v))
        );

        const comprador = mapaCompradores.get(
          String(compradorIdVenta(v))
        );

        const cumpleEstado =
          estadoVenta === "TODOS" ||
          String(v.estado || "").toUpperCase() === estadoVenta;

        const cumpleBusqueda = buscarEn(busquedaVentas, [
          idVenta(v),
          v.estado,
          v.operacionId,
          vehiculoIdVenta(v),
          compradorIdVenta(v),
          vehiculo?.marca,
          vehiculo?.modelo,
          vehiculo?.placa,
          comprador?.nombre,
          comprador?.documento,
          comprador?.correo,
        ]);

        return cumpleEstado && cumpleBusqueda;
      })
      .sort(
        (a, b) =>
          Number(idVenta(b) || 0) -
          Number(idVenta(a) || 0)
      ),
    [
      ventas,
      mapaVehiculos,
      mapaCompradores,
      estadoVenta,
      busquedaVentas,
    ]
  );

  const porcentajeDisponibles =
    vehiculos.length > 0
      ? Math.round((disponibles / vehiculos.length) * 100)
      : 0;

  async function consultarServicios(evento) {
    evento?.preventDefault();

    if (!jwt.trim()) {
      setMensajeGeneral("Ingresa primero un JWT válido.");
      return;
    }

    if (cargando) return;

    setCargando(true);
    setMensajeGeneral("");

    const resultados = await Promise.allSettled([
      listarVehiculos(jwt),
      listarVentas(jwt),
      listarCompradores(jwt),
    ]);

    const nuevosErrores = {
      vehiculos: "",
      ventas: "",
      compradores: "",
    };

    const nuevosCargados = {
      vehiculos: false,
      ventas: false,
      compradores: false,
    };

    const nombres = ["vehiculos", "ventas", "compradores"];

    resultados.forEach((resultado, indice) => {
      const nombre = nombres[indice];

      if (resultado.status === "fulfilled") {
        nuevosCargados[nombre] = true;

        const contenido = resultado.value[nombre];

        if (nombre === "vehiculos") setVehiculos(contenido);
        if (nombre === "ventas") setVentas(contenido);
        if (nombre === "compradores") setCompradores(contenido);
      } else {
        nuevosErrores[nombre] =
          resultado.reason?.message || "Error de conexión.";

        if (nombre === "vehiculos") setVehiculos([]);
        if (nombre === "ventas") setVentas([]);
        if (nombre === "compradores") setCompradores([]);
      }
    });

    setErrores(nuevosErrores);
    setCargado(nuevosCargados);
    setUltimaConsulta(new Date().toLocaleTimeString("es-EC"));

    if (!nuevosErrores.vehiculos && !nuevosErrores.ventas) {
      setMensajeGeneral(
        "Vehículos y ventas actualizados correctamente."
      );
    } else {
      setMensajeGeneral(
        "Consulta finalizada. Revisa los resultados y errores."
      );
    }

    setCargando(false);
  }

  function limpiarSesion() {
    setJwt("");
    setMostrarJwt(false);
    setVehiculos([]);
    setVentas([]);
    setCompradores([]);
    setCargado({
      vehiculos: false,
      ventas: false,
      compradores: false,
    });
    setErrores({
      vehiculos: "",
      ventas: "",
      compradores: "",
    });
    setMensajeGeneral("JWT y resultados limpiados.");
    setUltimaConsulta("");
    setVehiculoSeleccionado(null);
  }

  useEffect(() => {
    function cerrarConEscape(evento) {
      if (evento.key === "Escape") {
        setVehiculoSeleccionado(null);
      }
    }

    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, []);

  return (
    <div className="aplicacion">
      <aside className="barra-lateral">
        <div className="marca">
          <div className="marca-icono">🚘</div>
          <div>
            <strong>AutoVenta</strong>
            <span>Panel web React</span>
          </div>
        </div>

        <p className="menu-titulo">CONSULTAS</p>

        <nav className="menu">
          <button
            type="button"
            className={seccion === "vehiculos" ? "activo" : ""}
            onClick={() => setSeccion("vehiculos")}
          >
            <span aria-hidden="true">🚙</span>
            Vehículos
          </button>

          <button
            type="button"
            className={seccion === "ventas" ? "activo" : ""}
            onClick={() => setSeccion("ventas")}
          >
            <span aria-hidden="true">▤</span>
            Ventas
          </button>
        </nav>

        <div className="lateral-pie">
          <span className="punto-conexion"></span>
          API mediante NGINX
          <small>Puerto 8090</small>
        </div>
      </aside>

      <div className="area-principal">
        <header className="barra-superior">
          <div>
            <span className="etiqueta-superior">
              APLICACIONES ORIENTADAS A SERVICIOS
            </span>
            <h1>Panel de consultas</h1>
            <p>Información obtenida de Java Spring Boot y FastAPI.</p>
          </div>

          <span className="encabezado-icono" aria-hidden="true">
            📊
          </span>
        </header>

        <main className="contenido">
          <section className="acceso">
            <div className="acceso-titulo">
              <div>
                <h2>Acceso a los servicios</h2>
                <p>
                  Introduce un JWT autorizado para consultar
                  los registros.
                </p>
              </div>
              <span className="acceso-icono" aria-hidden="true">
                🔐
              </span>
            </div>

            <form
              className="formulario-token"
              onSubmit={consultarServicios}
            >
              <div className="campo-token">
                <label htmlFor="jwt">Token JWT</label>

                <div className="entrada-token">
                  <input
                    id="jwt"
                    type={mostrarJwt ? "text" : "password"}
                    value={jwt}
                    onChange={(e) => setJwt(e.target.value)}
                    placeholder="Pega aquí tu token de acceso"
                    autoComplete="off"
                    spellCheck="false"
                  />

                  <button
                    type="button"
                    className="mostrar-token"
                    onClick={() => setMostrarJwt(!mostrarJwt)}
                  >
                    {mostrarJwt ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="boton boton-primario"
                disabled={cargando}
              >
                {cargando ? "Consultando..." : "Consultar servicios"}
              </button>

              <button
                type="button"
                className="boton boton-secundario"
                onClick={limpiarSesion}
                disabled={cargando}
              >
                Limpiar
              </button>
            </form>

            <div className="acceso-estado">
              <span>{mensajeGeneral || "Listo para consultar."}</span>
              <span>
                {ultimaConsulta
                  ? `Actualizado: ${ultimaConsulta}`
                  : "Sin consultas recientes"}
              </span>
            </div>
          </section>

          <section className="indicadores">
            <Indicador
              icono="🚙"
              titulo="Vehículos"
              valor={cargado.vehiculos ? vehiculos.length : "—"}
              descripcion="Total registrado"
            />

            <Indicador
              icono="✅"
              titulo="Disponibles"
              valor={cargado.vehiculos ? disponibles : "—"}
              descripcion="Aptos para venta"
            />

            <Indicador
              icono="▤"
              titulo="Ventas"
              valor={cargado.ventas ? ventas.length : "—"}
              descripcion="Registros visibles"
            />

            <Indicador
              icono="👥"
              titulo="Compradores"
              valor={
                cargado.compradores
                  ? compradores.length
                  : "—"
              }
              descripcion="Registros consultados"
            />
          </section>

          {cargado.vehiculos && (
            <section className="resumen">
              <div className="resumen-cabecera">
                <div>
                  <strong>Disponibilidad de vehículos</strong>
                  <p>
                    {disponibles} disponibles de {vehiculos.length} vehículos
                  </p>
                </div>
                <span>{porcentajeDisponibles}%</span>
              </div>

              <div className="barra-progreso">
                <div
                  style={{ width: `${porcentajeDisponibles}%` }}
                ></div>
              </div>
            </section>
          )}

          {seccion === "vehiculos" && (
            <section className="seccion-datos">
              <div className="seccion-titulo">
                <div>
                  <span className="subtitulo">CATÁLOGO</span>
                  <h2>Vehículos registrados</h2>
                  <p>
                    Busca por marca, modelo, placa, ID o estado.
                  </p>
                </div>

                <span className="contador">
                  {cargado.vehiculos
                    ? `${vehiculosFiltrados.length} de ${vehiculos.length}`
                    : "Sin consultar"}
                </span>
              </div>

              <div className="filtros">
                <div className="control-busqueda">
                  <label htmlFor="buscarVehiculo">
                    Buscar vehículo
                  </label>
                  <input
                    id="buscarVehiculo"
                    type="search"
                    value={busquedaVehiculos}
                    onChange={(e) =>
                      setBusquedaVehiculos(e.target.value)
                    }
                    placeholder="Ej. Toyota, ABC123, 31..."
                  />
                </div>

                <div className="control-filtro">
                  <label htmlFor="filtrarEstado">
                    Estado
                  </label>

                  <select
                    id="filtrarEstado"
                    value={estadoVehiculo}
                    onChange={(e) =>
                      setEstadoVehiculo(e.target.value)
                    }
                  >
                    <option value="TODOS">Todos</option>

                    {estadosVehiculos.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="boton boton-secundario"
                  onClick={() => {
                    setBusquedaVehiculos("");
                    setEstadoVehiculo("TODOS");
                  }}
                >
                  Limpiar filtros
                </button>
              </div>

              {cargando && (
                <div className="mensaje informacion">
                  Consultando vehículos...
                </div>
              )}

              <Aviso
                error={errores.vehiculos}
                cargado={cargado.vehiculos}
                vacio={vehiculosFiltrados.length === 0}
              />

              {cargado.vehiculos &&
                vehiculosFiltrados.length > 0 && (
                  <div className="tabla-contenedor">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Vehículo</th>
                          <th>Placa</th>
                          <th>Año</th>
                          <th>Precio</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>

                      <tbody>
                        {vehiculosFiltrados.map((v, i) => (
                          <tr key={`${idVehiculo(v) ?? i}`}>
                            <td data-label="ID">
                              {texto(idVehiculo(v))}
                            </td>

                            <td data-label="Vehículo">
                              <strong>{nombreVehiculo(v)}</strong>
                            </td>

                            <td data-label="Placa">
                              {texto(v.placa)}
                            </td>

                            <td data-label="Año">
                              {texto(v.anio)}
                            </td>

                            <td data-label="Precio">
                              {precio(v.precio)}
                            </td>

                            <td data-label="Estado">
                              <span
                                className={`estado ${claseEstado(v.estado)}`}
                              >
                                {texto(v.estado)}
                              </span>
                            </td>

                            <td data-label="Acción">
                              <button
                                type="button"
                                className="boton-detalle"
                                onClick={() =>
                                  setVehiculoSeleccionado(v)
                                }
                              >
                                Ver detalle
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          )}

          {seccion === "ventas" && (
            <section className="seccion-datos">
              <div className="seccion-titulo">
                <div>
                  <span className="subtitulo">HISTORIAL</span>
                  <h2>Ventas registradas</h2>
                  <p>
                    Consultas de ventas desde FastAPI.
                  </p>
                </div>

                <span className="contador">
                  {cargado.ventas
                    ? `${ventasFiltradas.length} de ${ventas.length}`
                    : "Sin consultar"}
                </span>
              </div>

              {errores.compradores && (
                <div className="mensaje informacion">
                  No se pudieron consultar los compradores.
                  Se mostrarán los identificadores disponibles.
                </div>
              )}

              <div className="filtros">
                <div className="control-busqueda">
                  <label htmlFor="buscarVenta">
                    Buscar venta
                  </label>

                  <input
                    id="buscarVenta"
                    type="search"
                    value={busquedaVentas}
                    onChange={(e) =>
                      setBusquedaVentas(e.target.value)
                    }
                    placeholder="ID, placa, marca, comprador..."
                  />
                </div>

                <div className="control-filtro">
                  <label htmlFor="estadoVenta">
                    Estado de venta
                  </label>

                  <select
                    id="estadoVenta"
                    value={estadoVenta}
                    onChange={(e) =>
                      setEstadoVenta(e.target.value)
                    }
                  >
                    <option value="TODOS">Todos</option>

                    {estadosVentas.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="boton boton-secundario"
                  onClick={() => {
                    setBusquedaVentas("");
                    setEstadoVenta("TODOS");
                  }}
                >
                  Limpiar filtros
                </button>
              </div>

              {cargando && (
                <div className="mensaje informacion">
                  Consultando ventas...
                </div>
              )}

              <Aviso
                error={errores.ventas}
                cargado={cargado.ventas}
                vacio={ventasFiltradas.length === 0}
              />

              {cargado.ventas &&
                ventasFiltradas.length > 0 && (
                  <div className="tabla-contenedor">
                    <table>
                      <thead>
                        <tr>
                          <th>Venta</th>
                          <th>Vehículo</th>
                          <th>Placa</th>
                          <th>Comprador</th>
                          <th>Precio</th>
                          <th>Estado</th>
                          <th>Notificación</th>
                        </tr>
                      </thead>

                      <tbody>
                        {ventasFiltradas.map((v, i) => {
                          const vehiculo = mapaVehiculos.get(
                            String(vehiculoIdVenta(v))
                          );

                          const comprador = mapaCompradores.get(
                            String(compradorIdVenta(v))
                          );

                          return (
                            <tr key={`${idVenta(v) ?? i}`}>
                              <td data-label="Venta">
                                <strong>#{texto(idVenta(v))}</strong>
                              </td>

                              <td data-label="Vehículo">
                                {vehiculo
                                  ? nombreVehiculo(vehiculo)
                                  : `ID ${texto(vehiculoIdVenta(v))}`}
                              </td>

                              <td data-label="Placa">
                                {texto(vehiculo?.placa)}
                              </td>

                              <td data-label="Comprador">
                                {texto(
                                  comprador?.nombre ??
                                  `ID ${texto(compradorIdVenta(v))}`
                                )}
                              </td>

                              <td data-label="Precio">
                                {precio(
                                  v.precioAcordado ?? v.precio
                                )}
                              </td>

                              <td data-label="Estado">
                                <span
                                  className={`estado ${claseEstado(v.estado)}`}
                                >
                                  {texto(v.estado)}
                                </span>
                              </td>

                              <td data-label="Notificación">
                                {texto(
                                  v.notificacion ??
                                  v.estadoNotificacion
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          )}
        </main>
      </div>

      {vehiculoSeleccionado && (
        <div
          className="modal-fondo"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setVehiculoSeleccionado(null);
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloDetalle"
          >
            <div className="modal-superior">
              <div>
                <span className="subtitulo">DETALLE DEL VEHÍCULO</span>
                <h2 id="tituloDetalle">
                  {nombreVehiculo(vehiculoSeleccionado)}
                </h2>
              </div>

              <button
                type="button"
                className="cerrar-modal"
                aria-label="Cerrar detalle"
                onClick={() =>
                  setVehiculoSeleccionado(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-datos">
              <FilaDetalle
                nombre="ID"
                valor={idVehiculo(vehiculoSeleccionado)}
              />
              <FilaDetalle
                nombre="Marca"
                valor={vehiculoSeleccionado.marca}
              />
              <FilaDetalle
                nombre="Modelo"
                valor={vehiculoSeleccionado.modelo}
              />
              <FilaDetalle
                nombre="Placa"
                valor={vehiculoSeleccionado.placa}
              />
              <FilaDetalle
                nombre="Chasis"
                valor={vehiculoSeleccionado.chasis}
              />
              <FilaDetalle
                nombre="Año"
                valor={vehiculoSeleccionado.anio}
              />
              <FilaDetalle
                nombre="Color"
                valor={vehiculoSeleccionado.color}
              />
              <FilaDetalle
                nombre="Precio"
                valor={precio(vehiculoSeleccionado.precio)}
              />
              <FilaDetalle
                nombre="Estado"
                valor={vehiculoSeleccionado.estado}
              />
            </div>

            <button
              type="button"
              className="boton boton-primario modal-boton"
              onClick={() => setVehiculoSeleccionado(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
