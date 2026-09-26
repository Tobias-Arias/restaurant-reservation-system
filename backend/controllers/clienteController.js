/**
 * Controlador de clientes. Todas las rutas requieren rol administrador.
 */

const clienteService = require('../services/clienteService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, creado } = require('../utils/respuestas');

/** GET /api/clientes?busqueda=&pagina=&limite=&orden= */
const listar = asyncHandler(async (req, res) => {
  const { busqueda, pagina, limite, orden } = req.query;
  const resultado = await clienteService.listar({ busqueda, pagina, limite, orden });
  return ok(res, resultado.clientes, { meta: { total: resultado.total, pagina: resultado.pagina, limite: resultado.limite } });
});

/** GET /api/clientes/:id */
const obtener = asyncHandler(async (req, res) => {
  return ok(res, await clienteService.obtenerPorId(req.params.id));
});

/** GET /api/clientes/:id/reservas */
const reservas = asyncHandler(async (req, res) => {
  return ok(res, await clienteService.listarReservas(req.params.id));
});

/** POST /api/clientes */
const crear = asyncHandler(async (req, res) => {
  return creado(res, await clienteService.crear(req.body ?? {}));
});

/** PUT /api/clientes/:id */
const actualizar = asyncHandler(async (req, res) => {
  return ok(res, await clienteService.actualizar(req.params.id, req.body ?? {}));
});

/** DELETE /api/clientes/:id */
const eliminar = asyncHandler(async (req, res) => {
  return ok(res, await clienteService.eliminar(req.params.id));
});

module.exports = { listar, obtener, reservas, crear, actualizar, eliminar };
