
const MENSAJES = {
  400: "Solicitud incorrecta.",
  401: "JWT ausente, inválido o vencido.",
  403: "No tienes permiso para realizar esta consulta.",
  404: "Recurso no encontrado.",
  409: "Conflicto con los datos solicitados.",
  500: "Error interno del servicio.",
  502: "NGINX no pudo conectarse con la API.",
  503: "Servicio no disponible.",
  504: "El servicio no respondió a tiempo.",
};

export function normalizarToken(token = "") {
  return String(token)
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function solicitar(ruta, token) {
  const jwt = normalizarToken(token);

  const headers = {
    Accept: "application/json",
  };

  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  let respuesta;

  try {
    respuesta = await fetch(ruta, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No se pudo conectar con NGINX o con el servicio REST."
    );
  }

  const contenido = await respuesta.text();
  let datos = null;

  try {
    datos = contenido ? JSON.parse(contenido) : null;
  } catch {
    throw new Error(
      `HTTP ${respuesta.status}: respuesta JSON no válida.`
    );
  }

  if (!respuesta.ok) {
    const detalle =
      typeof datos?.mensaje === "string"
        ? datos.mensaje
        : typeof datos?.detail === "string"
          ? datos.detail
          : typeof datos?.error === "string"
            ? datos.error
            : MENSAJES[respuesta.status] ||
              "No se pudo completar la consulta.";

    const error = new Error(
      `HTTP ${respuesta.status}: ${detalle}`
    );

    error.codigoHttp = respuesta.status;
    throw error;
  }

  if (!Array.isArray(datos)) {
    throw new Error(
      "El servicio no devolvió una lista JSON."
    );
  }

  return {
    codigoHttp: respuesta.status,
    datos,
  };
}

export async function listarVehiculos(token) {
  const resultado = await solicitar(
    "/api/vehiculos",
    token
  );

  return {
    codigoHttp: resultado.codigoHttp,
    vehiculos: resultado.datos,
  };
}

export async function listarVentas(token) {
  const resultado = await solicitar(
    "/api/ventas",
    token
  );

  return {
    codigoHttp: resultado.codigoHttp,
    ventas: resultado.datos,
  };
}

export async function listarCompradores(token) {
  const resultado = await solicitar(
    "/api/compradores",
    token
  );

  return {
    codigoHttp: resultado.codigoHttp,
    compradores: resultado.datos,
  };
}
