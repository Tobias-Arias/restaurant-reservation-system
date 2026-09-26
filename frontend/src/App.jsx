/**
 * Enrutador de la aplicación.
 *
 * Estructura de rutas:
 *   Público .............. Home, Menu, Reservar, Login, Registro, 404
 *   Requiere sesión ...... Mis reservas
 *   Sólo admin ........... /admin y sus subsecciones
 *
 * La protección real está en el backend (authMiddleware / adminMiddleware).
 * Estas rutas sólo evitan que el usuario vea pantallas a las que no puede
 * llegar: aunque se falseara la comprobación, la API respondería 401 o 403.
 */

import { useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { estadisticaApi } from './services/api';
import { cargarHorarios } from './utils/horarios';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Reservar from './pages/Reservar';
import Login from './pages/Login';
import Register from './pages/Register';
import MisReservas from './pages/MisReservas';
import AdminDashboard from './pages/AdminDashboard';
import AdminReservas from './pages/AdminReservas';
import AdminMesas from './pages/AdminMesas';
import AdminClientes from './pages/AdminClientes';
import AdminMenu from './pages/AdminMenu';
import AdminEstadisticas from './pages/AdminEstadisticas';
import NotFound from './pages/NotFound';

/** Layout común a todas las páginas públicas. */
function LayoutPublico() {
  return (
    <div className="app">
      <Navbar />
      <main className="app__contenido">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  // Los horarios de atención se piden una sola vez al arrancar: el backend es
  // la única fuente de verdad y así Inicio, Footer y el flujo de reserva
  // muestran siempre la misma grilla.
  useEffect(() => {
    cargarHorarios(estadisticaApi);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ==================================== Panel administrativo */}
          <Route element={<ProtectedRoute soloAdmin />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/reservas" element={<AdminReservas />} />
              <Route path="/admin/mesas" element={<AdminMesas />} />
              <Route path="/admin/clientes" element={<AdminClientes />} />
              <Route path="/admin/menu" element={<AdminMenu />} />
              <Route path="/admin/estadisticas" element={<AdminEstadisticas />} />
              <Route path="/admin/*" element={<NotFound />} />
            </Route>
          </Route>

          {/* ========================================= Sitio público */}
          <Route element={<LayoutPublico />}>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/reservar" element={<Reservar />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/mis-reservas" element={<MisReservas />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
