/**
 * Controlador de autenticación.
 * Traduce HTTP <-> servicio. No contiene lógica de negocio.
 */

const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, creado } = require('../utils/respuestas');
const { validarTexto, validarTelefono } = require('../utils/validators');

/** POST /api/auth/register */
const registrar = asyncHandler(async (req, res) => {
  const { nombre, email, password, telefono } = req.body ?? {};

  if (telefono !== undefined && telefono !== null && telefono !== '') {
    validarTelefono(telefono);
  }

  const sesion = await authService.registrar({ nombre, email, password, telefono });
  return creado(res, sesion);
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  const sesion = await authService.iniciarSesion(email, password);
  return ok(res, sesion);
});

/** POST /api/auth/renovar */
const renovar = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  return ok(res, await authService.renovarSesion(refreshToken));
});

/** GET /api/auth/me */
const yo = asyncHandler(async (req, res) => {
  const usuario = await perfilDesdeToken(req.token);
  return ok(res, usuario);
});

/** PUT /api/auth/me */
const actualizarPerfil = asyncHandler(async (req, res) => {
  const { nombre } = req.body ?? {};
  validarTexto(nombre, 'nombre', { min: 2, max: 80 });

  const perfil = await authService.actualizarPerfil(req.usuario.id, { nombre });
  return ok(res, perfil);
});

/** POST /api/auth/logout */
const logout = asyncHandler(async (req, res) => {
  const resultado = await authService.cerrarSesion(req.token);
  return ok(res, resultado);
});

module.exports = { registrar, login, renovar, yo, actualizarPerfil, logout };
