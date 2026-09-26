/**
 * Barra de navegación principal (público).
 * Muestra el menú público y el acceso al panel según el estado de sesión.
 */

import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { iniciales } from '../utils/format';
import Button from './Button';

const ENLACES = [
  { to: '/', etiqueta: 'Inicio', exacto: true },
  { to: '/menu', etiqueta: 'Menú' },
  { to: '/reservar', etiqueta: 'Reservar' },
  { to: '/mis-reservas', etiqueta: 'Mis reservas', requiereSesion: true },
];

export default function Navbar() {
  const { usuario, autenticado, esAdmin, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const location = useLocation();

  const cerrarMenu = () => setAbierto(false);

  return (
    <header className="navbar">
      <div className="navbar__contenedor">
        <Link to="/" className="navbar__marca" onClick={cerrarMenu}>
          <span className="navbar__logo" aria-hidden="true">
            La Reserva
          </span>
          <span className="navbar__tagline">Restaurante &amp; Cocina de autor</span>
        </Link>

        <button
          type="button"
          className="navbar__hamburguesa"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-label="Abrir menú de navegación"
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`navbar__enlaces ${abierto ? 'is-abierto' : ''}`} aria-label="Navegación principal">
          {ENLACES.filter((enlace) => !enlace.requiereSesion || autenticado).map((enlace) => (
            <NavLink
              key={enlace.to}
              to={enlace.to}
              end={enlace.exacto}
              onClick={cerrarMenu}
              className={({ isActive }) => `navbar__enlace ${isActive ? 'is-activo' : ''}`}
            >
              {enlace.etiqueta}
            </NavLink>
          ))}

          <div className="navbar__separador" aria-hidden="true" />

          {esAdmin && (
            <NavLink to="/admin" onClick={cerrarMenu} className="navbar__enlace navbar__enlace--admin">
              Panel admin
            </NavLink>
          )}

          {autenticado ? (
            <div className="navbar__sesion">
              <span className="navbar__avatar" aria-hidden="true">
                {iniciales(usuario.nombre)}
              </span>
              <div className="navbar__usuario">
                <span className="navbar__usuario-nombre">{usuario.nombre}</span>
                <span className="navbar__usuario-rol">
                  {esAdmin ? 'Administrador' : 'Cliente'}
                </span>
              </div>
              <Button variante="fantasma" tamano="pequeno" onClick={cerrarSesion}>
                Salir
              </Button>
            </div>
          ) : (
            <div className="navbar__sesion">
              <Button
                variante="fantasma"
                tamano="pequeno"
                a="/login"
                onClick={cerrarMenu}
                state={{ from: location.pathname }}
              >
                Iniciar sesión
              </Button>
              <Button tamano="pequeno" a="/registro" onClick={cerrarMenu}>
                Crear cuenta
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
