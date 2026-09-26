/**
 * Middleware de autenticación.
 *
 * El token que viaja en `Authorization: Bearer <jwt>` es un JWT emitido por
 * Supabase Auth. El backend NO confía en decodificarlo: se lo envía a Supabase
 * mediante `auth.getUser(token)`, que valida la firma y comprueba que el
 * usuario siga existiendo. Después carga el perfil desde `public.usuarios`,
 * que es la única fuente de verdad del ROL.
 *
 * `req.usuario` = { id, email, nombre, rol, clienteId }
 */

const db = require('../database/supabase');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');

const ROL_ADMIN = 'admin';
const ROL_CLIENTE = 'cliente';

const extraeToken = (req) => {
  const cabecera = req.headers.authorization || req.headers.Authorization || '';
  if (typeof cabecera !== 'string' || !cabecera.startsWith('Bearer ')) return null;
  const token = cabecera.slice(7).trim();
  return token.length > 0 ? token : null;
};

/**
 * Exige un usuario autenticado. Rellena `req.usuario`.
 */
const autenticar = asyncHandler(async (req, _res, next) => {
  const token = extraeToken(req);
  if (!token) {
    throw HttpError.noAutorizado('Debes iniciar sesión para realizar esta acción.');
  }

  const { data, error } = await db.admin.auth.getUser(token);
  if (error || !data?.user) {
    throw HttpError.noAutorizado('Tu sesión expiró. Volvé a iniciar sesión.');
  }

  const authUser = data.user;
  const perfil = await db.ejecutar(() =>
    db.admin.from('usuarios').select('id, nombre, email, rol').eq('id', authUser.id).maybeSingle()
  );

  if (!perfil) {
    throw HttpError.noAutorizado('Tu cuenta no está registrada en la aplicación.');
  }

  const cliente = await db.ejecutar(() =>
    db.admin.from('clientes').select('id').eq('usuario_id', authUser.id).maybeSingle()
  );

  req.usuario = {
    id: authUser.id,
    email: perfil.email,
    nombre: perfil.nombre,
    rol: perfil.rol,
    clienteId: cliente?.id ?? null,
  };
  req.token = token;

  next();
});

/**
 * Autentica si hay token, pero nunca rechaza la petición.
 * Se usa en endpoints públicos que personalizan la respuesta (p. ej. el menú).
 */
const autenticarOpcional = asyncHandler(async (req, _res, next) => {
  if (!extraeToken(req)) return next();
  try {
    await autenticar(req, _res, () => {});
  } catch {
    req.usuario = null;
  }
  next();
});

/** Exige rol administrador. Debe usarse siempre después de `autenticar`. */
const exigirAdmin = (req, _res, next) => {
  if (!req.usuario) {
    return next(HttpError.noAutorizado('Debes iniciar sesión para realizar esta acción.'));
  }
  if (req.usuario.rol !== ROL_ADMIN) {
    return next(HttpError.prohibido('No tienes permisos para realizar esta acción.'));
  }
  next();
};

/** Cortocircuita si el usuario ya está autenticado (evita /login con sesión viva). */
const rechazarSiAutenticado = (req, _res, next) => {
  const token = extraeToken(req);
  if (!token) return next();
  return next(HttpError.badRequest('Ya iniciaste sesión en esta aplicación.'));
};

module.exports = {
  autenticar,
  autenticarOpcional,
  exigirAdmin,
  rechazarSiAutenticado,
  ROL_ADMIN,
  ROL_CLIENTE,
};
