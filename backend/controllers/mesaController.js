/**
 * Controlador de mesas.
 *
 * Nota de orden de rutas: `/disponibles` y `/estado-salon` se declaran ANTES
 * que `/:id` para que Express no los interprete como un id.
 */

const mesaService = require('../services/mesaService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, creado } = require('../utils/respuestas');

/** GET /api/mesas/disponibles?fecha=&hora=&personas= */
const disponibles = asyncHandler(async (req, res) => {
  const { fecha, hora, personas } = req.query;
  const mesas = await mesaService.listarDisponibles({ fecha, hora, personas });
  return ok(res, mesas, { meta: { total: mesas.length } });
});

/** GET /api/mesas/estado-salon?fecha=&hora= */
const estadoSalon = asyncHandler(async (req, res) => {
  const { fecha, hora } = req.query;
  const mesas = await mesaService.estadoSalon({ fecha, hora });
  return ok(res, mesas, {
    meta: {
      total: mesas.length,
      ocupadas: mesas.filter((m) => m.ocupada).length,
    },
  });
});

/** GET /api/mesas */
const listar = asyncHandler(async (req, res) => {
  const { capacidadMin, capacidadMax, ubicacion, estado } = req.query;
  const mesas = await mesaService.listar({ capacidadMin, capacidadMax, ubicacion, estado });
  return ok(res, mesas, { meta: { total: mesas.length } });
});

/** GET /api/mesas/:id */
const obtener = asyncHandler(async (req, res) => {
  return ok(res, await mesaService.obtenerPorId(req.params.id));
});

/** POST /api/mesas */
const crear = asyncHandler(async (req, res) => {
  return creado(res, await mesaService.crear(req.body ?? {}));
});

/** PUT /api/mesas/:id */
const actualizar = asyncHandler(async (req, res) => {
  return ok(res, await mesaService.actualizar(req.params.id, req.body ?? {}));
});

/** DELETE /api/mesas/:id */
const eliminar = asyncHandler(async (req, res) => {
  return ok(res, await mesaService.eliminar(req.params.id));
});

module.exports = { disponibles, estadoSalon, listar, obtener, crear, actualizar, eliminar };
