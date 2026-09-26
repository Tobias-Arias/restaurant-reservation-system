/**
 * Servicio de reservas.
 *
 * Contiene TODA la lógica de negocio del dominio reserva:
 *   - resolución del cliente (usuario autenticado o invitado),
 *   - validación de fecha, hora y cantidad de personas,
 *   - verificación de solapamiento antes de escribir,
 *   - transiciones de estado (confirmar / cancelar / completar),
 *   - autorización: un cliente sólo accede a sus propias reservas.
 *
 * Ninguna de estas decisiones se delega al frontend.
 */

const db = require('../database/supabase');
const HttpError = require('../utils/HttpError');
const {
  validarEntero,
  validarFecha,
  validarHora,
  validarId,
  validarVentanaDeReserva,
  validarTexto,
  validarEmail,
  validarTelefono,
  hoyISO,
  normalizar,
  normalizarTexto,
} = require('../utils/validators');
const { ROL_ADMIN } = require('../middleware/authMiddleware');
const { normalizarHora } = require('./mesaService');
const config = require('../config');

const ESTADOS = ['pendiente', 'confirmada', 'cancelada', 'completada'];

/** Transiciones permitidas de estado. */
const TRANSICIONES = {
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['completada', 'cancelada'],
  completada: [],
  cancelada: [],
};

// `v_reservas` es una vista: sus columnas YA vienen desnormalizadas
// (cliente_nombre, mesa_numero, ...). No hay tablas `c` ni `m` a las que
// joining: escribir "c.nombre AS ..." hace que PostgREST lo interprete como
// un agregado y falle con PGRST100.
const SELECT_DETALLE = `
  id, codigo, cliente_id, mesa_id, fecha, hora, personas, estado, observaciones, created_at,
  cliente_nombre, cliente_apellido, cliente_email, cliente_telefono,
  mesa_numero, mesa_capacidad, mesa_ubicacion, mesa_estado
`;

const origen = () => db.admin.from('v_reservas').select(SELECT_DETALLE);

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * Lista reservas con filtros. El acceso depende del rol:
 *   - admin   → todas
 *   - cliente → únicamente las suyas
 */
async function listar(filtros = {}, usuario) {
  let consulta = origen();

  const {
    fecha,
    fechaDesde,
    fechaHasta,
    estado,
    clienteId,
    mesaId,
    codigo,
    soloActivas,
    limite = 100,
    pagina = 1,
  } = filtros;

  if (soloActivas) consulta = consulta.in('estado', ['pendiente', 'confirmada']);
  if (fecha) consulta = consulta.eq('fecha', fecha);
  if (fechaDesde) consulta = consulta.gte('fecha', fechaDesde);
  if (fechaHasta) consulta = consulta.lte('fecha', fechaHasta);
  if (estado) consulta = consulta.eq('estado', estado);
  if (clienteId) consulta = consulta.eq('cliente_id', clienteId);
  if (mesaId) consulta = consulta.eq('mesa_id', mesaId);
  if (codigo) consulta = consulta.eq('codigo', codigo);

  // Un cliente NUNCA ve reservas de otra persona, aunque lo pida por parámetro.
  if (usuario && usuario.rol !== ROL_ADMIN) {
    if (!usuario.clienteId) return { reservas: [], total: 0, pagina: 1, limite };
    consulta = consulta.eq('cliente_id', usuario.clienteId);
  }

  const limiteNum = Math.min(validarEntero(limite, 'limite', { min: 1, max: 500 }), 500);
  const paginaNum = Math.max(validarEntero(pagina, 'pagina', { min: 1, max: 10_000 }), 1);
  const desde = (paginaNum - 1) * limiteNum;

  const { datos, total } = await paginar(consulta, desde, limiteNum, 'created_at');

  return {
    reservas: datos.map(normalizarReserva),
    total,
    pagina: paginaNum,
    limite: limiteNum,
  };
}

/** Obtiene una reserva por id, aplicando control de acceso. */
async function obtenerPorId(id, usuario) {
  const reservaId = validarId(id, 'id');

  const reserva = await db.ejecutar(() => origen().eq('id', reservaId).maybeSingle());
  if (!reserva) throw HttpError.noEncontrado('La reserva solicitada no existe.');

  afirmarAcceso(reserva, usuario);
  return normalizarReserva(reserva);
}

/** Obtiene una reserva por su código legible (RSV-XXXXXX). */
async function obtenerPorCodigo(codigo) {
  const reserva = await db.ejecutar(() => origen().eq('codigo', codigo).maybeSingle());
  if (!reserva) throw HttpError.noEncontrado('No encontramos una reserva con ese código.');
  return normalizarReserva(reserva);
}

/** Reserva del día (GET /api/reservas/hoy). */
async function listarHoy(filtros = {}, usuario) {
  const hoy = hoyISO();
  return listar({ ...filtros, fecha: hoy, pagina: 1, limite: 500 }, usuario);
}

/** Próximas reservas a partir de ahora, para el dashboard. */
async function proximas(limite = 8) {
  const limiteNum = Math.min(validarEntero(limite, 'limite', { min: 1, max: 50 }), 50);
  const ahora = new Date();
  const hoy = hoyISO();

  const { datos } = await paginar(
    origen()
      .in('estado', ['pendiente', 'confirmada'])
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true }),
    0,
    limiteNum * 3
  );

  // Filtra las de hoy que ya pasaron y ordena por instante real.
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  const futuras = datos
    .filter((r) => {
      if (r.fecha > hoy) return true;
      const [h, m] = String(r.hora).slice(0, 5).split(':').map(Number);
      return h * 60 + m >= ahoraMin;
    })
    .sort((a, b) => String(a.fecha + a.hora).localeCompare(String(b.fecha + b.hora)));

  return futuras.slice(0, limiteNum).map(normalizarReserva);
}

/** Reservas del usuario autenticado (GET /api/reservas/mias). */
async function listarMias(usuario) {
  if (!usuario?.clienteId) return [];
  const resultado = await listar({ clienteId: usuario.clienteId, limite: 200, pagina: 1 }, usuario);
  return resultado.reservas;
}

// ---------------------------------------------------------------------------
// Alta y modificación
// ---------------------------------------------------------------------------

/**
 * Crea una reserva.
 *
 * @param {object} cuerpo
 * @param {object|null} usuario  Usuario autenticado, o null si es un invitado.
 */
async function crear(cuerpo, usuario) {
  const {
    clienteId,
    mesaId,
    fecha,
    hora,
    personas,
    observaciones,
    // Datos de contacto del invitado (obligatorios si no hay sesión iniciada)
    nombre,
    apellido,
    email,
    telefono,
  } = cuerpo;

  const fechaLimpia = validarFecha(fecha, 'fecha');
  const horaLimpia = validarHora(hora);
  const personasLimpio = validarEntero(personas, 'personas', { min: 1, max: 40 });
  const mesaIdLimpio = validarId(mesaId, 'mesaId');
  const notas = validarTexto(observaciones, 'observaciones', { min: 0, max: 500, esRequerido: false });

  validarVentanaDeReserva(fechaLimpia, horaLimpia);

  const clienteIdResuelto = await resolverCliente({
    usuario,
    clienteId,
    nombre,
    apellido,
    email,
    telefono,
  });

  const mesa = await obtenerMesaOperativa(mesaIdLimpio);
  await obtenerClienteOperativo(clienteIdResuelto);

  if (personasLimpio > mesa.capacidad) {
    throw HttpError.noProcesable(
      `La mesa ${mesa.numero} tiene ${mesa.capacidad} lugares y la reserva es para ${personasLimpio} personas.`
    );
  }

  await afirmarSinSolapamiento({
    mesaId: mesaIdLimpio,
    fecha: fechaLimpia,
    hora: horaLimpia,
    excluirId: null,
  });

  const payload = {
    cliente_id: clienteIdResuelto,
    mesa_id: mesaIdLimpio,
    fecha: fechaLimpia,
    hora: `${horaLimpia}:00`,
    personas: personasLimpio,
    estado: 'pendiente',
    observaciones: notas,
  };

  // El trigger fn_reservas_validar_superposicion y la restricción EXCLUDE
  // de la base de datos siguen siendo la última línea de defensa.
  const reserva = await db.ejecutar(() =>
    db.admin.from('reservas').insert(payload).select('id, codigo').single()
  );

  return obtenerPorId(reserva.id, usuario);
}

/**
 * Actualiza una reserva.
 * El admin puede cambiar todo; el cliente sólo puede mover o cancelar la suya
 * mientras siga en estado 'pendiente'.
 */
async function actualizar(id, cuerpo, usuario) {
  const reservaId = validarId(id, 'id');
  const esAdmin = usuario?.rol === ROL_ADMIN;

  // IMPORTANTE: siempre vía `db.ejecutar()`. Con @supabase/supabase-js v2.117
  // un `await builder` directo devuelve el envoltorio de la respuesta
  // ({ data, error, count, status }) en lugar de la fila, y `fila.estado`
  // daría undefined.
  const actual = await db.ejecutar(() =>
    db.admin.from('reservas').select('*').eq('id', reservaId).maybeSingle()
  );
  if (!actual) throw HttpError.noEncontrado('La reserva solicitada no existe.');
  afirmarAcceso(actual, usuario);

  const cambios = {};

  if (cuerpo.fecha !== undefined) cambios.fecha = validarFecha(cuerpo.fecha, 'fecha');
  if (cuerpo.hora !== undefined) cambios.hora = `${validarHora(cuerpo.hora)}:00`;
  if (cuerpo.personas !== undefined) {
    cambios.personas = validarEntero(cuerpo.personas, 'personas', { min: 1, max: 40 });
  }
  if (cuerpo.observaciones !== undefined) {
    cambios.observaciones = validarTexto(cuerpo.observaciones, 'observaciones', {
      min: 0,
      max: 500,
      esRequerido: false,
    });
  }
  if (cuerpo.estado !== undefined) {
    if (!esAdmin) {
      throw HttpError.prohibido('No tienes permisos para cambiar el estado de una reserva.');
    }
    const estado = normalizar(cuerpo.estado);
    if (!ESTADOS.includes(estado)) {
      throw HttpError.badRequest(`Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}.`);
    }
    cambios.estado = estado;
  }
  if (cuerpo.mesaId !== undefined) {
    if (!esAdmin) {
      throw HttpError.prohibido('Solo el administrador puede cambiar la mesa de una reserva.');
    }
    cambios.mesa_id = validarId(cuerpo.mesaId, 'mesaId');
  }

  if (Object.keys(cambios).length === 0) {
    throw HttpError.badRequest('No se envió ningún campo para actualizar.');
  }

  const fechaFinal = cambios.fecha ?? actual.fecha;
  const horaFinal = String(cambios.hora ?? actual.hora).slice(0, 5);
  const mesaFinal = cambios.mesa_id ?? actual.mesa_id;
  const personasFinal = cambios.personas ?? actual.personas;

  if (!esAdmin && cambios.estado && cambios.estado !== 'cancelada') {
    throw HttpError.prohibido('No tienes permisos para realizar esta acción.');
  }

  if (cambios.estado && cambios.estado !== actual.estado) {
    afirmarTransicion(actual.estado, cambios.estado);
  }

  await afirmarVentanaYNaturalmenteEditable({ fecha: fechaFinal, hora: horaFinal, actual, esAdmin });

  // La reserva sigue ocupando mesa: hay que comprobar que la franja no chocó
  // con otra reserva al mover fecha, hora o mesa.
  await afirmarSinSolapamiento({
    mesaId: mesaFinal,
    fecha: fechaFinal,
    hora: horaFinal,
    excluirId: reservaId,
  });

  await db.ejecutar(() => db.admin.from('reservas').update(cambios).eq('id', reservaId));

  return obtenerPorId(reservaId, usuario);
}

/** PUT /api/reservas/:id/confirmar */
async function confirmar(id, usuario) {
  return cambiarEstado(id, 'confirmada', usuario);
}

/** PUT /api/reservas/:id/cancelar */
async function cancelar(id, usuario) {
  return cambiarEstado(id, 'cancelada', usuario);
}

/** PUT /api/reservas/:id/completar */
async function completar(id, usuario) {
  return cambiarEstado(id, 'completada', usuario);
}

/** DELETE /api/reservas/:id → cancelación lógica (nunca se borra el histórico). */
async function eliminar(id, usuario) {
  const reservaId = validarId(id, 'id');

  const reserva = await db.ejecutar(() =>
    db.admin.from('reservas').select('id, estado').eq('id', reservaId).maybeSingle()
  );
  if (!reserva) throw HttpError.noEncontrado('La reserva solicitada no existe.');
  afirmarAcceso(reserva, usuario);

  if (reserva.estado === 'cancelada') {
    return { id: reservaId, mensaje: 'La reserva ya estaba cancelada.' };
  }

  return cambiarEstado(reservaId, 'cancelada', usuario);
}

async function cambiarEstado(id, destino, usuario) {
  const reservaId = validarId(id, 'id');

  const actual = await db.ejecutar(() =>
    db.admin.from('reservas').select('*').eq('id', reservaId).maybeSingle()
  );
  if (!actual) throw HttpError.noEncontrado('La reserva solicitada no existe.');
  afirmarAcceso(actual, usuario);

  if (actual.estado === destino) {
    throw HttpError.conflicto(`La reserva ya está en estado "${destino}".`);
  }

  afirmarTransicion(actual.estado, destino);

  // Volver a ocupar la mesa exige comprobar que la franja sigue libre.
  if (destino === 'confirmada' || destino === 'pendiente') {
    await afirmarSinSolapamiento({
      mesaId: actual.mesa_id,
      fecha: actual.fecha,
      hora: String(actual.hora).slice(0, 5),
      excluirId: reservaId,
    });
  }

  await db.ejecutar(() => db.admin.from('reservas').update({ estado: destino }).eq('id', reservaId));

  return obtenerPorId(reservaId, usuario);
}

// ---------------------------------------------------------------------------
// Reglas de negocio
// ---------------------------------------------------------------------------

/**
 * Determina el cliente de la reserva.
 *  - Admin: debe indicar un clienteId válido.
 *  - Cliente autenticado: se usa su clienteId; los datos de contacto opcionales
 *    actualizan su ficha.
 *  - Invitado: se crea (o reutiliza) un cliente a partir de los datos enviados.
 */
async function resolverCliente({ usuario, clienteId, nombre, apellido, email, telefono }) {
  if (usuario?.rol === ROL_ADMIN && clienteId) {
    return validarId(clienteId, 'clienteId');
  }

  if (usuario?.clienteId) {
    const contacto = {};
    if (nombre !== undefined) contacto.nombre = validarTexto(nombre, 'nombre', { min: 2, max: 80 });
    if (telefono !== undefined) contacto.telefono = validarTelefono(telefono);

    if (Object.keys(contacto).length > 0) {
      await db.ejecutar(() => db.admin.from('clientes').update(contacto).eq('id', usuario.clienteId));
    }
    return usuario.clienteId;
  }

  if (clienteId) {
    return validarId(clienteId, 'clienteId');
  }

  // Invitado: necesita todos los datos de contacto.
  const nombreLimpio = validarTexto(nombre, 'nombre', { min: 2, max: 80 });
  const apellidoLimpio = validarTexto(apellido, 'apellido', { min: 2, max: 80 });
  const emailLimpio = validarEmail(email);
  const telefonoLimpio = validarTelefono(telefono, { requerido: true });

  const existente = await db.ejecutar(() =>
    db.admin.from('clientes').select('id').eq('email', emailLimpio).maybeSingle()
  );

  if (existente) {
    await db.ejecutar(() =>
      db.admin
        .from('clientes')
        .update({ nombre: nombreLimpio, apellido: apellidoLimpio, telefono: telefonoLimpio })
        .eq('id', existente.id)
    );
    return existente.id;
  }

  const creado = await db.ejecutar(() =>
    db.admin
      .from('clientes')
      .insert({
        nombre: nombreLimpio,
        apellido: apellidoLimpio,
        email: emailLimpio,
        telefono: telefonoLimpio,
      })
      .select('id')
      .single()
  );

  return Number(creado.id);
}

async function obtenerMesaOperativa(mesaId) {
  const mesa = await db.ejecutar(() =>
    db.admin.from('mesas').select('id, numero, capacidad, estado').eq('id', mesaId).maybeSingle()
  );

  if (!mesa) throw HttpError.noProcesable('La mesa seleccionada no existe.');
  if (mesa.estado === 'mantenimiento') {
    throw HttpError.conflicto(`La mesa ${mesa.numero} está en mantenimiento y no admite reservas.`);
  }
  return mesa;
}

async function obtenerClienteOperativo(clienteId) {
  const cliente = await db.ejecutar(() =>
    db.admin.from('clientes').select('id').eq('id', clienteId).maybeSingle()
  );
  if (!cliente) throw HttpError.noProcesable('El cliente indicado no existe.');
  return cliente;
}

/**
 * VERIFICACIÓN DE LA REGLA FUNDAMENTAL.
 * Delega en fn_reservas_conflictantes(), que aplica el mismo operador
 * OVERLAPS que usa la restricción EXCLUDE de la base de datos.
 */
async function afirmarSinSolapamiento({ mesaId, fecha, hora, excluirId }) {
  const conflictos = await db.ejecutar(() =>
    db.admin.rpc('fn_reservas_conflictantes', {
      p_mesa_id: mesaId,
      p_fecha: fecha,
      p_hora: `${hora}:00`,
      p_excluir_id: excluirId ?? null,
    })
  );

  if ((conflictos || []).length > 0) {
    const detalle = conflictos.map((c) => c.codigo).join(', ');
    throw HttpError.conflicto(
      'La mesa seleccionada ya fue reservada para ese horario. Elegí otra mesa u otro horario.',
      { conflicto: detalle }
    );
  }

  await afirmarCupoDeFranja({ fecha, hora, excluirId });
}

/**
 * Límite operativo del salón: no se admiten más de N reservas activas en la
 * misma fecha y hora de inicio. Evita que una franja se sature y el servicio
 * se degrade. Configurable con LIMITE_RESERVAS_POR_FRANJA.
 */
async function afirmarCupoDeFranja({ fecha, hora, excluirId }) {
  let consulta = db.admin
    .from('reservas')
    .select('id', { count: 'exact', head: true })
    .eq('fecha', fecha)
    .eq('hora', `${hora}:00`)
    .in('estado', ['pendiente', 'confirmada']);

  if (excluirId) consulta = consulta.neq('id', excluirId);

  const { count, error } = await consulta;
  if (error || count === null) return;

  if (count >= config.limiteReservasPorFranja) {
    throw HttpError.conflicto('La franja horaria está completa para ese día. Contactá al restaurante.');
  }
}

function afirmarTransicion(actual, destino) {
  const permitidas = TRANSICIONES[actual] ?? [];
  if (!permitidas.includes(destino)) {
    throw HttpError.conflicto(
      `No se puede pasar una reserva de "${actual}" a "${destino}". ` +
        `Transiciones válidas: ${permitidas.length ? permitidas.join(', ') : 'ninguna'}.`
    );
  }
}

/**
 * Un cliente sólo puede tocar su reserva si sigue 'pendiente'.
 * El administrador puede actuar siempre.
 */
async function afirmarVentanaYNaturalmenteEditable({ fecha, hora, actual, esAdmin }) {
  if (esAdmin) return;
  if (actual.estado !== 'pendiente') {
    throw HttpError.prohibido('No tienes permisos para realizar esta acción.');
  }
  validarVentanaDeReserva(fecha, hora);
}

/** Control de acceso por propietario. */
function afirmarAcceso(registro, usuario) {
  if (!usuario) throw HttpError.noAutorizado('Debes iniciar sesión para realizar esta acción.');
  if (usuario.rol === ROL_ADMIN) return;

  if (!usuario.clienteId) {
    throw HttpError.prohibido('Tu cuenta no está asociada a un cliente registrado.');
  }
  if (Number(registro.cliente_id) !== Number(usuario.clienteId)) {
    throw HttpError.prohibido('No tienes permisos para modificar reservas de otro cliente.');
  }
}

/** Ejecuta una consulta paginada en PostgREST y devuelve datos + total. */
async function paginar(consulta, desde, limite) {
  const { data, error, count } = await consulta.range(desde, desde + limite - 1);
  if (error) throw error;
  return { datos: data || [], total: count ?? (data || []).length };
}

/** Mapea la fila de v_reservas al formato que consume el frontend. */
function normalizarReserva(reserva) {
  return {
    id: Number(reserva.id),
    codigo: reserva.codigo,
    clienteId: Number(reserva.cliente_id),
    cliente: {
      id: Number(reserva.cliente_id),
      nombre: reserva.cliente_nombre,
      apellido: reserva.cliente_apellido,
      nombreCompleto: normalizarTexto(`${reserva.cliente_nombre ?? ''} ${reserva.cliente_apellido ?? ''}`),
      email: reserva.cliente_email,
      telefono: reserva.cliente_telefono,
    },
    mesaId: Number(reserva.mesa_id),
    mesa: {
      id: Number(reserva.mesa_id),
      numero: Number(reserva.mesa_numero),
      capacidad: Number(reserva.mesa_capacidad),
      ubicacion: reserva.mesa_ubicacion,
      estado: reserva.mesa_estado,
    },
    fecha: reserva.fecha,
    hora: normalizarHora(reserva.hora),
    personas: Number(reserva.personas),
    estado: reserva.estado,
    observaciones: reserva.observaciones,
    createdAt: reserva.created_at,
  };
}

module.exports = {
  ESTADOS,
  TRANSICIONES,
  listar,
  listarHoy,
  listarMias,
  obtenerPorId,
  obtenerPorCodigo,
  proximas,
  crear,
  actualizar,
  confirmar,
  cancelar,
  completar,
  eliminar,
  /** Reutilizado por clienteService para no duplicar el mapeo de la vista. */
  normalizarReserva,
};
