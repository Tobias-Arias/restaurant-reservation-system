/**
 * Envuelve un handler asíncrono para que cualquier promesa rechazada llegue
 * al middleware de errores de Express en lugar de quedar sin capturar.
 *
 * Express 4 no soporta handlers `async` de forma nativa, por eso se envuelven
 * todos los controladores con esta función.
 */
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

module.exports = asyncHandler;
