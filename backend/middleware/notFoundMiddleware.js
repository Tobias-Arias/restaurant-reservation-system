/**
 * Middleware para rutas inexistentes.
 * Debe montarse DESPUÉS de todas las rutas de la API.
 */

const rutaNoEncontrada = (req, res) => {
  res.status(404).json({
    success: false,
    message: `El recurso ${req.method} ${req.originalUrl} no existe.`,
  });
};

module.exports = { rutaNoEncontrada };
