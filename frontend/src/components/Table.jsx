/**
 * Tabla reutilizable para el panel administrativo.
 *
 * Acepta columnas declarativas y resuelve automáticamente el caso "sin datos"
 * y el estado de carga, de modo que ninguna pantalla tenga que repetirlos.
 */

import Loading from './Loading';
import EmptyState from './EmptyState';

export default function Table({
  columnas,
  filas = [],
  claveFila = (fila) => fila.id,
  cargando = false,
  mensajeVacio = 'No hay registros para mostrar.',
  onFilaClick,
}) {
  if (cargando) {
    return (
      <div className="tabla__contenedor">
        <Loading texto="Cargando datos..." />
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="tabla__contenedor">
        <EmptyState titulo={mensajeVacio} descripcion="Probá ajustando los filtros de la búsqueda." />
      </div>
    );
  }

  return (
    <div className="tabla__contenedor">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave} scope="col" style={{ width: columna.ancho, textAlign: columna.alinear }}>
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr
              key={claveFila(fila)}
              onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
              className={onFilaClick ? 'es-clicable' : ''}
            >
              {columnas.map((columna) => (
                <td key={columna.clave} style={{ textAlign: columna.alinear }} data-label={columna.titulo}>
                  {columna.render(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
