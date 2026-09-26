/**
 * Pie de página público.
 */

import { Link } from 'react-router-dom';
import { obtenerTurnos } from '../utils/horarios';

const ENLACES = [
  { to: '/', etiqueta: 'Inicio' },
  { to: '/menu', etiqueta: 'Menú' },
  { to: '/reservar', etiqueta: 'Reservar mesa' },
  { to: '/mis-reservas', etiqueta: 'Mis reservas' },
  { to: '/login', etiqueta: 'Iniciar sesión' },
];

export default function Footer() {
  const anio = new Date().getFullYear();
  const turnos = obtenerTurnos();

  return (
    <footer className="footer">
      <div className="footer__contenedor">
        <div className="footer__bloque">
          <p className="footer__marca">La Reserva</p>
          <p className="footer__texto">
            Cocina de autor con producto de temporada. Reservas todos los días de la semana.
          </p>
        </div>

        <div className="footer__bloque">
          <p className="footer__titulo">Navegación</p>
          <ul className="footer__lista">
            {ENLACES.map((enlace) => (
              <li key={enlace.to}>
                <Link to={enlace.to}>{enlace.etiqueta}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__bloque">
          <p className="footer__titulo">Horarios</p>
          <ul className="footer__lista">
            {turnos.map((turno) => (
              <li key={turno.turno}>
                {turno.turno}: {turno.inicio} - {turno.fin} hs
              </li>
            ))}
            <li>Lun a Dom · {turnos.flatMap((t) => t.slots).length} horarios por día</li>
          </ul>
        </div>

        <div className="footer__bloque">
          <p className="footer__titulo">Contacto</p>
          <ul className="footer__lista">
            <li>Av. Corrientes 1234, Buenos Aires</li>
            <li>
              Tel: <a href="tel:+541155550000">+54 11 5555 0000</a>
            </li>
            <li>
              <a href="mailto:reservas@larestaurante.com">reservas@larestaurante.com</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer__legal">
        <p>
          © {anio} Restaurante La Reserva · Proyecto educativo de React + Node.js/Express + Supabase
        </p>
      </div>
    </footer>
  );
}
