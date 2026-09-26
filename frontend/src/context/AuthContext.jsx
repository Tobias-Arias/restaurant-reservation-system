/**
 * Contexto de autenticación.
 *
 * Concentra todo lo que la aplicación necesita saber sobre la sesión:
 * usuario, rol, estado de carga y acciones de login/logout.
 *
 * El token se guarda en sessionStorage (no en localStorage) para que cerrar
 * la pestaña cierre la sesión en ese equipo, y se renueva mediante el refresh
 * token de Supabase Auth exposed en /api/auth/register y /api/auth/login.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  authApi,
  definirRenovadorDeSesion,
  guardarRefreshToken,
  guardarToken,
  leerToken,
  limpiarToken,
} from '../services/api';

const AuthContext = createContext(null);

const ROL_ADMIN = 'admin';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [renovando, setRenovando] = useState(false);

  /** Restaura la sesión al cargar la aplicación. */
  useEffect(() => {
    let vigente = true;

    async function restaurar() {
      if (!leerToken()) {
        if (vigente) setCargando(false);
        return;
      }
      try {
        const { data } = await authApi.perfil();
        if (vigente) setUsuario(data);
      } catch {
        limpiarToken();
        if (vigente) setUsuario(null);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    restaurar();
    return () => {
      vigente = false;
    };
  }, []);

  /**
   * El backend expone el refresh token. Se usa aquí para renovar la sesión
   * con Supabase Auth (endpoint /token de GoTrue) sin pedir credenciales.
   */
  const renovarToken = useCallback(async () => {
    if (renovando) return null;
    const refreshToken = sessionStorage.getItem('rrs.refreshToken');
    if (!refreshToken) return null;

    setRenovando(true);
    try {
      const respuesta = await fetch(
        `${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/auth/renovar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }
      );
      const payload = await respuesta.json();
      if (!respuesta.ok || !payload?.success) throw new Error('No se pudo renovar la sesión.');

      guardarToken(payload.data.token);
      guardarRefreshToken(payload.data.refreshToken);
      return payload.data.token;
    } catch {
      limpiarToken();
      setUsuario(null);
      return null;
    } finally {
      setRenovando(false);
    }
  }, [renovando]);

  // La capa HTTP consulta este callback cuando recibe un 401.
  useEffect(() => {
    definirRenovadorDeSesion(renovarToken);
    return () => definirRenovadorDeSesion(null);
  }, [renovarToken]);

  const iniciarSesion = useCallback(async (email, password) => {
    const { data } = await authApi.iniciarSesion(email, password);
    guardarToken(data.token);
    guardarRefreshToken(data.refreshToken);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const registrar = useCallback(async (datos) => {
    const { data } = await authApi.registrar(datos);
    guardarToken(data.token);
    guardarRefreshToken(data.refreshToken);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await authApi.cerrarSesion();
    } catch {
      // Si el backend ya no reconoce el token, la sesión local se cierra igual.
    }
    limpiarToken();
    setUsuario(null);
  }, []);

  const actualizarPerfil = useCallback(async (datos) => {
    const { data } = await authApi.actualizarPerfil(datos);
    setUsuario((anterior) => ({ ...anterior, ...data }));
    return data;
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      autenticado: Boolean(usuario),
      esAdmin: usuario?.rol === ROL_ADMIN,
      iniciarSesion,
      registrar,
      cerrarSesion,
      actualizarPerfil,
      renovarToken,
    }),
    [usuario, cargando, iniciarSesion, registrar, cerrarSesion, actualizarPerfil, renovarToken]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/** Hook de acceso al contexto. Lanza error si se usa fuera del provider. */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return contexto;
}
