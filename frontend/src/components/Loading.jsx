/**
 * Indicador de carga. Bloques para tablas y tarjetas, línea para botones.
 */

export default function Loading({ texto = 'Cargando...', variante = 'bloque', filas = 3 }) {
  if (variante === 'linea') {
    return (
      <span className="loading-linea" role="status" aria-live="polite">
        <span className="loading-linea__barra" />
        <span className="visually-hidden">{texto}</span>
      </span>
    );
  }

  return (
    <div className={`loading loading--${variante}`} role="status" aria-live="polite">
      <span className="loading__spinner" aria-hidden="true" />
      <p className="loading__texto">{texto}</p>
      {variante === 'esqueleto' &&
        Array.from({ length: filas }, (_, indice) => (
          <span key={indice} className="loading__linea" aria-hidden="true" />
        ))}
    </div>
  );
}
