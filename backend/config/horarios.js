/**
 * Configuración de negocio del restaurante.
 *
 * TODO lo relativo al horario de atención y a la duración de las reservas
 * vive aquí. Para cambiarlo no hace falta tocar ni el frontend ni el SQL:
 * se edita este archivo (o se sobreescribe con variables de entorno).
 *
 * IMPORTANTE
 * La duración de la reserva (HORARIOS.duracionMinutos) debe coincidir con la
 * función SQL `fn_duracion_reserva()` definida en database/schema.sql.
 * Se verifica al arrancar el servidor (ver utils/validators.js).
 */

// "HH:MM"
const HORA = (valor) => {
  const [h, m] = valor.split(':').map(Number);
  return h * 60 + m;
};

const HORARIOS = {
  /** Duración de cada reserva, en minutos. Define la franja que ocupa una mesa. */
  duracionMinutos: Number(process.env.RESERVA_DURACION_MIN || 90),

  /** Días de atención: 0 = domingo ... 6 = sábado. El restaurante abre todos. */
  diasAtencion: [0, 1, 2, 3, 4, 5, 6],

  /**
   * Turnos. Para cada uno:
   *   - inicio: hora de apertura del turno
   *   - fin:    hora de cierre del turno
   *   - slots:  lista explícita de horas de inicio admitidas.
   *             Si se omite, se generan automáticamente cada
   *             `duracionMinutos` minutos desde `inicio`, siempre que la
   *             reserva termine antes o justo en `fin`.
   */
  turnos: [
    {
      nombre: 'Almuerzo',
      inicio: '11:00',
      fin: '15:00',
    },
    {
      nombre: 'Cena',
      inicio: '18:00',
      fin: '23:00',
    },
  ],

  /**
   * Margen hacia adelante para aceptar reservas (horas).
   * Evita que alguien reserve para dentro de 2 minutos.
   */
  anticipacionMinimaHoras: Number(process.env.RESERVA_ANTICIPACION_MIN_HORAS || 0),

  /** Días hacia adelante en los que se puede reservar. */
  anticipacionMaximaDias: Number(process.env.RESERVA_ANTICIPACION_MAX_DIAS || 90),
};

/**
 * Devuelve la lista de horas de inicio válidas agrupadas por turno.
 * @returns {{turno: string, inicio: string, fin: string, slots: string[] }[]}
 */
function obtenerTurnos() {
  const duracion = HORARIOS.duracionMinutos;

  return HORARIOS.turnos.map((turno) => {
    const inicio = HORA(turno.inicio);
    const fin = HORA(turno.fin);

    const slots = turno.slots
      ? turno.slots.slice()
      : (() => {
          const lista = [];
          for (let minuto = inicio; minuto + duracion <= fin; minuto += duracion) {
            lista.push(minutoAMinutosLegible(minuto));
          }
          return lista;
        })();

    return {
      turno: turno.nombre,
      inicio: turno.inicio,
      fin: turno.fin,
      slots,
    };
  });
}

/** Lista plana y ordenada de todas las horas de inicio admitidas. */
function obtenerSlotsValidos() {
  return obtenerTurnos()
    .flatMap((t) => t.slots)
    .sort();
}

/** ¿La hora `hora` (HH:MM) es una hora de inicio válida? */
function esSlotValido(hora) {
  return obtenerSlotsValidos().includes(hora);
}

/** Nombre del turno al que pertenece una hora, o null si no aplica. */
function turnoDe(hora) {
  return obtenerTurnos().find((t) => t.slots.includes(hora))?.turno ?? null;
}

function minutoAMinutosLegible(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** "HH:MM" -> minutos desde medianoche. */
function aMinutos(hora) {
  return HORA(hora);
}

module.exports = {
  HORARIOS,
  obtenerTurnos,
  obtenerSlotsValidos,
  esSlotValido,
  turnoDe,
  aMinutos,
  minutoAMinutosLegible,
};
