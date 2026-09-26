/**
 * Botón reutilizable.
 * Centraliza variantes visuales para que la interfaz sea consistente.
 */

import { Link } from 'react-router-dom';

const VARIANTES = {
  primario: 'btn--primario',
  secundario: 'btn--secundario',
  fantasma: 'btn--fantasma',
  peligro: 'btn--peligro',
  exito: 'btn--exito',
};

const TAMANOS = {
  pequeno: 'btn--pequeno',
  mediano: 'btn--mediano',
  grande: 'btn--grande',
  completo: 'btn--completo',
};

export default function Button({
  children,
  variante = 'primario',
  tamano = 'mediano',
  tipo = 'button',
  onClick,
  disabled = false,
  cargando = false,
  a,
  className = '',
  ...resto
}) {
  const clases = [
    'btn',
    VARIANTES[variante] ?? VARIANTES.primario,
    TAMANOS[tamano] ?? TAMANOS.mediano,
    disabled || cargando ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const contenido = (
    <>
      {cargando && <span className="btn__spinner" aria-hidden="true" />}
      <span>{children}</span>
    </>
  );

  if (a) {
    return (
      <Link to={a} className={clases} aria-disabled={disabled || cargando} {...resto}>
        {contenido}
      </Link>
    );
  }

  return (
    <button
      type={tipo}
      className={clases}
      onClick={onClick}
      disabled={disabled || cargando}
      aria-busy={cargando}
      {...resto}
    >
      {contenido}
    </button>
  );
}
