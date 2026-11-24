
import {
  iniciarSesion,
  cerrarSesion,
  listarVehiculos,
  listarCompradores,
  listarVentas,
  registrarVenta,
  consultarVenta,
} from './api.js';

const $ = (selector) => document.querySelector(selector);

const dinero = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
});

const datos = {
  vehiculos: [],
  compradores: [],
  ventas: [],
  cargados: {
    vehiculos: false,
    compradores: false,
    ventas: false,
  },
  errores: {
    vehiculos: '',
    compradores: '',
    ventas: '',
  },
};

let intentoPendiente = null;
let generacionSesion = 0;

// ==========================================
// DATOS Y NORMALIZACIÓN
// ==========================================

function valor(item) {
  return item === undefined || item === null || item === ''
    ? '—'
    : String(item);
}

function normalizar(item) {
  return String(item ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function coincideBusqueda(busqueda, ...valores) {
  const palabras = normalizar(busqueda)
    .split(/\s+/)
    .filter(Boolean);

  if (!palabras.length) return true;

  const contenido = normalizar(valores.join(' '));

  return palabras.every((palabra) =>
    contenido.includes(palabra)
  );
}

function idVehiculo(v) {
  return v?.idVehiculo ??
    v?.id_vehiculo ??
    v?.vehiculoId ??
    v?.id;
}

function idComprador(c) {
  return c?.id ??
    c?.idComprador ??
    c?.compradorId ??
    c?.id_comprador;
}

function idVenta(v) {
  return v?.id ??
    v?.idVenta ??
    v?.ventaId;
}

function vehiculoDeVenta(v) {
  return v?.vehiculoId ??
    v?.idVehiculo ??
    v?.vehiculo_id;
}

function compradorDeVenta(v) {
  return v?.compradorId ??
    v?.idComprador ??
    v?.comprador_id;
}

function nombreVehiculo(v) {
  if (!v) return 'Vehículo no disponible';

  return [
    v.marca,
    v.modelo,
  ].filter(Boolean).join(' ') || 'Vehículo';
}

function disponible(v) {
  return normalizar(v?.estado) === 'disponible';
}

function precio(valorPrecio) {
  if (
    valorPrecio === undefined ||
    valorPrecio === null ||
    valorPrecio === ''
  ) {
    return '—';
  }

  const numero = Number(valorPrecio);

  return Number.isFinite(numero)
    ? dinero.format(numero)
    : valor(valorPrecio);
}

function fechaLegible(fecha) {
  if (!fecha) return '—';

  const convertida = new Date(fecha);

  return Number.isNaN(convertida.getTime())
    ? valor(fecha)
    : convertida.toLocaleString('es-EC');
}

function estadoVenta(v) {
  return String(v?.estado ?? 'SIN ESTADO').toUpperCase();
}

function notificacionVenta(v) {
  return v?.notificacion ??
    v?.estadoNotificacion ??
    '—';
}

function colorEstado(estado) {
  const e = normalizar(estado);

  if (['completada', 'completado', 'disponible'].includes(e)) {
    return 'success';
  }

  if (['en_revision', 'pendiente', 'en proceso'].includes(e)) {
    return 'warning';
  }

  return 'neutral';
}

function buscarVehiculoPorId(id) {
  return datos.vehiculos.find(
    (v) => String(idVehiculo(v)) === String(id)
  );
}

function buscarCompradorPorId(id) {
  return datos.compradores.find(
    (c) => String(idComprador(c)) === String(id)
  );
}

function ventasDelComprador(id) {
  return datos.ventas.filter(
    (v) => String(compradorDeVenta(v)) === String(id)
  );
}

function ventasOrdenadas() {
  return [...datos.ventas].sort(
    (a, b) =>
      Number(idVenta(b) ?? 0) -
      Number(idVenta(a) ?? 0)
  );
}

// ==========================================
// CREACIÓN SEGURA DE ELEMENTOS
// ==========================================

function elemento(tag, clase = '', contenido) {
  const nodo = document.createElement(tag);

  if (clase) nodo.className = clase;

  if (contenido !== undefined) {
    nodo.textContent = String(contenido);
  }

  return nodo;
}

function boton(textoBoton, clase, accion) {
  const control = elemento('button', clase, textoBoton);
  control.type = 'button';
  control.addEventListener('click', accion);
  return control;
}

function campoDetalle(etiqueta, contenido) {
  const caja = elemento('div', 'detail-item');

  caja.append(
    elemento('span', 'detail-label', etiqueta),
    elemento('strong', 'detail-value', valor(contenido))
  );

  return caja;
}

function insignia(textoInsignia, tipo = 'neutral') {
  return elemento(
    'span',
    `badge ${tipo}`,
    textoInsignia
  );
}

function mensaje(selector, contenido, tipo = 'info') {
  const caja = $(selector);

  caja.textContent = contenido;
  caja.className = `notice ${tipo}`;
  caja.classList.remove('hidden');
}

function ocultarMensaje(selector) {
  $(selector).classList.add('hidden');
}

function ocupado(control, activo, textoNormal, textoOcupado) {
  control.disabled = activo;
  control.textContent = activo
    ? textoOcupado
    : textoNormal;
}

function vacio(titulo, descripcion = '') {
  const caja = elemento('div', 'empty-state');

  caja.append(
    elemento('div', 'empty-icon', '⌕'),
    elemento('strong', '', titulo)
  );

  if (descripcion) {
    caja.append(elemento('p', '', descripcion));
  }

  return caja;
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function abrirSeccion(seccion) {
  document.querySelectorAll('[data-tab]').forEach(
    (control) => {
      const activa = control.dataset.tab === seccion;

      control.classList.toggle('active', activa);
      control.setAttribute('aria-selected', String(activa));
    }
  );

  document.querySelectorAll('[data-panel]').forEach(
    (panel) => {
      panel.classList.toggle(
        'hidden',
        panel.dataset.panel !== seccion
      );
    }
  );
}

function mostrarAplicacion(usuario) {
  $('#currentUser').textContent = usuario;
  $('#loginPassword').value = '';

  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  $('#logoutButton').classList.remove('hidden');

  abrirSeccion('catalog');
}

function salir() {
  generacionSesion++;
  cerrarSesion();

  datos.vehiculos = [];
  datos.compradores = [];
  datos.ventas = [];

  for (const tipo of Object.keys(datos.cargados)) {
    datos.cargados[tipo] = false;
    datos.errores[tipo] = '';
  }

  intentoPendiente = null;

  $('#loginPassword').value = '';
  $('#saleResult').classList.add('hidden');
  $('#statusResult').classList.add('hidden');

  $('#loginView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
  $('#logoutButton').classList.add('hidden');

  ocultarMensaje('#loginMessage');
  ocultarMensaje('#appMessage');
  ocultarMensaje('#saleMessage');
  ocultarMensaje('#statusMessage');

  $('#loginUser').focus();
}

// ==========================================
// TOTALES Y CARGA DESDE LAS API
// ==========================================

function actualizarTotales() {
  $('#vehiclesTotal').textContent =
    datos.cargados.vehiculos
      ? datos.vehiculos.length
      : '—';

  $('#availableTotal').textContent =
    datos.cargados.vehiculos
      ? datos.vehiculos.filter(disponible).length
      : '—';

  $('#buyersTotal').textContent =
    datos.cargados.compradores
      ? datos.compradores.length
      : '—';

  $('#salesTotal').textContent =
    datos.cargados.ventas
      ? datos.ventas.length
      : '—';
}

async function cargarDatos({ silencioso = false } = {}) {
  const generacion = generacionSesion;
  const actualizar = $('#refreshButton');

  ocupado(
    actualizar,
    true,
    'Actualizar datos',
    'Actualizando...'
  );

  const resultados = await Promise.allSettled([
    listarVehiculos(),
    listarCompradores(),
    listarVentas(),
  ]);

  if (generacion !== generacionSesion) return;

  const tipos = ['vehiculos', 'compradores', 'ventas'];
  const problemas = [];

  resultados.forEach((resultado, indice) => {
    const tipo = tipos[indice];

    if (resultado.status === 'fulfilled') {
      datos[tipo] = resultado.value[tipo];
      datos.cargados[tipo] = true;
      datos.errores[tipo] = '';
    } else {
      datos[tipo] = [];
      datos.cargados[tipo] = false;
      datos.errores[tipo] = resultado.reason.message;
      problemas.push(
        `${tipo}: ${resultado.reason.message}`
      );
    }
  });

  actualizarTotales();
  llenarSelectores();
  pintarVehiculos();
  pintarCompradores();
  pintarVentas();

  if (problemas.length) {
    mensaje(
      '#appMessage',
      problemas.join(' | '),
      'error'
    );
  } else if (!silencioso) {
    mensaje(
      '#appMessage',
      'Información actualizada correctamente.',
      'success'
    );
  } else {
    ocultarMensaje('#appMessage');
  }

  ocupado(
    actualizar,
    false,
    'Actualizar datos',
    'Actualizando...'
  );
}

// ==========================================
// CATÁLOGO DE VEHÍCULOS
// ==========================================

function pintarVehiculos() {
  const contenedor = $('#vehicleList');
  contenedor.replaceChildren();

  if (!datos.cargados.vehiculos) {
    $('#vehicleCount').textContent = 'Sin datos';
    contenedor.append(
      vacio(
        'No se pudo cargar el catálogo',
        datos.errores.vehiculos
      )
    );
    return;
  }

  const busqueda = $('#vehicleSearch').value;
  const filtro = $('#vehicleFilter').value;

  const lista = datos.vehiculos.filter((v) => {
    const cumpleFiltro =
      filtro === 'all' ||
      (filtro === 'available' && disponible(v)) ||
      (filtro === 'unavailable' && !disponible(v));

    return cumpleFiltro && coincideBusqueda(
      busqueda,
      idVehiculo(v),
      v.marca,
      v.modelo,
      v.placa,
      v.chasis,
      v.anio,
      v.color,
      v.estado
    );
  });

  $('#vehicleCount').textContent =
    `${lista.length} de ${datos.vehiculos.length}`;

  if (!lista.length) {
    contenedor.append(
      vacio(
        'No se encontraron vehículos',
        'Prueba con otra marca, modelo, placa o ID.'
      )
    );
    return;
  }

  for (const v of lista) {
    const tarjeta = elemento('article', 'record-card vehicle-card');

    const superior = elemento('div', 'card-top');
    superior.append(
      elemento('span', 'record-icon', '🚙'),
      insignia(
        valor(v.estado),
        colorEstado(v.estado)
      )
    );

    tarjeta.append(
      superior,
      elemento('h3', '', nombreVehiculo(v)),
      elemento(
        'p',
        'record-subtitle',
        `Placa: ${valor(v.placa)} · ID ${valor(idVehiculo(v))}`
      )
    );

    const detalles = elemento('div', 'detail-grid');

    detalles.append(
      campoDetalle('Año', v.anio),
      campoDetalle('Color', v.color)
    );

    tarjeta.append(detalles);

    const pie = elemento('div', 'record-footer');
    pie.append(
      elemento('strong', 'price', precio(v.precio))
    );

    const elegir = boton(
      'Seleccionar',
      'button primary compact',
      () => {
        $('#saleVehicle').value =
          String(idVehiculo(v));

        actualizarResumen();
        abrirSeccion('sale');
      }
    );

    elegir.disabled =
      !disponible(v) || idVehiculo(v) == null;

    pie.append(elegir);
    tarjeta.append(pie);
    contenedor.append(tarjeta);
  }
}

// ==========================================
// LISTADO DE COMPRADORES
// ==========================================

function pintarCompradores() {
  const contenedor = $('#buyerList');
  contenedor.replaceChildren();

  if (!datos.cargados.compradores) {
    $('#buyerCount').textContent = 'Sin datos';

    contenedor.append(
      vacio(
        'No se pudieron consultar compradores',
        datos.errores.compradores
      )
    );

    return;
  }

  const busqueda = $('#buyerSearch').value;

  const lista = datos.compradores.filter((c) => {
    const relacionadas = datos.cargados.ventas
      ? ventasDelComprador(idComprador(c))
      : [];

    const automoviles = relacionadas.flatMap((venta) => {
      const v = buscarVehiculoPorId(vehiculoDeVenta(venta));

      return [
        idVenta(venta),
        vehiculoDeVenta(venta),
        v?.marca,
        v?.modelo,
        v?.placa,
      ];
    });

    return coincideBusqueda(
      busqueda,
      idComprador(c),
      c.documento,
      c.cedula,
      c.nombre,
      c.correo,
      c.email,
      ...automoviles
    );
  });

  $('#buyerCount').textContent =
    `${lista.length} de ${datos.compradores.length}`;

  if (!lista.length) {
    contenedor.append(
      vacio(
        'No se encontraron compradores',
        'Busca por nombre, documento, correo o vehículo asociado.'
      )
    );
    return;
  }

  for (const c of lista) {
    const tarjeta = elemento('article', 'record-card');

    const relacionadas = datos.cargados.ventas
      ? ventasDelComprador(idComprador(c))
      : [];

    const superior = elemento('div', 'card-top');

    superior.append(
      elemento('span', 'record-icon buyer-icon', '👤'),
      insignia(`ID ${valor(idComprador(c))}`)
    );

    tarjeta.append(
      superior,
      elemento('h3', '', valor(c.nombre)),
      elemento('p', 'record-subtitle', valor(c.correo ?? c.email))
    );

    const detalles = elemento('div', 'detail-grid');

    detalles.append(
      campoDetalle('Documento', c.documento ?? c.cedula),
      campoDetalle(
        'Ventas visibles',
        datos.cargados.ventas
          ? relacionadas.length
          : 'Sin consultar'
      )
    );

    tarjeta.append(detalles);

    if (relacionadas.length) {
      const nombres = relacionadas.slice(0, 3).map((venta) => {
        const v = buscarVehiculoPorId(
          vehiculoDeVenta(venta)
        );

        return v
          ? `${nombreVehiculo(v)} · ${valor(v.placa)}`
          : `Vehículo ID ${valor(vehiculoDeVenta(venta))}`;
      });

      tarjeta.append(
        elemento(
          'p',
          'linked-info',
          `Vehículos asociados: ${nombres.join(' | ')}`
        )
      );
    }

    const pie = elemento('div', 'record-footer');

    pie.append(
      elemento('span', 'record-hint', 'Comprador registrado')
    );

    const elegir = boton(
      'Elegir comprador',
      'button secondary compact',
      () => {
        $('#saleBuyer').value =
          String(idComprador(c));

        actualizarResumen();
        abrirSeccion('sale');
      }
    );

    elegir.disabled = idComprador(c) == null;

    pie.append(elegir);
    tarjeta.append(pie);
    contenedor.append(tarjeta);
  }
}

// ==========================================
// LISTADO DE VENTAS
// ==========================================

function pintarVentas() {
  const contenedor = $('#salesList');
  contenedor.replaceChildren();

  if (!datos.cargados.ventas) {
    $('#salesCount').textContent = 'Sin datos';

    contenedor.append(
      vacio(
        'No se pudo consultar el historial',
        datos.errores.ventas
      )
    );

    return;
  }

  const busqueda = $('#salesSearch').value;
  const filtro = $('#salesFilter').value;

  const lista = ventasOrdenadas().filter((venta) => {
    const estado = estadoVenta(venta);

    const cumpleFiltro =
      filtro === 'all' ||
      estado === filtro ||
      (
        filtro === 'other' &&
        !['COMPLETADA', 'EN_REVISION'].includes(estado)
      );

    const vehiculo = buscarVehiculoPorId(
      vehiculoDeVenta(venta)
    );

    const comprador = buscarCompradorPorId(
      compradorDeVenta(venta)
    );

    const cumpleBusqueda = coincideBusqueda(
      busqueda,
      idVenta(venta),
      vehiculoDeVenta(venta),
      compradorDeVenta(venta),
      venta.estado,
      notificacionVenta(venta),
      venta.operacionId,
      vehiculo?.marca,
      vehiculo?.modelo,
      vehiculo?.placa,
      vehiculo?.anio,
      comprador?.nombre,
      comprador?.documento,
      comprador?.cedula,
      comprador?.correo
    );

    return cumpleFiltro && cumpleBusqueda;
  });

  $('#salesCount').textContent =
    `${lista.length} de ${datos.ventas.length}`;

  if (!lista.length) {
    contenedor.append(
      vacio(
        'No se encontraron ventas',
        'Busca por placa, marca, comprador, documento, ID o estado.'
      )
    );
    return;
  }

  for (const venta of lista) {
    const vehiculo = buscarVehiculoPorId(
      vehiculoDeVenta(venta)
    );

    const comprador = buscarCompradorPorId(
      compradorDeVenta(venta)
    );

    const tarjeta = elemento('article', 'record-card sale-card');

    const superior = elemento('div', 'card-top');

    superior.append(
      elemento(
        'strong',
        'sale-number',
        `Venta #${valor(idVenta(venta))}`
      ),
      insignia(
        estadoVenta(venta),
        colorEstado(venta.estado)
      )
    );

    tarjeta.append(
      superior,
      elemento(
        'h3',
        '',
        vehiculo
          ? nombreVehiculo(vehiculo)
          : `Vehículo ID ${valor(vehiculoDeVenta(venta))}`
      )
    );

    tarjeta.append(
      elemento(
        'p',
        'record-subtitle',
        vehiculo
          ? `Placa: ${valor(vehiculo.placa)}`
          : `ID de vehículo: ${valor(vehiculoDeVenta(venta))}`
      )
    );

    const detalles = elemento('div', 'detail-grid');

    detalles.append(
      campoDetalle(
        'Comprador',
        comprador?.nombre ??
        `ID ${valor(compradorDeVenta(venta))}`
      ),
      campoDetalle(
        'Documento',
        comprador?.documento ?? comprador?.cedula
      ),
      campoDetalle(
        'Precio',
        precio(venta.precioAcordado ?? venta.precio)
      ),
      campoDetalle(
        'Notificación',
        notificacionVenta(venta)
      )
    );

    tarjeta.append(detalles);

    const pie = elemento('div', 'record-footer');

    pie.append(
      elemento(
        'span',
        'record-hint',
        fechaLegible(
          venta.fechaUTC ??
          venta.fechaUtc ??
          venta.fecha
        )
      )
    );

    const ver = boton(
      'Ver detalle',
      'button secondary compact',
      () => verDetalleVenta(idVenta(venta))
    );

    ver.disabled = idVenta(venta) == null;

    pie.append(ver);
    tarjeta.append(pie);
    contenedor.append(tarjeta);
  }
}

// ==========================================
// SELECTORES Y RESUMEN
// ==========================================

function llenarSelectores() {
  const selectVehiculo = $('#saleVehicle');
  const selectComprador = $('#saleBuyer');

  const anteriorVehiculo = selectVehiculo.value;
  const anteriorComprador = selectComprador.value;

  selectVehiculo.replaceChildren(
    new Option('Selecciona un vehículo', '')
  );

  selectComprador.replaceChildren(
    new Option('Selecciona un comprador', '')
  );

  for (const v of datos.vehiculos.filter(disponible)) {
    if (idVehiculo(v) == null) continue;

    selectVehiculo.add(
      new Option(
        `${nombreVehiculo(v)} · ${valor(v.placa)} · ${precio(v.precio)}`,
        String(idVehiculo(v))
      )
    );
  }

  for (const c of datos.compradores) {
    if (idComprador(c) == null) continue;

    selectComprador.add(
      new Option(
        `${valor(c.nombre)} · ${valor(c.documento ?? c.cedula)}`,
        String(idComprador(c))
      )
    );
  }

  if (
    [...selectVehiculo.options].some(
      (o) => o.value === anteriorVehiculo
    )
  ) {
    selectVehiculo.value = anteriorVehiculo;
  }

  if (
    [...selectComprador.options].some(
      (o) => o.value === anteriorComprador
    )
  ) {
    selectComprador.value = anteriorComprador;
  }

  actualizarResumen();
}

function actualizarResumen() {
  const vehiculo = buscarVehiculoPorId(
    $('#saleVehicle').value
  );

  const comprador = buscarCompradorPorId(
    $('#saleBuyer').value
  );

  $('#saleSummary').textContent =
    vehiculo && comprador
      ? `${nombreVehiculo(vehiculo)} · Placa ${
          valor(vehiculo.placa)
        } · ${valor(comprador.nombre)} · ${
          precio(vehiculo.precio)
        }`
      : 'Selecciona un vehículo disponible y un comprador.';
}

// ==========================================
// CONSULTA DE VENTA POR ID
// ==========================================

function pintarDetalle(selector, venta, codigoHttp) {
  const contenedor = $(selector);

  contenedor.replaceChildren();
  contenedor.classList.remove('hidden');

  const vehiculo = buscarVehiculoPorId(
    vehiculoDeVenta(venta)
  );

  const comprador = buscarCompradorPorId(
    compradorDeVenta(venta)
  );

  const superior = elemento('div', 'result-heading');

  superior.append(
    elemento(
      'h3',
      '',
      `Venta #${valor(idVenta(venta))}`
    ),
    insignia(`HTTP ${codigoHttp}`, 'success')
  );

  contenedor.append(superior);

  const campos = elemento('div', 'detail-grid');

  campos.append(
    campoDetalle('Estado', estadoVenta(venta)),
    campoDetalle('Notificación', notificacionVenta(venta)),
    campoDetalle(
      'Vehículo',
      vehiculo
        ? nombreVehiculo(vehiculo)
        : `ID ${valor(vehiculoDeVenta(venta))}`
    ),
    campoDetalle('Placa', vehiculo?.placa),
    campoDetalle(
      'Comprador',
      comprador?.nombre ??
      `ID ${valor(compradorDeVenta(venta))}`
    ),
    campoDetalle(
      'Documento',
      comprador?.documento ?? comprador?.cedula
    ),
    campoDetalle(
      'Precio',
      precio(venta.precioAcordado ?? venta.precio)
    ),
    campoDetalle('Moneda', venta.moneda),
    campoDetalle('Operación', venta.operacionId),
    campoDetalle(
      'Fecha',
      fechaLegible(
        venta.fechaUTC ?? venta.fechaUtc ?? venta.fecha
      )
    )
  );

  contenedor.append(campos);
}

async function consultarPorId(id) {
  const control = $('#statusButton');

  ocupado(control, true, 'Consultar estado', 'Consultando...');
  ocultarMensaje('#statusMessage');

  try {
    const { codigoHttp, venta } =
      await consultarVenta(id);

    pintarDetalle('#statusResult', venta, codigoHttp);

    mensaje(
      '#statusMessage',
      `HTTP ${codigoHttp}: venta consultada correctamente.`,
      'success'
    );
  } catch (error) {
    $('#statusResult').classList.add('hidden');

    mensaje('#statusMessage', error.message, 'error');
  } finally {
    ocupado(control, false, 'Consultar estado', 'Consultando...');
  }
}

async function verDetalleVenta(id) {
  $('#saleIdInput').value = String(id);
  abrirSeccion('status');
  await consultarPorId(id);
}

// ==========================================
// AUTENTICACIÓN
// ==========================================

$('#loginForm').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const usuario = $('#loginUser').value.trim();
  const contrasena = $('#loginPassword').value;

  if (!usuario || !contrasena) {
    mensaje(
      '#loginMessage',
      'Ingresa usuario y contraseña.',
      'error'
    );
    return;
  }

  const control = $('#loginButton');
  ocupado(control, true, 'Ingresar', 'Ingresando...');
  ocultarMensaje('#loginMessage');

  try {
    await iniciarSesion(usuario, contrasena);

    generacionSesion++;
    mostrarAplicacion(usuario);
    await cargarDatos();
  } catch (error) {
    mensaje('#loginMessage', error.message, 'error');
  } finally {
    ocupado(control, false, 'Ingresar', 'Ingresando...');
  }
});

$('#togglePassword').addEventListener('click', () => {
  const entrada = $('#loginPassword');
  const mostrar = entrada.type === 'password';

  entrada.type = mostrar ? 'text' : 'password';

  $('#togglePassword').textContent =
    mostrar ? 'Ocultar' : 'Mostrar';

  $('#togglePassword').setAttribute(
    'aria-pressed',
    String(mostrar)
  );
});

$('#logoutButton').addEventListener('click', salir);

// ==========================================
// EVENTOS DE BÚSQUEDA
// ==========================================

$('#refreshButton').addEventListener('click', () =>
  cargarDatos()
);

$('#vehicleSearch').addEventListener('input', pintarVehiculos);
$('#vehicleFilter').addEventListener('change', pintarVehiculos);

$('#buyerSearch').addEventListener('input', pintarCompradores);

$('#salesSearch').addEventListener('input', pintarVentas);
$('#salesFilter').addEventListener('change', pintarVentas);

$('#clearVehicleSearch').addEventListener('click', () => {
  $('#vehicleSearch').value = '';
  $('#vehicleFilter').value = 'all';
  pintarVehiculos();
});

$('#clearBuyerSearch').addEventListener('click', () => {
  $('#buyerSearch').value = '';
  pintarCompradores();
});

$('#clearSalesSearch').addEventListener('click', () => {
  $('#salesSearch').value = '';
  $('#salesFilter').value = 'all';
  pintarVentas();
});

$('#saleVehicle').addEventListener('change', actualizarResumen);
$('#saleBuyer').addEventListener('change', actualizarResumen);

document.querySelectorAll('[data-tab]').forEach((control) => {
  control.addEventListener('click', () =>
    abrirSeccion(control.dataset.tab)
  );
});

// ==========================================
// REGISTRO DE VENTA
// ==========================================

$('#saleForm').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const vehiculoId = Number($('#saleVehicle').value);
  const compradorId = Number($('#saleBuyer').value);

  if (
    !Number.isInteger(vehiculoId) ||
    vehiculoId < 1 ||
    !Number.isInteger(compradorId) ||
    compradorId < 1
  ) {
    mensaje(
      '#saleMessage',
      'Selecciona un vehículo y un comprador válidos.',
      'error'
    );
    return;
  }

  const vehiculo = buscarVehiculoPorId(vehiculoId);
  const comprador = buscarCompradorPorId(compradorId);

  if (!vehiculo || !disponible(vehiculo) || !comprador) {
    mensaje(
      '#saleMessage',
      'La selección ya no es válida. Actualiza los datos.',
      'error'
    );
    return;
  }

  if (!intentoPendiente ||
      intentoPendiente.vehiculoId !== vehiculoId ||
      intentoPendiente.compradorId !== compradorId) {
    intentoPendiente = {
      vehiculoId,
      compradorId,
      clave: crypto.randomUUID(),
    };
  }

  const confirmar = window.confirm(
    `¿Registrar la venta de ${nombreVehiculo(vehiculo)} ` +
    `(${valor(vehiculo.placa)}) a ${valor(comprador.nombre)}?`
  );

  if (!confirmar) return;

  const control = $('#saleButton');

  ocupado(control, true, 'Registrar venta', 'Registrando...');
  ocultarMensaje('#saleMessage');

  try {
    const { codigoHttp, venta } = await registrarVenta(
      vehiculoId,
      compradorId,
      intentoPendiente.clave
    );

    const identificador = idVenta(venta);

    if (identificador == null) {
      throw new Error(
        'No se recibió el ID de la venta. ' +
        'Comprueba el estado antes de repetir la operación.'
      );
    }

    intentoPendiente = null;

    pintarDetalle('#saleResult', venta, codigoHttp);

    $('#saleIdInput').value = String(identificador);

    mensaje(
      '#saleMessage',
      `HTTP ${codigoHttp}: venta #${identificador} ` +
      `registrada. Estado: ${estadoVenta(venta)}.`,
      'success'
    );

    await cargarDatos({ silencioso: true });

  } catch (error) {
    // En los fallos de red se conserva la misma clave.
    // Los errores HTTP definitivos liberan el intento.
    if (
      error.codigoHttp &&
      ![502, 503, 504].includes(error.codigoHttp)
    ) {
      intentoPendiente = null;
    }

    mensaje(
      '#saleMessage',
      error.message +
      (
        intentoPendiente
          ? ' Puedes reintentar con la misma selección.'
          : ''
      ),
      'error'
    );
  } finally {
    ocupado(control, false, 'Registrar venta', 'Registrando...');
  }
});

// ==========================================
// SEGUIMIENTO POR ID
// ==========================================

$('#statusForm').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const id = Number($('#saleIdInput').value);

  if (!Number.isInteger(id) || id < 1) {
    mensaje(
      '#statusMessage',
      'Ingresa un ID de venta válido.',
      'error'
    );
    return;
  }

  await consultarPorId(id);
});

// ==========================================
// ESTADO DE RED Y PWA
// ==========================================

function actualizarRed() {
  const conectado = navigator.onLine;

  $('#networkStatus').textContent =
    conectado ? '● Red disponible' : '● Sin conexión';

  $('#networkStatus').classList.toggle(
    'offline',
    !conectado
  );
}

window.addEventListener('online', actualizarRed);
window.addEventListener('offline', actualizarRed);

actualizarRed();

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {});
  });
}
