
let tokenActual = '';

export function normalizarToken(entrada = '') {
  return String(entrada)
    .trim()
    .replace(/^Bearer\s+/i, '')
    .trim();
}

export function sesionActiva() {
  return tokenActual.length > 0;
}

export function cerrarSesion() {
  tokenActual = '';
}

function detalleError(datos) {
  if (!datos || typeof datos !== 'object') {
    return '';
  }

  const detalle = datos.detail ??
    datos.mensaje ??
    datos.message ??
    datos.error ??
    '';

  if (typeof detalle === 'string') {
    return detalle;
  }

  if (Array.isArray(detalle)) {
    return detalle
      .map((item) => item.msg || item.message || '')
      .filter(Boolean)
      .join('; ');
  }

  return '';
}

function errorHttp(codigo, datos) {
  const mensajes = {
    400: 'Solicitud incorrecta.',
    401: 'Credenciales o JWT incorrectos o vencidos.',
    403: 'Tu usuario no tiene permiso para esta operación.',
    404: 'No se encontró el recurso.',
    409: 'Conflicto con los datos de la operación.',
    422: 'Los datos enviados no son válidos.',
    500: 'Error interno del servicio.',
    502: 'No se pudo conectar con la API.',
    503: 'Servicio no disponible.',
    504: 'Tiempo de espera agotado.',
  };

  const error = new Error(
    `HTTP ${codigo}: ${
      detalleError(datos) ||
      mensajes[codigo] ||
      'Operación no completada.'
    }`
  );

  error.codigoHttp = codigo;
  throw error;
}

async function interpretar(respuesta) {
  const contenido = await respuesta.text();
  let datos = null;

  if (contenido) {
    try {
      datos = JSON.parse(contenido);
    } catch {
      throw new Error(
        `HTTP ${respuesta.status}: ` +
        'el servicio devolvió una respuesta que no es JSON.'
      );
    }
  }

  if (!respuesta.ok) {
    errorHttp(respuesta.status, datos);
  }

  return {
    codigoHttp: respuesta.status,
    datos,
  };
}

async function solicitar(
  ruta,
  {
    method = 'GET',
    body,
    idempotencyKey,
  } = {},
  ejecutarFetch = fetch
) {
  const headers = {
    Accept: 'application/json',
  };

  if (tokenActual) {
    headers.Authorization = `Bearer ${tokenActual}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  let respuesta;

  try {
    respuesta = await ejecutarFetch(ruta, {
      method,
      headers,
      body: body === undefined
        ? undefined
        : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'No se pudo conectar. Revisa la red, NGINX y los servicios.'
    );
  }

  return interpretar(respuesta);
}

export async function iniciarSesion(
  usuario,
  contrasena,
  ejecutarFetch = fetch
) {
  const body = new URLSearchParams({
    username: String(usuario).trim(),
    password: contrasena,
  });

  let respuesta;

  try {
    respuesta = await ejecutarFetch('/oauth/token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el servicio de autenticación.'
    );
  }

  const { codigoHttp, datos } = await interpretar(respuesta);

  const token = normalizarToken(
    datos?.access_token ??
    datos?.accessToken ??
    datos?.token ??
    datos?.jwt ??
    datos?.data?.access_token ??
    ''
  );

  if (!token) {
    throw new Error(
      'La autenticación no devolvió un token JWT.'
    );
  }

  tokenActual = token;

  return {
    codigoHttp,
    usuario: String(usuario).trim(),
  };
}

// Conserva la firma original para las pruebas existentes.
export async function listarVehiculos(
  entradaToken = tokenActual,
  ejecutarFetch = fetch
) {
  const jwt = normalizarToken(entradaToken);

  const headers = new Headers({
    Accept: 'application/json',
  });

  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`);
  }

  let respuesta;

  try {
    respuesta = await ejecutarFetch('/api/vehiculos', {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'No se pudo consultar vehículos. Revisa NGINX y Java.'
    );
  }

  const { codigoHttp, datos } = await interpretar(respuesta);

  if (!Array.isArray(datos)) {
    throw new Error(
      'El servicio de vehículos no devolvió una lista JSON.'
    );
  }

  return {
    codigoHttp,
    vehiculos: datos,
  };
}

export async function listarCompradores() {
  const { codigoHttp, datos } =
    await solicitar('/api/compradores');

  if (!Array.isArray(datos)) {
    throw new Error(
      'El servicio de compradores no devolvió una lista JSON.'
    );
  }

  return {
    codigoHttp,
    compradores: datos,
  };
}

export async function listarVentas() {
  const { codigoHttp, datos } =
    await solicitar('/api/ventas');

  if (!Array.isArray(datos)) {
    throw new Error(
      'El servicio de ventas no devolvió una lista JSON.'
    );
  }

  return {
    codigoHttp,
    ventas: datos,
  };
}

export async function registrarVenta(
  vehiculoId,
  compradorId,
  idempotencyKey
) {
  if (!idempotencyKey) {
    throw new Error(
      'La venta requiere una Idempotency-Key.'
    );
  }

  const { codigoHttp, datos } = await solicitar(
    '/api/ventas',
    {
      method: 'POST',
      body: {
        vehiculoId,
        compradorId,
      },
      idempotencyKey,
    }
  );

  return {
    codigoHttp,
    venta: datos,
  };
}

export async function consultarVenta(id) {
  const { codigoHttp, datos } = await solicitar(
    `/api/ventas/${encodeURIComponent(id)}`
  );

  return {
    codigoHttp,
    venta: datos,
  };
}
