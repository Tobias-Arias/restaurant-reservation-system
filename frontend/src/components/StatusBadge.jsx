/**
 * Distintivo de estado reutilizable (reservas, mesas, pedidos).
 */

import { ESTADOS_MESA, ESTADOS_PEDIDO, ESTADOS_RESERVA } from '../utils/format';

const ESTADOS = {
  ...ESTADOS_RESERVA,
  ...ESTADOS_MESA,
  ...ESTADOS_PEDIDO,
};

export default function StatusBadge({ estado }) {
  const config = ESTADOS[estado] ?? { etiqueta: estado ?? 'Desconocido', clase: 'is-neutro' };
  return <span className={`badge ${config.clase}`}>{config.etiqueta}</span>;
}
