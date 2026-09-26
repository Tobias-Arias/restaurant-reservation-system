/**
 * Controlador de estadísticas y dashboard.
 * Todas las rutas requieren rol administrador.
 *
 * El cálculo ocurre íntegramente en PostgreSQL (funciones fn_* de schema.sql);
 * aquí sólo se adapta el formato de salida.
 */

const estadisticaService = require('../services/estadisticaService');
const mesaService = require('../services/mesaService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respuestas');
const { obtenerTurnos, HORARIOS } = require('../config/horarios');
const config = require('../config');

/** GET /api/estadisticas/dashboard?fecha= */
const dashboard = asyncHandler(async (req, res) => {
  return ok(res, await estadisticaService.dashboard({ fecha: req.query.fecha }));
});

/** GET /api/estadisticas/reservas?desde=&hasta= */
const reservas = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  return ok(res, await estadisticaService.reservas({ desde, hasta }));
});

/** GET /api/estadisticas/mesas?desde=&hasta= */
const mesas = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;
  return ok(res, await estadisticaService.mesas({ desde, hasta }));
});

/** GET /api/estadisticas/clientes?desde=&hasta=&limite= */
const clientes = asyncHandler(async (req, res) => {
  const { desde, hasta, limite } = req.query;
  return ok(res, await estadisticaService.clientes({ desde, hasta, limite }));
});

/** GET /api/estadisticas/ventas?desde=&hasta=&anio= */
const ventas = asyncHandler(async (req, res) => {
  const { desde, hasta, anio } = req.query;
  return ok(res, await estadisticaService.ventas({ desde, hasta, anio }));
});

/**
 * GET /api/estadisticas/salon?fecha=&hora=
 * Vista de operación: todas las mesas con su reserva activa.
 */
const salon = asyncHandler(async (req, res) => {
  const [estado, resumen] = await Promise.all([
    mesaService.estadoSalon({ fecha: req.query.fecha, hora: req.query.hora }),
    mesaService.resumen(),
  ]);
  return ok(res, { mesas: estado, ...resumen });
});

/**
 * GET /api/estadisticas/horarios
 * Configuración de turnos vigente y horarios admitidos por el sistema.
 */
const horarios = asyncHandler(async (_req, res) => {
  return ok(res, {
    duracionMinutos: HORARIOS.duracionMinutos,
    diasAtencion: HORARIOS.diasAtencion,
    turnos: obtenerTurnos(),
    anticipacionMaximaDias: HORARIOS.anticipacionMaximaDias,
    limiteReservasPorFranja: config.limiteReservasPorFranja,
  });
});

module.exports = { dashboard, reservas, mesas, clientes, ventas, salon, horarios };
