/**
 * Única fuente de verdad sobre la duración de una reserva dentro del backend.
 *
 * PostgreSQL no permite pasar un parámetro al valor por defecto de una
 * función, así que el valor de 90 minutos está escrito en
 * `fn_duracion_reserva()` (database/schema.sql) y se lee de la base de datos
 * para mantener ambas capas sincronizadas.
 *
 * Si la base de datos no responde se asume el valor declarado en
 * config/horarios.js, de modo que el arranque nunca se bloquea por esto.
 */

const db = require('../database/supabase');
const { HORARIOS } = require('../config/horarios');

let cache = null;

/**
 * @returns {Promise<number>} Duración de la reserva en minutos.
 */
async function fnDuracionReservaSql() {
  if (cache !== null) return cache;

  try {
    const { data, error } = await db.admin.rpc('fn_duracion_reserva');
    const minutos = error ? NaN : Number(data);
    cache = Number.isFinite(minutos) && minutos > 0 ? minutos : HORARIOS.duracionMinutos;
  } catch {
    cache = HORARIOS.duracionMinutos;
  }

  return cache;
}

/** Descarta la caché (usado en tests). */
function limpiarCache() {
  cache = null;
}

module.exports = { fnDuracionReservaSql, limpiarCache };
