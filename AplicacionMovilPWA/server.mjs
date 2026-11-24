
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ENV = resolve(ROOT, '.env');

if (existsSync(ENV)) {
  loadEnvFile(ENV);
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function jsonError(res, codigo, mensaje) {
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  res.end(JSON.stringify({
    mensaje,
    success: false,
  }));
}

async function leerCuerpo(req) {
  const partes = [];
  let total = 0;

  for await (const parte of req) {
    total += parte.length;

    if (total > 32 * 1024) {
      const error = new Error(
        'La solicitud supera el tamaño permitido.'
      );
      error.status = 413;
      throw error;
    }

    partes.push(parte);
  }

  return Buffer.concat(partes);
}

export function crearServidor({
  directorio = resolve(ROOT, 'public'),
  apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8090',
} = {}) {
  const carpeta = resolve(directorio);
  const base = apiBase.replace(/\/$/, '');

  return createServer(async (req, res) => {
    let url;

    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      jsonError(res, 400, 'URL incorrecta.');
      return;
    }

    const ruta = url.pathname;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');

    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self'; " +
      "img-src 'self' data:; " +
      "connect-src 'self'; " +
      "manifest-src 'self'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "frame-ancestors 'none'"
    );

    const oauth = ruta === '/oauth/token';
    const api = ruta.startsWith('/api/');

    if (oauth || api) {
      const getPermitido =
        req.method === 'GET' &&
        (
          ruta === '/api/vehiculos' ||
          ruta === '/api/compradores' ||
          ruta === '/api/ventas' ||
          /^\/api\/ventas\/\d+$/.test(ruta)
        );

      const ventaPermitida =
        req.method === 'POST' &&
        ruta === '/api/ventas';

      if (!(
        getPermitido ||
        ventaPermitida ||
        (oauth && req.method === 'POST')
      )) {
        jsonError(res, 404, 'Ruta no disponible.');
        return;
      }

      try {
        const headers = {
          Accept: 'application/json',
        };

        let body;

        // Autenticación OAuth: el secreto del cliente
        // permanece únicamente en el servidor Node.
        if (oauth) {
          const cliente = process.env.OAUTH_CLIENT_ID;
          const secreto = process.env.OAUTH_CLIENT_SECRET;

          if (!cliente || !secreto) {
            jsonError(
              res,
              503,
              'Configure OAUTH_CLIENT_ID y ' +
              'OAUTH_CLIENT_SECRET en el .env local.'
            );
            return;
          }

          const entrada = new URLSearchParams(
            (await leerCuerpo(req)).toString('utf8')
          );

          const usuario = entrada.get('username')?.trim();
          const contrasena = entrada.get('password');

          if (!usuario || !contrasena) {
            jsonError(
              res,
              400,
              'Ingrese usuario y contraseña.'
            );
            return;
          }

          body = new URLSearchParams({
            grant_type: 'password',
            username: usuario,
            password: contrasena,
            idapli: process.env.OAUTH_IDAPLI || '92',
          }).toString();

          headers['Content-Type'] =
            'application/x-www-form-urlencoded';

          headers.Authorization =
            `Basic ${
              Buffer.from(
                `${cliente}:${secreto}`
              ).toString('base64')
            }`;

        } else {
          // En las API se conserva el JWT recibido.
          if (req.headers.authorization) {
            headers.Authorization =
              req.headers.authorization;
          }

          if (ventaPermitida) {
            body = await leerCuerpo(req);

            headers['Content-Type'] =
              'application/json';

            if (req.headers['idempotency-key']) {
              headers['Idempotency-Key'] =
                req.headers['idempotency-key'];
            }
          }
        }

        const remoto = await fetch(
          `${base}${ruta}${oauth ? '' : url.search}`,
          {
            method: req.method,
            headers,
            body,
            cache: 'no-store',
            signal: AbortSignal.timeout(15000),
          }
        );

        const salida = Buffer.from(
          await remoto.arrayBuffer()
        );

        const respuestaHeaders = {
          'Content-Type':
            remoto.headers.get('content-type') ||
            'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          Vary: 'Authorization',
        };

        if (remoto.headers.get('location')) {
          respuestaHeaders.Location =
            remoto.headers.get('location');
        }

        res.writeHead(
          remoto.status,
          respuestaHeaders
        );

        res.end(salida);

      } catch (error) {
        const timeout =
          error.name === 'TimeoutError' ||
          error.name === 'AbortError';

        jsonError(
          res,
          error.status || (timeout ? 504 : 502),
          error.status
            ? error.message
            : 'No se pudo comunicar con el servicio REST.'
        );
      }

      return;
    }

    // Archivos estáticos de la PWA.
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD'
    ) {
      jsonError(res, 405, 'Método no permitido.');
      return;
    }

    let rutaArchivo;

    try {
      rutaArchivo = decodeURIComponent(ruta);
    } catch {
      jsonError(res, 400, 'Ruta inválida.');
      return;
    }

    const archivo = resolve(
      carpeta,
      '.' + (
        rutaArchivo === '/'
          ? '/index.html'
          : rutaArchivo
      )
    );

    if (!(
      archivo === carpeta ||
      archivo.startsWith(carpeta + sep)
    )) {
      jsonError(res, 403, 'Acceso denegado.');
      return;
    }

    try {
      const detalle = await stat(archivo);

      if (!detalle.isFile()) {
        throw new Error('No encontrado');
      }

      res.setHeader(
        'Content-Type',
        TIPOS[extname(archivo)] ||
          'application/octet-stream'
      );

      if (req.method === 'HEAD') {
        res.writeHead(200);
        res.end();
        return;
      }

      res.writeHead(200);
      res.end(await readFile(archivo));

    } catch {
      jsonError(res, 404, 'Recurso no encontrado.');
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    fileURLToPath(import.meta.url)
) {
  const argumento = (prefijo) =>
    process.argv
      .find((x) => x.startsWith(prefijo))
      ?.split('=')[1];

  const puerto = Number(
    argumento('--port=') ||
    process.env.PORT ||
    5173
  );

  const host = process.env.HOST || '127.0.0.1';

  const directorio = resolve(
    ROOT,
    argumento('--dir=') || 'public'
  );

  crearServidor({
    directorio,
  }).listen(puerto, host, () => {
    console.log(
      `PWA disponible: http://localhost:${puerto}`
    );

    console.log(
      `Proxy REST mediante NGINX: ${
        process.env.API_BASE_URL ||
        'http://127.0.0.1:8090'
      }`
    );

    console.log('Para cerrar: Ctrl + C');
  });
}