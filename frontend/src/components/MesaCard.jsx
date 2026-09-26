/**
 * Tarjeta de mesa.
 *
 * Se usa en dos contextos:
 *  - selector de mesas disponibles (pulsable, muestra acción "Seleccionar"),
 *  - grilla de inventario del panel administrativo.
 */

import { capacidad as textoCapacidad, estadoMesa, ubicacion as textoUbicacion } from '../utils/format';
import Button from './Button';

export default function MesaCard({
  mesa,
  seleccionada = false,
  onSeleccionar,
  onEditar,
  onCambiarEstado,
  pie,
}) {
  const estado = estadoMesa(mesa.estado);
  const seleccionable = Boolean(onSeleccionar) && mesa.estado === 'disponible';

  const clases = [
    'mesa-card',
    seleccionada ? 'is-seleccionada' : '',
    seleccionable ? 'es-seleccionable' : '',
    mesa.estado === 'mantenimiento' ? 'is-bloqueada' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={clases} aria-pressed={seleccionada}>
      <header className="mesa-card__header">
        <span className="mesa-card__numero" aria-label={`Mesa número ${mesa.numero}`}>
          {mesa.numero}
        </span>
        <span className={`badge ${estado.clase}`}>{estado.etiqueta}</span>
      </header>

      <div className="mesa-card__datos">
        <p className="mesa-card__capacidad">
          <span aria-hidden="true">🪑</span> {textoCapacidad(mesa.capacidad)}
        </p>
        <p className="mesa-card__ubicacion">
          <span aria-hidden="true">📍</span> {textoUbicacion(mesa.ubicacion)}
        </p>
      </div>

      {mesa.reserva && (
        <div className="mesa-card__ocupacion">
          <p>
            <strong>{mesa.reserva.codigo}</strong> · {mesa.reserva.hora}
          </p>
          <p>{mesa.reserva.personas} personas</p>
        </div>
      )}

      <footer className="mesa-card__footer">
        {seleccionable && (
          <Button
            variante={seleccionada ? 'exito' : 'primario'}
            tamano="pequeno"
            onClick={onSeleccionar}
            className="btn--completo"
          >
            {seleccionada ? 'Mesa seleccionada' : 'Seleccionar'}
          </Button>
        )}

        {onEditar && (
          <Button variante="fantasma" tamano="pequeno" onClick={() => onEditar(mesa)}>
            Editar
          </Button>
        )}
        {onCambiarEstado && (
          <Button
            variante={mesa.estado === 'disponible' ? 'peligro' : 'exito'}
            tamano="pequeno"
            onClick={() => onCambiarEstado(mesa)}
          >
            {mesa.estado === 'disponible' ? 'Mantenimiento' : 'Reactivar'}
          </Button>
        )}
        {pie}
      </footer>
    </article>
  );
}
