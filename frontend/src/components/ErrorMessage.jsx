/**
 * Mensaje de error.
 *
 * IMPORTANTE: el backend nunca envía stack traces ni mensajes internos de
 * PostgreSQL (ver middleware/errorMiddleware.js), por lo que lo que se muestra
 * aquí es siempre un texto de negocio en español.
 */

export default function ErrorMessage({
  mensaje,
  titulo = 'No pudimos completar la operación',
  onReintentar,
  onCerrar,
  detalles,
}) {
  if (!mensaje) return null;

  return (
    <div className="alerta alerta--error" role="alert" aria-live="assertive">
      <span className="alerta__icono" aria-hidden="true">
        ⚠
      </span>

      <div className="alerta__contenido">
        <p className="alerta__titulo">{titulo}</p>
        <p className="alerta__mensaje">{mensaje}</p>

        {detalles?.campo && <p className="alerta__campo">Campo: {detalles.campo}</p>}
        {detalles?.disponibles && (
          <p className="alerta__campo">Horarios permitidos: {detalles.disponibles.join(', ')}</p>
        )}
      </div>

      {(onReintentar || onCerrar) && (
        <div className="alerta__acciones">
          {onReintentar && (
            <button type="button" className="alerta__boton" onClick={onReintentar}>
              Reintentar
            </button>
          )}
          {onCerrar && (
            <button type="button" className="alerta__boton alerta__boton--fantasma" onClick={onCerrar}>
              Cerrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
