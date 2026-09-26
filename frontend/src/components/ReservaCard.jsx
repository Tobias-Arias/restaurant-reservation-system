/**
 * Tarjeta de reserva.
 *
 * Muestra número de reserva, fecha, hora, mesa, personas, estado y
 * observaciones, y expone las acciones disponibles según el estado y el rol.
 */

import { fechaLarga, hora, rangoHora, numero } from '../utils/format';
import Button from './Button';
import StatusBadge from './StatusBadge';

/** Acciones permitidas por estado (el backend vuelve a validarlas). */
const ACCIONES_POR_ESTADO = {
  pendiente: ['ver', 'editar', 'confirmar', 'cancelar'],
  confirmada: ['ver', 'editar', 'completar', 'cancelar'],
  completada: ['ver'],
  cancelada: ['ver'],
};

export default function ReservaCard({
  reserva,
  duracionMinutos = 90,
  onVer,
  onEditar,
  onConfirmar,
  onCancelar,
  onCompletar,
  compacta = false,
}) {
  const permitidas = ACCIONES_POR_ESTADO[reserva.estado] ?? ['ver'];
  const esAdmin = Boolean(onConfirmar || onCompletar);

  return (
    <article className={`reserva-card ${compacta ? 'reserva-card--compacta' : ''}`}>
      <header className="reserva-card__header">
        <div>
          <p className="reserva-card__codigo" title="Número de reserva">
            {reserva.codigo}
          </p>
          <p className="reserva-card__fecha">{fechaLarga(reserva.fecha)}</p>
        </div>
        <StatusBadge estado={reserva.estado} />
      </header>

      <dl className="reserva-card__datos">
        <div>
          <dt>Hora</dt>
          <dd>
            {hora(reserva.hora)}
            {!compacta && <span className="reserva-card__rango"> ({rangoHora(reserva.hora, duracionMinutos)})</span>}
          </dd>
        </div>
        <div>
          <dt>Mesa</dt>
          <dd>N.º {reserva.mesa?.numero}</dd>
        </div>
        <div>
          <dt>Personas</dt>
          <dd>{numero(reserva.personas)}</dd>
        </div>
        {esAdmin && (
          <div>
            <dt>Cliente</dt>
            <dd>
              {reserva.cliente?.nombre} {reserva.cliente?.apellido}
            </dd>
          </div>
        )}
      </dl>

      {!compacta && reserva.observaciones && (
        <p className="reserva-card__observaciones">
          <span>Observaciones:</span> {reserva.observaciones}
        </p>
      )}

      {(permitidas.length > 1 || (esAdmin && permitidas.includes('ver'))) && (
        <footer className="reserva-card__acciones">
          {permitidas.includes('ver') && onVer && (
            <Button variante="fantasma" tamano="pequeno" onClick={() => onVer(reserva)}>
              Ver detalle
            </Button>
          )}
          {permitidas.includes('editar') && onEditar && (
            <Button variante="fantasma" tamano="pequeno" onClick={() => onEditar(reserva)}>
              Editar
            </Button>
          )}
          {permitidas.includes('confirmar') && onConfirmar && (
            <Button variante="exito" tamano="pequeno" onClick={() => onConfirmar(reserva)}>
              Confirmar
            </Button>
          )}
          {permitidas.includes('completar') && onCompletar && (
            <Button variante="secundario" tamano="pequeno" onClick={() => onCompletar(reserva)}>
              Completar
            </Button>
          )}
          {permitidas.includes('cancelar') && onCancelar && (
            <Button variante="peligro" tamano="pequeno" onClick={() => onCancelar(reserva)}>
              Cancelar
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}

export { ACCIONES_POR_ESTADO };
