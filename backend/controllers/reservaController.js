/**
 * Controlador de reservas.
 *
 * La autorización fina (dueño vs. administrador) se aplica DENTRO del servicio
 * de reservas, que es el único que sabe quién es el propietario de cada fila.
 */

const reservaService = require('../services/reservaService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, creado } = require('../utils/respuestas');

/** GET /api/reservas/mias */
const mias = asyncHandler(async (req, res) => {
  const reservas = await reservaService.listarMias(req.usuario);
  return ok(res, reservas, { meta: { total: reservas.length } });
});

/** GET /api/reservas/hoy */
const hoy = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const resultado = await reservaService.listarHoy({ estado }, req.usuario);
  return ok(res, resultado.reservas, { meta: { total: resultado.total } });
});

/** GET /api/reservas */
const listar = asyncHandler(async (req, res) => {
  const { fecha, fechaDesde, fechaHasta, estado, clienteId, mesaId, codigo, soloActivas, limite, pagina } =
    req.query;

  const resultado = await reservaService.listar(
    { fecha, fechaDesde, fechaHasta, estado, clienteId, mesaId, codigo, soloActivas, limite, pagina },
    req.usuario
  );

  return ok(res, resultado.reservas, {
    meta: { total: resultado.total, pagina: resultado.pagina, limite: resultado.limite },
  });
});

/** GET /api/reservas/codigo/:codigo */
const porCodigo = asyncHandler(async (req, res) => {
  return ok(res, await reservaService.obtenerPorCodigo(req.params.codigo));
});

/** GET /api/reservas/:id */
const obtener = asyncHandler(async (req, res) => {
  return ok(res, await reservaService.obtenerPorId(req.params.id, req.usuario));
});

/** POST /api/reservas */
const crear = asyncHandler(async (req, res) => {
  // `req.usuario` es null si no hay sesión: se permite reservar como invitado.
  return creado(res, await reservaService.crear(req.body ?? {}, req.usuario ?? null));
});

/** PUT /api/reservas/:id */
const actualizar = asyncHandler(async (req, res) => {
  return ok(res, await reservaService.actualizar(req.params.id, req.body ?? {}, req.usuario));
});

/** DELETE /api/reservas/:id */
const eliminar = asyncHandler(async (req, res) => {
  return ok(res, await reservaService.eliminar(req.params.id, req.usuario));
});

/** PUT /api/reservas/:id/confirmar */
const confirmar = asyncHandler(async (req, res) => {
  return ok(res, await reservaService.confirmar(req.params.id, req.usuario));
});

/** PUT /api/reservas/:id/cancelar */
const cancelar = asyncHandler(async (req, res) => {
  return ok(res, await reservaService.cancelar(req.params.id, req.usuario));
});

/** PUT /api/reservas/:id/completar */
const completar = asyncHandler(async (req, res) => {
  return ok(res, await reservaService.completar(req.params.id, req.usuario));
});

module.exports = { mias, hoy, listar, porCodigo, obtener, crear, actualizar, eliminar, confirmar, cancelar, completar };
