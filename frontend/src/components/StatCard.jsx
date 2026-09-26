/**
 * Tarjeta de métrica del dashboard.
 * El valor SIEMPRE llega calculado desde el backend (funciones SQL).
 */

export default function StatCard({ etiqueta, valor, detalle, icono, tono = 'neutro', cargando = false }) {
  if (cargando) {
    return (
      <div className="stat stat--cargando" aria-hidden="true">
        <span className="stat__esqueleto" />
        <span className="stat__esqueleto stat__esqueleto--corto" />
      </div>
    );
  }

  return (
    <div className={`stat stat--${tono}`}>
      {icono && (
        <span className="stat__icono" aria-hidden="true">
          {icono}
        </span>
      )}
      <div className="stat__contenido">
        <p className="stat__etiqueta">{etiqueta}</p>
        <p className="stat__valor">{valor}</p>
        {detalle && <p className="stat__detalle">{detalle}</p>}
      </div>
    </div>
  );
}
