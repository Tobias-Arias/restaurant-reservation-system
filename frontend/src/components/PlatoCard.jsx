/**
 * Tarjeta de plato del menú público.
 * Los datos provienen SIEMPRE de GET /api/platos; nunca están hardcodeados.
 */

import { precio as formatoPrecio } from '../utils/format';

export default function PlatoCard({ plato }) {
  return (
    <article className={`plato-card ${plato.disponible ? '' : 'is-agotado'}`}>
      <div className="plato-card__imagen">
        {plato.imagenUrl ? (
          <img src={plato.imagenUrl} alt={plato.nombre} loading="lazy" onError={(e) => e.currentTarget.classList.add('is-oculta')} />
        ) : (
          <span className="plato-card__inicial" aria-hidden="true">
            {plato.nombre.charAt(0).toUpperCase()}
          </span>
        )}
        {!plato.disponible && <span className="plato-card__agotado">Agotado</span>}
      </div>

      <div className="plato-card__contenido">
        <div className="plato-card__titulos">
          <h3 className="plato-card__nombre">{plato.nombre}</h3>
          <span className="plato-card__precio">{formatoPrecio(plato.precio)}</span>
        </div>
        {plato.descripcion && <p className="plato-card__descripcion">{plato.descripcion}</p>}
        <span className="plato-card__categoria">{plato.categoria}</span>
      </div>
    </article>
  );
}
