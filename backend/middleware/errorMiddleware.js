/**
 * Middleware global de errores.
 *
 * Política de seguridad aplicada aquí:
 *  - Los errores "previstos" (HttpError) devuelven su mensaje en español.
 *  - Cualquier otro error se registra completo en el servidor pero se
 *    responde con un mensaje genérico. Nunca se envían stack traces,
 *    nombres de tablas, SQL ni mensajes de PostgreSQL al cliente.
 */

const config = require('../config');
const HttpError = require('../utils/HttpError');

const MENSAJE_GENERICO = 'Ha ocurrido un error inesperado. Intentá de nuevo en unos momentos.';

// eslint-disable-next-line no-unused-vars -- Express exige la aridad 4 para detectar errores
const manejadorErrores = (err, req, res, _next) => {
  const esHttpError = err instanceof HttpError || err.esEsperado === true;
  const status = esHttpError ? err.status || 500 : 500;

  if (esHttpError) {
    if (status >= 500) {
      console.error('[error]', req.method, req.originalUrl, '->', err);
    } else {
      console.warn(`[api] ${status} ${req.method} ${req.originalUrl}: ${err.message}`);
    }

    const cuerpo = { success: false, message: err.message };
    if (err.detalles) cuerpo.detalles = err.detalles;
    return res.status(status).json(cuerpo);
  }

  // Error inesperado: log completo en servidor, respuesta genérica en cliente.
  console.error('[error inesperado]', req.method, req.originalUrl, err);

  if (config.env !== 'production') {
    // Sólo en desarrollo se añade contexto adicional para facilitar la depuración.
    return res.status(500).json({
      success: false,
      message: MENSAJE_GENERICO,
      detalles: {
        causa: err?.codigoPostgrest || err?.code || err?.name || 'Error',
        mensaje: err?.message,
      },
    });
  }

  return res.status(500).json({ success: false, message: MENSAJE_GENERICO });
};

module.exports = { manejadorErrores, MENSAJE_GENERICO };
