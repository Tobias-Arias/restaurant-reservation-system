/**
 * Validadores de entrada del backend.
 *
 * REGLA: el frontend valida para dar una buena experiencia, pero NADA se da por
 * válido aquí. Toda la lógica de negocio se revalida en Node.js antes de tocar
 * la base de datos, y la base de datos vuelve a validar con CHECK/FK/triggers.
 */

const HttpError = require('./HttpError');
const { esSlotValido, obtenerTurnos, HORARIOS } = require('../config/horarios');
const { fnDuracionReservaSql } = require('./consistencia');

const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const RE_TELEFONO = /^\+?[0-9 ()\-]{6,20}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_CODIGO = /^RSV-[0-9A-Z]{6}$/;

/** Normaliza un texto: recorta, colapsa espacios y pasa a minúsculas. */
const normalizar = (valor) => String(valor ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Normaliza un nombre propio: recorta y colapsa espacios (sin tocar mayúsculas). */
const normalizarTexto = (valor) => String(valor ?? '').trim().replace(/\s+/g, ' ');

/** Lanza 400 si el campo no viene o viene vacío. */
function requerido(valor, nombreCampo) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    throw HttpError.badRequest(`El campo "${nombreCampo}" es obligatorio.`, { campo: nombreCampo });
  }
  return String(valor).trim();
}

function validarEmail(valor, { requerido: esRequerido = true } = {}) {
  if ((valor === undefined || valor === null || String(valor).trim() === '') && !esRequerido) {
    return null;
  }
  const email = normalizar(requerido(valor, 'email'));
  if (!RE_EMAIL.test(email)) {
    throw HttpError.badRequest('El email no tiene un formato válido.', { campo: 'email' });
  }
  return email;
}

function validarTelefono(valor, { requerido: esRequerido = false } = {}) {
  const texto = normalizarTexto(valor ?? '');
  if (!texto) {
    if (esRequerido) throw HttpError.badRequest('El campo "teléfono" es obligatorio.', { campo: 'telefono' });
    return null;
  }
  if (!RE_TELEFONO.test(texto)) {
    throw HttpError.badRequest('El teléfono no tiene un formato válido.', { campo: 'telefono' });
  }
  return texto;
}

function validarTexto(valor, nombreCampo, { min = 2, max = 120, esRequerido = true } = {}) {
  const texto = normalizarTexto(valor ?? '');
  if (!texto) {
    if (esRequerido) throw HttpError.badRequest(`El campo "${nombreCampo}" es obligatorio.`, { campo: nombreCampo });
    return null;
  }
  if (texto.length < min) {
    throw HttpError.badRequest(`"${nombreCampo}" debe tener al menos ${min} caracteres.`, { campo: nombreCampo });
  }
  if (texto.length > max) {
    throw HttpError.badRequest(`"${nombreCampo}" no puede superar los ${max} caracteres.`, { campo: nombreCampo });
  }
  return texto;
}

function validarContrasena(valor) {
  const contrasena = requerido(valor, 'contrasena');
  if (contrasena.length < 8) {
    throw HttpError.badRequest('La contraseña debe tener al menos 8 caracteres.', { campo: 'contrasena' });
  }
  if (contrasena.length > 72) {
    // Límite de bcrypt
    throw HttpError.badRequest('La contraseña es demasiado larga (máximo 72 caracteres).', { campo: 'contrasena' });
  }
  if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
    throw HttpError.badRequest('La contraseña debe incluir al menos una letra y un número.', { campo: 'contrasena' });
  }
  return contrasena;
}

/** Convierte a entero y valida rango. */
function validarEntero(valor, nombreCampo, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numero = Number(valor);
  if (!Number.isInteger(numero)) {
    throw HttpError.badRequest(`"${nombreCampo}" debe ser un número entero.`, { campo: nombreCampo });
  }
  if (numero < min || numero > max) {
    throw HttpError.badRequest(`"${nombreCampo}" debe estar entre ${min} y ${max}.`, { campo: nombreCampo });
  }
  return numero;
}

/** Convierte a número decimal y valida rango. */
function validarDecimal(valor, nombreCampo, { min = 0, max = 1_000_000 } = {}) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw HttpError.badRequest(`"${nombreCampo}" debe ser un número.`, { campo: nombreCampo });
  }
  if (numero < min || numero > max) {
    throw HttpError.badRequest(`"${nombreCampo}" debe estar entre ${min} y ${max}.`, { campo: nombreCampo });
  }
  return Math.round(numero * 100) / 100;
}

/** "YYYY-MM-DD" y una fecha real y no futura si así se indica. */
function validarFecha(valor, nombreCampo = 'fecha', { permitirPasado = false } = {}) {
  const texto = requerido(valor, nombreCampo);
  if (!RE_FECHA.test(texto)) {
    throw HttpError.badRequest('La fecha debe tener el formato AAAA-MM-DD.', { campo: nombreCampo });
  }
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw HttpError.badRequest('La fecha no es válida.', { campo: nombreCampo });
  }
  if (!permitirPasado && texto < hoyISO()) {
    throw HttpError.badRequest('No se pueden hacer reservas para fechas pasadas.', { campo: nombreCampo });
  }
  return texto;
}

/** "HH:MM" y dentro de los horarios de atención configurados. */
function validarHora(valor, { conReserva = true } = {}) {
  const texto = requerido(valor, 'hora');
  if (!RE_HORA.test(texto)) {
    throw HttpError.badRequest('La hora debe tener el formato HH:MM.', { campo: 'hora' });
  }
  if (conReserva && !esSlotValido(texto)) {
    const turnos = obtenerTurnos()
      .map((t) => `${t.turno} (${t.slots.join(', ')})`)
      .join(' · ');
    throw HttpError.badRequest(
      `El horario seleccionado no es válido. Horarios disponibles — ${turnos}. Cada reserva dura ${HORARIOS.duracionMinutos} minutos.`,
      { campo: 'hora', disponibles: obtenerTurnos().flatMap((t) => t.slots) }
    );
  }
  return texto;
}

/** Un id numérico coming de la ruta (? o :id). */
function validarId(valor, nombreCampo = 'id') {
  return validarEntero(valor, nombreCampo, { min: 1 });
}

function validarCodigoReserva(valor) {
  const texto = requerido(valor, 'codigo').toUpperCase();
  if (!RE_CODIGO.test(texto)) {
    throw HttpError.badRequest('El código de reserva no tiene un formato válido.', { campo: 'codigo' });
  }
  return texto;
}

/** Verifica que fecha y hora estén dentro de la ventana de reserva permitida. */
function validarVentanaDeReserva(fecha, hora) {
  const hoy = hoyISO();
  if (fecha < hoy) {
    throw HttpError.badRequest('No se pueden hacer reservas para fechas pasadas.');
  }

  const limite = new Date();
  limite.setDate(limite.getDate() + HORARIOS.anticipacionMaximaDias);
  if (fecha > limite.toISOString().slice(0, 10)) {
    throw HttpError.badRequest(
      `Solo se puede reservar con hasta ${HORARIOS.anticipacionMaximaDias} días de anticipación.`
    );
  }

  if (fecha === hoy) {
    const [h, m] = hora.split(':').map(Number);
    const minutosAhora = new Date().getHours() * 60 + new Date().getMinutes();
    if (minutosAhora + HORARIOS.anticipacionMinimaHoras * 60 > h * 60 + m) {
      throw HttpError.badRequest('Ese horario ya pasó. Elegí un horario más adelante.');
    }
  }
}

const hoyISO = () => {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset() * 60_000;
  return new Date(ahora.getTime() - offset).toISOString().slice(0, 10);
};

/**
 * Comprueba que la duración configurada en Node.js coincide con la que usa la
 * base de datos. Si divergen, la regla de no solapamiento daría resultados
 * distintos en la API y en el motor: es un error de despliegue grave.
 */
async function verificarCoherenciaHorarios() {
  const enBaseDeDatos = await fnDuracionReservaSql();
  if (HORARIOS.duracionMinutos !== enBaseDeDatos) {
    throw new Error(
      `Configuración incoherente: la reserva dura ${HORARIOS.duracionMinutos} minutos en el backend ` +
        `y ${enBaseDeDatos} minutos en fn_duracion_reserva() (database/schema.sql).`
    );
  }
}

module.exports = {
  RE_EMAIL,
  RE_TELEFONO,
  RE_FECHA,
  RE_HORA,
  RE_CODIGO,
  normalizar,
  normalizarTexto,
  requerido,
  validarEmail,
  validarTelefono,
  validarTexto,
  validarContrasena,
  validarEntero,
  validarDecimal,
  validarFecha,
  validarHora,
  validarId,
  validarCodigoReserva,
  validarVentanaDeReserva,
  verificarCoherenciaHorarios,
  hoyISO,
};
