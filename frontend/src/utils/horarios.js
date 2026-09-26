/**
 * Fuente de verdad de los horarios en el frontend.
 *
 * IMPORTANTE: el frontend NO inventa la agenda. La pide al backend
 * (GET /api/estadisticas/horarios) y la cachea en memoria. Así el backend
 * sigue siendo la única autoridad y un cambio en backend/config/horarios.js
 * se refleja automáticamente sin tocar React.
 *
 * Si la API no responde, se usan estos valores como respaldo para que la
 * página siga siendo utilizable: el backend volverá a validarlos de todas
 * formas al crear la reserva.
 */

const HORARIOS_POR_DEFECTO = {
  duracionMinutos: 90,
  anticipacionMaximaDias: 90,
  turnos: [
    { turno: 'Almuerzo', inicio: '11:00', fin: '15:00', slots: ['11:00', '12:30'] },
    { turno: 'Cena', inicio: '18:00', fin: '23:00', slots: ['18:00', '19:30', '21:00'] },
  ],
};

let cache = HORARIOS_POR_DEFECTO;

/** Lee la configuración cacheada (síncrono, para renderizar de inmediato). */
export const obtenerTurnos = () => cache.turnos;

export const obtenerSlots = () => cache.turnos.flatMap((turno) => turno.slots);

export const obtenerDuracion = () => cache.duracionMinutos;

export const obtenerAnticipacionMaxima = () => cache.anticipacionMaximaDias;

/**
 * Descarga la configuración desde el backend. Devuelve los horarios
 * aplicables incluso si la petición falla (usa el respaldo).
 */
export async function cargarHorarios(estadisticaApi) {
  try {
    const { data } = await estadisticaApi.horarios();
    if (data?.turnos?.length) {
      cache = {
        duracionMinutos: data.duracionMinutos ?? cache.duracionMinutos,
        anticipacionMaximaDias: data.anticipacionMaximaDias ?? cache.anticipacionMaximaDias,
        turnos: data.turnos,
      };
    }
  } catch {
    // Se conserva el respaldo. El backend valida igualmente.
  }
  return cache;
}
