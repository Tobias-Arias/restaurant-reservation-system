/**
 * Servicio de mesas.
 *
 * Aquí vive la REGLA FUNDAMENTAL del sistema:
 *   una mesa no puede tener dos reservas superpuestas.
 *
 * La comprobación se hace en tres niveles:
 *   1. Aquí, antes de responder, con la función SQL fn_mesas_disponibles()
 *      (el mismo motor que usa el trigger y la restricción EXCLUDE).
 *   2. En reservaService al crear/modificar, con fn_reservas_conflictantes().
 *   3. En la propia base de datos, con la restricción EXCLUDE ... USING gist
 *      y el trigger trg_reservas_validar_superposicion.
 *
 * Nunca se confía en la validación del frontend.
 */

const db = require('../database/supabase');
const HttpError = require('../utils/HttpError');
const {
  validarEntero,
  validarFecha,
  validarHora,
  validarId,
  validarVentanaDeReserva,
  hoyISO,
  normalizarTexto,
} = require('../utils/validators');
const { obtenerTurnos } = require('../config/horarios');

const UMBICACIONES = ['interior', 'terraza', 'ventana', 'barra', 'privada'];
const ESTADOS = ['disponible', 'mantenimiento'];

const CAMPOS_MESA = 'id, numero, capacidad, ubicacion, estado, created_at';

/** Lista todas las mesas, con filtros opcionales. */
async function listar({ capacidadMin, capacidadMax, ubicacion, estado } = {}) {
  let consulta = db.admin.from('mesas').select(CAMPOS_MESA);

  if (capacidadMin !== undefined) consulta = consulta.gte('capacidad', Number(capacidadMin));
  if (capacidadMax !== undefined) consulta = consulta.lte('capacidad', Number(capacidadMax));
  if (ubicacion) consulta = consulta.eq('ubicacion', String(ubicacion).toLowerCase());
  if (estado) consulta = consulta.eq('estado', String(estado).toLowerCase());

  const mesas = await db.ejecutar(() => consulta.order('numero', { ascending: true }));

  return mesas.map(normalizar);
}

async function obtenerPorId(id) {
  const mesaId = validarId(id, 'id');
  const mesa = await db.ejecutar(() =>
    db.admin.from('mesas').select(CAMPOS_MESA).eq('id', mesaId).maybeSingle()
  );
  if (!mesa) throw HttpError.noEncontrado('La mesa solicitada no existe.');
  return normalizar(mesa);
}

/**
 * MESAS DISPONIBLES  →  GET /api/mesas/disponibles?fecha=&hora=&personas=
 *
 * Devuelve las mesas que cumplen las tres condiciones:
 *   1. capacidad suficiente,
 *   2. fuera de mantenimiento,
 *   3. sin reservas solapadas en esa fecha y franja.
 */
async function listarDisponibles({ fecha, hora, personas }) {
  const fechaLimpia = validarFecha(fecha, 'fecha');
  const horaLimpia = validarHora(hora);
  const personasLimpio = validarEntero(personas, 'personas', { min: 1, max: 40 });

  validarVentanaDeReserva(fechaLimpia, horaLimpia);

  const mesas = await db.ejecutar(() =>
    db.admin.rpc('fn_mesas_disponibles', {
      p_fecha: fechaLimpia,
      p_hora: horaLimpia,
      p_personas: personasLimpio,
    })
  );

  return (mesas || []).map((mesa) => ({
    id: Number(mesa.id),
    numero: Number(mesa.numero),
    capacidad: Number(mesa.capacidad),
    ubicacion: mesa.ubicacion,
  }));
}

/** Estado del salón (ocupadas / libres) para una fecha y hora. */
async function estadoSalon({ fecha, hora }) {
  const fechaLimpia = fecha ? validarFecha(fecha, 'fecha', { permitirPasado: true }) : hoyISO();
  const horaLimpia = hora ? validarHora(hora, { conReserva: false }) : null;
  const referencia = horaLimpia ?? obtenerTurnos()[0]?.slots[0] ?? '12:00';

  const filas = await db.ejecutar(() =>
    db.admin.rpc('fn_estado_salon', { p_fecha: fechaLimpia, p_hora: referencia })
  );

  return (filas || []).map((fila) => ({
    mesaId: Number(fila.mesa_id),
    numero: Number(fila.mesa_numero),
    capacidad: Number(fila.mesa_capacidad),
    ubicacion: fila.mesa_ubicacion,
    estadoMesa: fila.mesa_estado,
    ocupada: Boolean(fila.ocupada),
    reserva: fila.ocupada
      ? {
          id: Number(fila.reserva_id),
          codigo: fila.reserva_codigo,
          estado: fila.reserva_estado,
          hora: normalizarHora(fila.reserva_hora),
          personas: Number(fila.reserva_personas),
        }
      : null,
  }));
}

/** Crea una mesa nueva. */
async function crear({ numero, capacidad, ubicacion, estado }) {
  const datos = construirDatos({ numero, capacidad, ubicacion, estado });

  const mesa = await db.ejecutar(() => db.admin.from('mesas').insert(datos).select(CAMPOS_MESA).single());

  return normalizar(mesa);
}

/** Actualiza una mesa. Solo se envían los campos presentes en el cuerpo. */
async function actualizar(id, cuerpo) {
  const mesaId = validarId(id, 'id');

  const existente = await db.admin.from('mesas').select('id').eq('id', mesaId).maybeSingle();
  if (!existente) throw HttpError.noEncontrado('La mesa solicitada no existe.');

  const campos = Object.keys(cuerpo).filter((clave) => cuerpo[clave] !== undefined);
  if (campos.length === 0) {
    throw HttpError.badRequest('No se envió ningún campo para actualizar.');
  }

  const datos = construirDatos(cuerpo, { parcial: true });

  const mesa = await db.ejecutar(() =>
    db.admin.from('mesas').update(datos).eq('id', mesaId).select(CAMPOS_MESA).single()
  );

  return normalizar(mesa);
}

/**
 * Elimina una mesa.
 * No se permite si tiene reservas sin resolver (pendiente o confirmada),
 * coherente con el ON DELETE RESTRICT de la FK en schema.sql.
 */
async function eliminar(id) {
  const mesaId = validarId(id, 'id');

  const mesa = await db.admin.from('mesas').select('id, numero').eq('id', mesaId).maybeSingle();
  if (!mesa) throw HttpError.noEncontrado('La mesa solicitada no existe.');

  const pendientes = await db.ejecutar(() =>
    db.admin
      .from('reservas')
      .select('id, codigo, fecha, estado')
      .eq('mesa_id', mesaId)
      .in('estado', ['pendiente', 'confirmada'])
  );

  if (pendientes.length > 0) {
    const detalle = pendientes
      .slice(0, 3)
      .map((r) => `${r.codigo} (${r.fecha}, ${r.estado})`)
      .join(', ');
    throw HttpError.conflicto(
      `No se puede eliminar la mesa: tiene ${pendientes.length} reserva(s) sin resolver. ` +
        `Resolvé o cancelá estas reservas primero: ${detalle}.`
    );
  }

  await db.ejecutar(() => db.admin.from('mesas').delete().eq('id', mesaId));

  return { id: mesaId, mensaje: `Mesa ${mesa.numero} eliminada correctamente.` };
}

/** Resumen de ocupación para el dashboard. */
async function resumen() {
  const mesas = await db.ejecutar(() => db.admin.from('mesas').select('id, estado'));
  return {
    total: mesas.length,
    disponibles: mesas.filter((m) => m.estado === 'disponible').length,
    mantenimiento: mesas.filter((m) => m.estado === 'mantenimiento').length,
  };
}

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

function construirDatos(cuerpo, { parcial = false } = {}) {
  const datos = {};

  if (!parcial || cuerpo.numero !== undefined) {
    datos.numero = validarEntero(cuerpo.numero, 'numero', { min: 1, max: 999 });
  }
  if (!parcial || cuerpo.capacidad !== undefined) {
    datos.capacidad = validarEntero(cuerpo.capacidad, 'capacidad', { min: 1, max: 40 });
  }
  if (!parcial || cuerpo.ubicacion !== undefined) {
    const ubicacion = normalizarTexto(cuerpo.ubicacion || 'interior').toLowerCase();
    if (!UBICACIONES.includes(ubicacion)) {
      throw HttpError.badRequest(`Ubicación inválida. Valores permitidos: ${UBICACIONES.join(', ')}.`, {
        campo: 'ubicacion',
      });
    }
    datos.ubicacion = ubicacion;
  }
  if (!parcial || cuerpo.estado !== undefined) {
    const estado = normalizarTexto(cuerpo.estado || 'disponible').toLowerCase();
    if (!ESTADOS.includes(estado)) {
      throw HttpError.badRequest(`Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}.`, {
        campo: 'estado',
      });
    }
    datos.estado = estado;
  }

  if (!parcial && Object.keys(datos).length < 4) {
    throw HttpError.badRequest('Faltan datos obligatorios para crear la mesa.');
  }

  return datos;
}

function normalizar(mesa) {
  return {
    id: Number(mesa.id),
    numero: Number(mesa.numero),
    capacidad: Number(mesa.capacidad),
    ubicacion: mesa.ubicacion,
    estado: mesa.estado,
    createdAt: mesa.created_at,
  };
}

/** PostgreSQL devuelve TIME como "HH:MM:SS"; la API expone "HH:MM". */
function normalizarHora(hora) {
  if (!hora) return null;
  return String(hora).slice(0, 5);
}

module.exports = {
  UMBICACIONES,
  ESTADOS,
  listar,
  obtenerPorId,
  listarDisponibles,
  estadoSalon,
  crear,
  actualizar,
  eliminar,
  resumen,
  normalizarHora,
};
