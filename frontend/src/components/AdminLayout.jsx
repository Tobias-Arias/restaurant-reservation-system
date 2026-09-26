/**
 * Layout del panel administrativo.
 * Aporta la navegación lateral y la barra superior con la sesión del admin.
 */

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { iniciales } from '../utils/format';
import Button from './Button';

const SECCIONES = [
  { to: '/admin', etiqueta: 'Dashboard', icono: '📊', exacto: true },
  { to: '/admin/reservas', etiqueta: 'Reservas', icono: '🗓️' },
  { to: '/admin/mesas', etiqueta: 'Mesas', icono: '🪑' },
  { to: '/admin/clientes', etiqueta: 'Clientes', icono: '👥' },
  { to: '/admin/menu', etiqueta: 'Menú', icono: '🍽️' },
  { to: '/admin/estadisticas', etiqueta: 'Estadísticas', icono: '📈' },
];

export default function AdminLayout() {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);

  const salir = async () => {
    await cerrarSesion();
    navegar('/login', { replace: true });
  };

  return (
    <div className="admin">
      <aside className={`admin__lateral ${abierto ? 'is-abierto' : ''}`}>
        <div className="admin__marca">
          <span className="admin__logo">La Reserva</span>
          <span className="admin__logo-sub">Panel administrativo</span>
        </div>

        <nav className="admin__nav" aria-label="Navegación administrativa">
          {SECCIONES.map((seccion) => (
            <NavLink
              key={seccion.to}
              to={seccion.to}
              end={seccion.exacto}
              onClick={() => setAbierto(false)}
              className={({ isActive }) => `admin__enlace ${isActive ? 'is-activo' : ''}`}
            >
              <span className="admin__enlace-icono" aria-hidden="true">
                {seccion.icono}
              </span>
              {seccion.etiqueta}
            </NavLink>
          ))}
        </nav>

        <div className="admin__lateral-pie">
          <NavLink to="/" className="admin__enlace">
            <span className="admin__enlace-icono" aria-hidden="true">
              🏠
            </span>
            Ver sitio público
          </NavLink>
          <button type="button" className="admin__enlace admin__salir" onClick={salir}>
            <span className="admin__enlace-icono" aria-hidden="true">
              ←
            </span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="admin__principal">
        <header className="admin__barra">
          <button
            type="button"
            className="admin__hamburguesa"
            onClick={() => setAbierto((v) => !v)}
            aria-label="Abrir menú administrativo"
            aria-expanded={abierto}
          >
            ☰
          </button>

          <div className="admin__barra-info">
            <strong>Panel administrativo</strong>
            <span>Gestión de reservas, mesas, clientes y menú</span>
          </div>

          <div className="admin__sesion">
            <span className="admin__avatar" aria-hidden="true">
              {iniciales(usuario.nombre)}
            </span>
            <div className="admin__usuario">
              <span className="admin__usuario-nombre">{usuario.nombre}</span>
              <span className="admin__usuario-email">{usuario.email}</span>
            </div>
            <Button variante="fantasma" tamano="pequeno" onClick={salir}>
              Salir
            </Button>
          </div>
        </header>

        <main className="admin__contenido">
          <Outlet />
        </main>
      </div>

      {abierto && <div className="admin__velo" onClick={() => setAbierto(false)} aria-hidden="true" />}
    </div>
  );
}
