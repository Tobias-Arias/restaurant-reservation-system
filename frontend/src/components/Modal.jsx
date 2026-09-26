/**
 * Modal accesible.
 *
 * Implementa lo mínimo indispensable para un diálogo usable:
 *  - bloqueo de scroll mientras está abierto,
 *  - cierre con Escape,
 *  - click en el fondo para cerrar,
 *  - foco inicial en el diálogo,
 *  - atributos ARIA correctos.
 *
 * El botón "Guardar" puede quedar en estado de carga mientras el padre
 * espera la respuesta de la API.
 */

import { useEffect, useRef } from 'react';
import Button from './Button';

const TAMANOS = {
  chico: 'modal--chico',
  mediano: 'modal--mediano',
  grande: 'modal--grande',
};

export default function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  pie,
  tamano = 'mediano',
  cerrable = true,
}) {
  const dialogoRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;

    const alTeclear = (evento) => {
      if (evento.key === 'Escape' && cerrable) onCerrar();
    };

    const scrollAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', alTeclear);
    dialogoRef.current?.focus();

    return () => {
      document.body.style.overflow = scrollAnterior;
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto, cerrable, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="modal__overlay"
      onMouseDown={(evento) => {
        if (cerrable && evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        className={`modal ${TAMANOS[tamano] ?? TAMANOS.mediano}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={dialogoRef}
      >
        <header className="modal__header">
          <div>
            <h2 className="modal__titulo">{titulo}</h2>
            {descripcion && <p className="modal__descripcion">{descripcion}</p>}
          </div>
          {cerrable && (
            <button type="button" className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
              ×
            </button>
          )}
        </header>

        <div className="modal__body">{children}</div>

        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

/** Fila de acciones estándar para el pie de un modal. */
export function ModalAcciones({ onCancelar, onConfirmar, textoConfirmar = 'Guardar', cargando, disabled }) {
  return (
    <>
      <Button variante="fantasma" onClick={onCancelar} disabled={cargando}>
        Cancelar
      </Button>
      <Button onClick={onConfirmar} cargando={cargando} disabled={disabled}>
        {textoConfirmar}
      </Button>
    </>
  );
}
