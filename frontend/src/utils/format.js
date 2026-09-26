/**
 * Utilidades de formato (presentación).
 * Se separan de validation.js: aquí no se valida, se presenta.
 */

const LOCALE = 'es-AR';
const MONEDA = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const NUMERO = new Intl.NumberFormat(LOCALE);

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** 28.50 -> "$ 28,50" */
export const precio = (valor) => MONEDA.format(Number(valor) || 0);

/** 1280 -> "1.280" */
export const numero = (valor) => NUMERO.format(Number(valor) || 0);

/** 4 -> "4 lugares" */
export const capacidad = (valor) => `${numero(valor)} ${Number(valor) === 1 ? 'lugar' : 'lugares'}`;

/** "2026-09-15" -> Date local (sin desfase por zona horaria). */
export const aFecha = (iso) => {
  if (!iso) return null;
  const soloFecha = String(iso).slice(0, 10);
  const [anio, mes, dia] = soloFecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
};

/** "2026-09-15" -> "martes, 15 de septiembre de 2026" */
export const fechaLarga = (iso) => {
  const fecha = aFecha(iso);
  if (!fecha) return '';
  return `${DIAS[fecha.getDay()]}, ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
};

/** "2026-09-15" -> "15 sep" */
export const fechaCorta = (iso) => {
  const fecha = aFecha(iso);
  if (!fecha) return '';
  return `${fecha.getDate()} ${MESES[fecha.getMonth()].slice(0, 3)}`;
};

/** "2026-09-15" -> "15/09/2026" */
export const fechaNumerica = (iso) => {
  const fecha = aFecha(iso);
  if (!fecha) return '';
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
};

/** "2026-09-15" -> "Hoy" / "Mañana" / "15 sep" */
export const fechaRelativa = (iso) => {
  const fecha = aFecha(iso);
  if (!fecha) return '';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((fecha - hoy) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return fechaCorta(iso);
};

/** "19:30:00" o "19:30" -> "19:30" */
export const hora = (valor) => (valor ? String(valor).slice(0, 5) : '');

/** "19:30" -> "19:30 - 21:00" */
export const rangoHora = (horaInicio, duracionMinutos = 90) => {
  const fin = sumarMinutos(horaInicio, duracionMinutos);
  return fin ? `${hora(horaInicio)} - ${fin}` : '';
};

/** "19:30" + 90 min -> "21:00". Única implementación en todo el proyecto. */
export function sumarMinutos(horaBase, minutos = 0) {
  if (!horaBase) return null;
  const [h, m] = hora(horaBase).split(':').map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "2026-09-15T18:30:00Z" -> "15/09/2026 18:30" */
export const fechaHora = (isoCompleto) => {
  if (!isoCompleto) return '';
  const fecha = new Date(isoCompleto);
  if (Number.isNaN(fecha.getTime())) return '';
  return `${fechaNumerico(fecha.toISOString())} ${String(fecha.getHours()).padStart(2, '0')}:${String(
    fecha.getMinutes()
  ).padStart(2, '0')}`;
};

/** "2026-09" -> "septiembre 2026" */
export const mesAnio = (ym) => {
  if (!ym) return '';
  const [anio, mes] = String(ym).split('-').map(Number);
  if (!anio || !mes) return ym;
  return `${MESES[mes - 1]} ${anio}`;
};

/** "2026-09" -> "sep 26" para etiquetas de gráfico */
export const mesCorto = (ym) => {
  if (!ym) return '';
  const [anio, mes] = String(ym).split('-').map(Number);
  if (!anio || !mes) return ym;
  return `${MESES[mes - 1].slice(0, 3)} ${String(anio).slice(2)}`;
};

/** Estados de reserva -> etiqueta y clase CSS. */
export const ESTADOS_RESERVA = {
  pendiente: { etiqueta: 'Pendiente', clase: 'is-pendiente' },
  confirmada: { etiqueta: 'Confirmada', clase: 'is-confirmada' },
  cancelada: { etiqueta: 'Cancelada', clase: 'is-cancelada' },
  completada: { etiqueta: 'Completada', clase: 'is-completada' },
};

export const ESTADOS_MESA = {
  disponible: { etiqueta: 'Disponible', clase: 'is-disponible' },
  mantenimiento: { etiqueta: 'Mantenimiento', clase: 'is-mantenimiento' },
};

export const ESTADOS_PEDIDO = {
  pendiente: { etiqueta: 'Pendiente', clase: 'is-pendiente' },
  preparado: { etiqueta: 'Preparado', clase: 'is-confirmada' },
  entregado: { etiqueta: 'Entregado', clase: 'is-completada' },
  cancelado: { etiqueta: 'Cancelado', clase: 'is-cancelada' },
};

export const UBICACIONES = {
  interior: 'Interior',
  terraza: 'Terraza',
  ventana: 'Ventana',
  barra: 'Barra',
  privada: 'Sala privada',
};

export const estadoReserva = (estado) =>
  ESTADOS_RESERVA[estado] ?? { etiqueta: estado ?? 'Desconocido', clase: 'is-neutro' };

export const estadoMesa = (estado) =>
  ESTADOS_MESA[estado] ?? { etiqueta: estado ?? 'Desconocido', clase: 'is-neutro' };

export const ubicacion = (valor) => UBICACIONES[valor] ?? (valor ?? '—');

/** Iniciales para el avatar del encabezado (ej: "Laura Gómez" -> "LG"). */
export const iniciales = (nombre = '') =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('') || '?';
