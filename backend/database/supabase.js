/**
 * ÚNICO punto del backend donde se configura la conexión con Supabase.
 *
 * Ningún otro archivo debe importar @supabase/supabase-js directamente.
 * Todo el acceso a datos pasa por `db` o por la capa de servicios.
 *
 * Se crean dos clientes:
 *
 *  - `admin`  → clave SERVICE ROLE. Ignora RLS. ÚNICAMENTE en el backend.
 *                Se usa para leer/escribir tablas y para gestionar usuarios
 *                (auth.admin) cuando el registro llega por la API.
 *
 *  - `publico`→ clave ANON. Se usa para las operaciones de autenticación
 *                (signUp / signInWithPassword), que deben hacerse "como
 *                un usuario anónimo" y no con privilegios de servicio.
 *
 * SEGURIDAD: ninguna de estas dos claves sale del servidor. El frontend sólo
 * conoce la URL del backend (VITE_API_URL). Ver README.md > Seguridad.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const HttpError = require('../utils/HttpError');

const Opciones = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

const admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, Opciones);
const publico = createClient(config.supabase.url, config.supabase.anonKey, Opciones);

/**
 * Traduce un error de PostgREST al dominio de la aplicación.
 *
 * Se centraliza aquí para que los servicios no tengan que interpretar códigos
 * de PostgreSQL y para que al usuario nunca le llegue un mensaje en inglés
 * ni un detalle interno de la base de datos.
 *
 * @param {object} error Error devuelto por supabase-js.
 * @returns {Error|null} HttpError con mensaje en español, o null si no se
 *                        reconoce el error.
 */
function traducirError(error) {
  if (!error) return null;

  const codigo = error.code || '';
  const detalle = error.message || '';
  const mensajeOriginal = (error.details || detalle || '').trim();

  // 23P01 → exclusion_violation: la restricción EXCLUDE del schema.sql saltó.
  if (codigo === '23P01' || /exclusion|ya tiene la reserva|no_superpuesta/i.test(mensajeOriginal)) {
    const conflicto = /ya tiene la reserva ([A-Z0-9-]+)/i.exec(mensajeOriginal);
    return {
      status: 409,
      message: 'La mesa seleccionada ya fue reservada para ese horario. Elegí otra mesa u otro horario.',
      code: 'MESA_OCUPADA',
      extra: conflicto ? { reserva: conflicto[1] } : undefined,
    };
  }

  // 23514 → check_violation: CHECK de una restricción.
  if (codigo === '23514') {
    if (/capacidad|solo tiene|personas/i.test(mensajeOriginal)) {
      return { status: 422, message: 'La cantidad de personas supera la capacidad de la mesa.', code: 'CAPACIDAD' };
    }
    return { status: 422, message: 'Los datos enviados no cumplen las reglas del sistema.', code: 'CHECK' };
  }

  // 23505 → unique_violation
  if (codigo === '23505') {
    if (/clientes_email|usuarios_email/i.test(mensajeOriginal)) {
      return { status: 409, message: 'Ya existe un registro con ese email.', code: 'EMAIL_DUPLICADO' };
    }
    if (/mesas_numero/i.test(mensajeOriginal)) {
      return { status: 409, message: 'Ya existe una mesa con ese número.', code: 'MESA_DUPLICADA' };
    }
    if (/codigo/i.test(mensajeOriginal)) {
      return { status: 409, message: 'Ese código de reserva ya está en uso.', code: 'CODIGO_DUPLICADO' };
    }
    return { status: 409, message: 'Ya existe un registro con esos datos.', code: 'DUPLICADO' };
  }

  // 23503 → foreign_key_violation
  if (codigo === '23503') {
    if (/reservas_mesa_id_fkey|mesas/i.test(mensajeOriginal)) {
      return { status: 422, message: 'La mesa indicada no existe.', code: 'MESA_INEXISTENTE' };
    }
    if (/clientes/i.test(mensajeOriginal)) {
      return { status: 422, message: 'El cliente indicado no existe.', code: 'CLIENTE_INEXISTENTE' };
    }
    return { status: 422, message: 'La operación referencia un registro que no existe.', code: 'FK' };
  }

  // 23502 → not_null_violation
  if (codigo === '23502') {
    return { status: 422, message: 'Faltan datos obligatorios en la solicitud.', code: 'CAMPOS_OBLIGATORIOS' };
  }

  // 57014 → statement timeout
  if (codigo === '57014') {
    return { status: 503, message: 'La consulta está tardando demasiado. Intentá de nuevo en unos segundos.', code: 'TIMEOUT' };
  }

  // 42P01 → relation does not exist (schema.sql no se ejecutó)
  if (codigo === '42P01' || /does not exist/i.test(mensajeOriginal)) {
    return {
      status: 503,
      message: 'La base de datos no está preparada. Ejecutá database/schema.sql en Supabase.',
      code: 'ESQUEMA_NO_INSTALADO',
    };
  }

  // 28P01 / invalid login (Supabase Auth)
  if (codigo === '28P01' || /Invalid login credentials/i.test(detalle)) {
    return { status: 401, message: 'Email o contraseña incorrectos.', code: 'CREDENCIALES' };
  }

  return null;
}

/**
 * Ejecuta una consulta de datos y normaliza el resultado o el error.
 *
 * @param {() => Promise<{ data: any, error: any }>} operacion
 * @returns {Promise<any>} `data` de la consulta.
 * @throws {import('./HttpError')} Error de dominio con mensaje en español.
 */
async function ejecutar(operacion) {
  const { data, error } = await operacion();

  if (error) {
    const traducido = traducirError(error);
    if (traducido) {
      const httpError = new HttpError(traducido.status, traducido.message, {
        code: traducido.code,
        ...(traducido.extra ? { extra: traducido.extra } : {}),
      });
      httpError.codigoPostgrest = error.code;
      throw httpError;
    }
    // Error no reconocido: se propaga para que lo registre el middleware.
    const desconocido = new Error(`[supabase:${error.code || 'desconocido'}] ${error.message}`);
    desconocido.esEsperado = false;
    desconocido.codigoPostgrest = error.code;
    throw desconocido;
  }

  return data;
}

const db = {
  /** Cliente con permisos de servicio (uso exclusivo del backend). */
  admin,
  /** Cliente anónimo, para las operaciones de Supabase Auth. */
  publico,
  ejecutar,
  traducirError,
};

module.exports = db;
