/**
 * Controlador de categorías del menú.
 * GET es público; el resto requiere rol administrador.
 */

const platoService = require('../services/platoService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, creado } = require('../utils/respuestas');

/** GET /api/categorias */
const listar = asyncHandler(async (req, res) => {
  const categorias = await platoService.listarCategorias();
  return ok(res, categorias, { meta: { total: categorias.length } });
});

/** GET /api/categorias/:id */
const obtener = asyncHandler(async (req, res) => {
  return ok(res, await platoService.obtenerCategoria(req.params.id));
});

/** POST /api/categorias */
const crear = asyncHandler(async (req, res) => {
  return creado(res, await platoService.crearCategoria(req.body ?? {}));
});

/** PUT /api/categorias/:id */
const actualizar = asyncHandler(async (req, res) => {
  return ok(res, await platoService.actualizarCategoria(req.params.id, req.body ?? {}));
});

/** DELETE /api/categorias/:id */
const eliminar = asyncHandler(async (req, res) => {
  return ok(res, await platoService.eliminarCategoria(req.params.id));
});

module.exports = { listar, obtener, crear, actualizar, eliminar };
