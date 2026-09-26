/**
 * Middleware de autorización administrativa.
 *
 * Es un CASO PARTICULAR de `authMiddleware.exigirAdmin`, expuesto como
 * archivo propio para que la intención sea explícita al leer las rutas:
 *
 *   router.use(authMiddleware.autenticar);
 *   router.use(adminMiddleware.soloAdmin);
 *
 * `soloAdmin` DELEGA en authMiddleware.exigirAdmin: una única implementación
 * de la regla "rol === admin", sin duplicar lógica ni mensajes.
 */

const authMiddleware = require('./authMiddleware');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');

/** Alias de `authMiddleware.exigirAdmin`. */
const soloAdmin = authMiddleware.exigirAdmin;

/**
 * Valida que el usuario sea el propietario del recurso o un administrador.
 * Se usa en rutas parametrizadas cuyo recurso pertenece a un cliente
 * (por ejemplo PUT /api/reservas/:id), de modo que un cliente autenticado
 * no pueda tocar datos de otro cliente.
 *
 * @param {(req) => Promise<number|null>} obtenerPropietarioId
 *        Devuelve el cliente_id dueño del recurso, o null si no existe.
 */
const soloPropietarioOAdmin = (obtenerPropietarioId) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.usuario) {
      throw HttpError.noAutorizado('Debes iniciar sesión para realizar esta acción.');
    }
    if (req.usuario.rol === authMiddleware.ROL_ADMIN) return next();

    const propietarioId = await obtenerPropietarioId(req);
    if (propietarioId == null) return next(); // La ruta se encargará del 404.

    if (req.usuario.clienteId == null) {
      throw HttpError.prohibido('Tu cuenta no está asociada a un cliente registrado.');
    }
    if (Number(propietarioId) !== Number(req.usuario.clienteId)) {
      throw HttpError.prohibido('No tienes permisos para modificar reservas de otro cliente.');
    }
    return next();
  });

module.exports = { soloAdmin, soloPropietarioOAdmin };
