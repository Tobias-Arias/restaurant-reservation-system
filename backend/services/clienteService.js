/**
 * Servicio de clientes.
 *
 * Los clientes pueden registrarse como invitados (sin cuenta) o bien tener una
 * cuenta de acceso, en cuyo caso `usuario_id` los vincula con auth.users.
 */

const db = require('../database/supabase');
const HttpError = require('../utils/HttpError');
const {
  validarId,
  validarTexto,
  validarEmail,
  validarTelefono,
  validarEntero,
  normalizar,
  normalizarTexto,
} = require('../utils/validators');
const { normalizarReserva } = require('./reservaService');

const CAMPOS = 'id, usuario_id, nombre, apellido, email, telefono, created_at';

/** Lista clientes con bÃºsqueda, orden y paginaciÃ³n. */
async function listar({ busqueda, limite = 50, pagina = 1, orden = 'reciente' } = {}) {
  const limiteNum = validarEntero(limite ?? 50, 'limite', { min: 1, max: 500 });
  const paginaNum = validarEntero(pagina ?? 1, 'pagina', { min: 1, max: 10_000 });

  let consulta = db.admin.from('clientes').select(CAMPOS);

  const texto = normalizarTexto(busqueda ?? '');
  if (texto.length >= 2) {
    const patron = `%${texto}%`;
    consulta = consulta.or(
      `nombre.ilike.${patron},apellido.ilike.${patron},email.ilike.${patron},telefono.ilike.${patron}`
    );
  }

  consulta =
    orden === 'alfabetico'
      ? consulta.order('nombre', { ascending: true })
      : consulta.order('created_at', { ascending: false });

  const desde = (paginaNum - 1) * limiteNum;
  const { data, error, count } = await consulta.range(desde, desde + limiteNum - 1);
  if (error) throw error;

  const clientes = data || [];
  const conteo = await contarReservasPorCliente(clientes.map((c) => c.id));

  return {
    clientes: clientes.map((cliente) => ({
      ...normalizarCliente(cliente),
      totalReservas: conteo.get(Number(cliente.id)) ?? 0,
    })),
    total: count ?? clientes.length,
    pagina: paginaNum,
    limite: limiteNum,
  };
}

async function obtenerPorId(id) {
  const clienteId = validarId(id, 'id');

  const cliente = await db.ejecutar(() =>
    db.admin.from('clientes').select(CAMPOS).eq('id', clienteId).maybeSingle()
  );
  if (!cliente) throw HttpError.noEncontrado('El cliente solicitado no existe.');

  const conteo = await contarReservasPorCliente([clienteId]);

  return { ...normalizarCliente(cliente), totalReservas: conteo.get(clienteId) ?? 0 };
}

/** Historial de reservas de un cliente. */
async function listarReservas(id) {
  const clienteId = validarId(id, 'id');

  const existe = await db.admin.from('clientes').select('id').eq('id', clienteId).maybeSingle();
  if (!existe) throw HttpError.noEncontrado('El cliente solicitado no existe.');

  const reservas = await db.ejecutar(() =>
    db.admin
      .from('v_reservas')
      .select(
        `id, codigo, cliente_id, mesa_id, fecha, hora, personas, estado, observaciones, created_at,
         c.nombre AS cliente_nombre, c.apellido AS cliente_apellido,
         c.email AS cliente_email, c.telefono AS cliente_telefono,
         m.numero AS mesa_numero, m.capacidad AS mesa_capacidad,
         m.ubicacion AS mesa_ubicacion, m.estado AS mesa_estado`
      )
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
  );

  return reservas.map(normalizarReserva);
}

async function crear({ nombre, apellido, email, telefono, usuarioId }) {
  const datos = {
    nombre: validarTexto(nombre, 'nombre', { min: 2, max: 80 }),
    apellido: validarTexto(apellido, 'apellido', { min: 2, max: 80 }),
    email: validarEmail(email),
    telefono: validarTelefono(telefono),
  };

  if (usuarioId) datos.usuario_id = usuarioId;

  const cliente = await db.ejecutar(() => db.admin.from('clientes').insert(datos).select(CAMPOS).single());

  return normalizarCliente(cliente);
}

async function actualizar(id, cuerpo) {
  const clienteId = validarId(id, 'id');

  const existente = await db.admin.from('clientes').select('id, usuario_id').eq('id', clienteId).maybeSingle();
  if (!existe) throw HttpError.noEncontrado('El cliente solicitado no existe.');

  const datos = {};
  if (cuerpo.nombre !== undefined) datos.nombre = validarTexto(cuerpo.nombre, 'nombre', { min: 2, max: 80 });
  if (cuerpo.apellido !== undefined) {
    datos.apellido = validarTexto(cuerpo.apellido, 'apellido', { min: 2, max: 80 });
  }
  if (cuerpo.email !== undefined) datos.email = validarEmail(cuerpo.email);
  if (cuerpo.telefono !== undefined) datos.telefono = validarTelefono(cuerpo.telefono);

  if (Object.keys(datos).length === 0) {
    throw HttpError.badRequest('No se enviÃ³ ningÃºn campo para actualizar.');
  }

  const cliente = await db.ejecutar(() =>
    db.admin.from('clientes').update(datos).eq('id', clienteId).select(CAMPOS).single()
  );

  // Si el email cambiÃ³, la cuenta de acceso debe seguir siendo coherente.
  if (datos.email && existente.usuario_id) {
    await db.admin.from('usuarios').update({ email: datos.email }).eq('id', existente.usuario_id);
    try {
      await db.admin.auth.admin.updateUserById(existente.usuario_id, { email: datos.email });
    } catch (error) {
      console.warn('[clientes] no se pudo sincronizar el email con Supabase Auth:', error.message);
    }
  }

  return normalizarCliente(cliente);
}

/** Elimina un cliente. Bloqueado si tiene reservas o pedidos asociados. */
async function eliminar(id) {
  const clienteId = validarId(id, 'id');

  const cliente = await db.admin.from('clientes').select('id, nombre').eq('id', clienteId).maybeSingle();
  if (!cliente) throw HttpError.noEncontrado('El cliente solicitado no existe.');

  const [reservas, pedidos] = await Promise.all([
    db.admin.from('reservas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
    db.admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
  ]);

  const totalReservas = reservas.count ?? 0;
  if (totalReservas > 0) {
    throw HttpError.conflicto(
      `No se puede eliminar el cliente: tiene ${totalReservas} reserva(s) registradas. ` +
        'El historial de reservas debe conservarse.'
    );
  }

  await db.ejecutar(() => db.admin.from('clientes').delete().eq('id', clienteId));

  return {
    id: clienteId,
    mensaje: `Cliente ${normalizarTexto(cliente.nombre)} eliminado correctamente.`,
    pedidosEliminados: pedidos.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

/**
 * Cuenta las reservas de varios clientes en una sola consulta (evita N+1).
 * @param {number[]} ids
 * @returns {Promise<Map<number, number>>}
 */
async function contarReservasPorCliente(ids) {
  const conteo = new Map();
  if (!ids || ids.length === 0) return conteo;

  const filas = await db.ejecutar(() => db.admin.from('reservas').select('cliente_id').in('cliente_id', ids));

  for (const fila of filas) {
    const id = Number(fila.cliente_id);
    conteo.set(id, (conteo.get(id) ?? 0) + 1);
  }
  return conteo;
}

function normalizarCliente(cliente) {
  return {
    id: Number(cliente.id),
    usuarioId: cliente.usuario_id ?? null,
    tieneCuenta: Boolean(cliente.usuario_id),
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    nombreCompleto: normalizarTexto(`${cliente.nombre} ${cliente.apellido}`),
    email: normalizar(cliente.email),
    telefono: cliente.telefono,
    createdAt: cliente.created_at,
  };
}

module.exports = { listar, obtenerPorId, listarReservas, crear, actualizar, eliminar };
