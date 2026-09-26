/**
 * Mensaje de éxito. Se autocierra si se le pasa `autoCerrar` en milisegundos.
 */

import { useEffect } from 'react';

export default function SuccessMessage({
  mensaje,
  titulo = '¡Listo!',
  onCerrar,
  autoCerrar = 0,
  children,
}) {
  useEffect(() => {
    if (!autoCerrar || !mensaje) return undefined;
    const temporizador = setTimeout(onCerrar, autoCerrar);
    return () => clearTimeout(temporizador);
  }, [autoCerrar, mensaje, onCerrar]);

  if (!mensaje && !children) return null;

  return (
    <div className="alerta alerta--exito" role="status" aria-live="polite">
      <span className="alerta__icono" aria-hidden="true">
        ✓
      </span>

      <div className="alerta__contenido">
        {mensaje && <p className="alerta__titulo">{titulo}</p>}
        {mensaje && <p className="alerta__mensaje">{mensaje}</p>}
        {children}
      </div>

      {onCerrar && (
        <div className="alerta__acciones">
          <button type="button" className="alerta__boton alerta__boton--fantasma" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
