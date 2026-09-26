/**
 * Controlador de platos.
 * GET es público; el resto requiere rol administrador.
 */

const platoService = require('../services/platoService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, creado } = require('../utils/respuestas');

/** GET /api/platos?categoriaId=&busqueda=&incluirInactivos= */
const listar = asyncHandler(async (req, res) => {
  const { categoriaId, busqueda, disponible, incluirInactivos } = req.query;
  const platos = await platoService.listarPlatos({
    categoriaId,
    busqueda,
    disponible,
    incluirInactivos: incluirInactivos === 'true',
  });
  return ok(res, platos, { meta: { total: platos.length } });
});

/** GET /api/platos/:id */
const obtener = asyncHandler(async (req, res) => {
  return ok(res, await platoService.obtenerPlato(req.params.id));
});

/** POST /api/platos */
const crear = asyncHandler(async (req, res) => {
  return creado(res, await platoService.crearPlato(req.body ?? {}));
});

/** PUT /api/platos/:id */
const actualizar = asyncHandler(async (req, res) => {
  return ok(res, await platoService.actualizarPlato(req.params.id, req.body ?? {}));
});

/** DELETE /api/platos/:id */
const eliminar = asyncHandler(async (req, res) => {
  return ok(res, await platoService.eliminarPlato(req.params.id));
});

module.exports = { listar, obtener, crear, actualizar, eliminar };
