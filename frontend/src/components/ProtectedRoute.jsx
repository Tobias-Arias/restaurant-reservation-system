/**
 * Rutas protegidas.
 *
 * El frontend oculta los enlaces y redirige, pero eso NO es seguridad: la
 * protección real está en el backend (authMiddleware / adminMiddleware), que
 * rechaza cualquier petición sin token válido o con rol incorrecto.
 * Esta capa es sólo experiencia de usuario.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ soloAdmin = false }) {
  const { autenticado, esAdmin, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="pantalla-carga">
        <Loading texto="Verificando tu sesión..." />
      </div>
    );
  }

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (soloAdmin && !esAdmin) {
    return <Navigate to="/mis-reservas" replace />;
  }

  return <Outlet />;
}
