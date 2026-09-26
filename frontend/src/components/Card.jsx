/**
 * Tarjeta genérica de contenido.
 * Unifica encabezado, cuerpo y pie para todo el sistema de diseño.
 */

export default function Card({
  titulo,
  subtitulo,
  acciones,
  children,
  pie,
  variante = 'default',
  className = '',
  sinPadding = false,
}) {
  const clases = [
    'card',
    variante !== 'default' ? `card--${variante}` : '',
    sinPadding ? 'card--sin-padding' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={clases}>
      {(titulo || acciones) && (
        <header className="card__header">
          <div className="card__titulos">
            {titulo && <h3 className="card__titulo">{titulo}</h3>}
            {subtitulo && <p className="card__subtitulo">{subtitulo}</p>}
          </div>
          {acciones && <div className="card__acciones">{acciones}</div>}
        </header>
      )}

      <div className="card__body">{children}</div>

      {pie && <footer className="card__pie">{pie}</footer>}
    </section>
  );
}
