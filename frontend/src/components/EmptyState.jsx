/**
 * Estado vacío: ninguna pantalla debe quedar en blanco cuando no hay datos.
 */

export default function EmptyState({ titulo, descripcion, icono = '🍽️', accion }) {
  return (
    <div className="vacio">
      <span className="vacio__icono" aria-hidden="true">
        {icono}
      </span>
      <p className="vacio__titulo">{titulo}</p>
      {descripcion && <p className="vacio__descripcion">{descripcion}</p>}
      {accion}
    </div>
  );
}
