/**
 * Envuelve un handler asíncrono para que cualquier promesa rechazada llegue
 * al middleware de errores de Express en lugar de quedar sin capturar.
 *
 * Express 4 no soporta handlers `async` de forma nativa, por eso se envuelven
 * todos los controladores con esta función.
 *
 * IMPORTANTE: se devuelve la promesa a propósito. `autenticarOpcional` hace
 * `await autenticar(...)` y, si esta función no devolviera nada, el `await` no
 * esperaría: el siguiente middleware se ejecutaría antes de que `req.usuario`
 * estuviera asignado (condición de carrera).
 */
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

module.exports = asyncHandler;
