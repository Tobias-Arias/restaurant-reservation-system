/**
 * Cliente HTTP de la API REST.
 *
 * REGLA DE ARQUITECTURA
 * El frontend NO se conecta nunca a Supabase. Sólo habla con el backend
 * Express a través de estas funciones. La URL base se toma de
 * VITE_API_URL y NUNCA contiene credenciales.
 *
 * RESPONSABILIDADES
 *  - inyectar el token de sesión en cada petición,
 *  - normalizar la envoltura { success, data, meta },
 *  - convertir cualquier fallo en un `ApiError` con mensaje en español,
 *  - reintentar un único refresh de token si la sesión expiró.
 */

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const RUTAS = {
  auth: '/api/auth',
  clientes: '/api/clientes',
  mesas: '/api/mesas',
  reservas: '/api/reservas',
  platos: '/api/platos',
  categorias: '/api/categorias',
  estadisticas: '/api/estadisticas',
};
const CLAVE_TOKEN = 'rrs.token';
const CLAVE_REFRESH = 'rrs.refreshToken';

/** Error de la API con el código HTTP y el mensaje ya listo para mostrar. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = null, detalles = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detalles = detalles;
  }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export const guardarToken = (token) => {
  if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
};

export const guardarRefreshToken = (token) => {
  if (token) sessionStorage.setItem(CLAVE_REFRESH, token);
};

export const leerToken = () => sessionStorage.getItem(CLAVE_TOKEN);

export const limpiarToken = () => {
  sessionStorage.removeItem(CLAVE_TOKEN);
  sessionStorage.removeItem(CLAVE_REFRESH);
};

/**
 * Callback que el AuthContext registra para que la capa HTTP pueda
 * reautenticarse sola cuando Supabase renueva el token.
 * @type {null | (() => Promise<string|null>)}
 */
let renovadorDeSesion = null;
export const definirRenovadorDeSesion = (fn) => {
  renovadorDeSesion = fn;
};

// ---------------------------------------------------------------------------
// Petición base
// ---------------------------------------------------------------------------

const construirUrl = (ruta, params) => {
  const url = new URL(`${BASE_URL}${ruta}`);
  if (params) {
    Object.entries(params).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        url.searchParams.append(clave, valor);
      }
    });
  }
  return url.toString();
};

/**
 * @param {string} ruta      Ej: '/api/mesas/disponibles'
 * @param {object} opciones
 * @param {string} [opciones.metodo='GET']
 * @param {object} [opciones.cuerpo]
 * @param {object} [opciones.params]
 * @param {boolean} [opciones.silencioso] No notifica errores 401 al contexto.
 * @returns {Promise<{data: any, meta: object}>}
 */
async function peticion(ruta, { metodo = 'GET', cuerpo, params, silencioso = false } = {}) {
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  const token = leerToken();
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(construirUrl(ruta, params), {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verificá que el backend esté ejecutándose.', {
      status: 0,
      code: 'SIN_CONEXION',
    });
  }

  // 401 con refresh token disponible: se intenta renovar una sola vez.
  if (respuesta.status === 401 && !silencioso && renovadorDeSesion) {
    const nuevoToken = await renovadorDeSesion();
    if (nuevoToken) {
      cabeceras.Authorization = `Bearer ${nuevoToken}`;
      respuesta = await fetch(construirUrl(ruta, params), {
        method: metodo,
        headers: cabeceras,
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });
    }
  }

  const texto = await respuesta.text();
  let payload = null;
  if (texto) {
    try {
      payload = JSON.parse(texto);
    } catch {
      throw new ApiError('El servidor devolvió una respuesta inesperada.', {
        status: respuesta.status,
        code: 'RESPUESTA_INVALIDA',
      });
    }
  }

  if (!respuesta.ok || payload?.success === false) {
    throw new ApiError(payload?.message || 'Ha ocurrido un error inesperado.', {
      status: respuesta.status,
      code: payload?.detalles?.code ?? null,
      detalles: payload?.detalles ?? null,
    });
  }

  return { data: payload?.data ?? null, meta: payload?.meta ?? {} };
}

const get = (ruta, params) => peticion(ruta, { params });
const post = (ruta, cuerpo) => peticion(ruta, { metodo: 'POST', cuerpo });
const put = (ruta, cuerpo) => peticion(ruta, { metodo: 'PUT', cuerpo });
const del = (ruta) => peticion(ruta, { metodo: 'DELETE' });

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------
export const authApi = {
  registrar: (datos) => post(`${RUTAS.auth}/register`, datos),
  iniciarSesion: (email, password) => post(`${RUTAS.auth}/login`, { email, password }),
  perfil: () => get(`${RUTAS.auth}/me`),
  actualizarPerfil: (datos) => put(`${RUTAS.auth}/me`, datos),
  cerrarSesion: () => post(`${RUTAS.auth}/logout`),
};

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
export const clienteApi = {
  listar: (params) => get(RUTAS.clientes, params),
  obtener: (id) => get(`${RUTAS.clientes}/${id}`),
  crear: (datos) => post(RUTAS.clientes, datos),
  actualizar: (id, datos) => put(`${RUTAS.clientes}/${id}`, datos),
  eliminar: (id) => del(`${RUTAS.clientes}/${id}`),
  reservas: (id) => get(`${RUTAS.clientes}/${id}/reservas`),
};

// ---------------------------------------------------------------------------
// Mesas
// ---------------------------------------------------------------------------
export const mesaApi = {
  listar: (params) => get(RUTAS.mesas, params),
  obtener: (id) => get(`${RUTAS.mesas}/${id}`),
  disponibles: (params) => get(`${RUTAS.mesas}/disponibles`, params),
  estadoSalon: (params) => get(`${RUTAS.mesas}/estado-salon`, params),
  crear: (datos) => post(RUTAS.mesas, datos),
  actualizar: (id, datos) => put(`${RUTAS.mesas}/${id}`, datos),
  eliminar: (id) => del(`${RUTAS.mesas}/${id}`),
};

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------
export const reservaApi = {
  listar: (params) => get(RUTAS.reservas, params),
  obtener: (id) => get(`${RUTAS.reservas}/${id}`),
  porCodigo: (codigo) => get(`${RUTAS.reservas}/codigo/${codigo}`),
  hoy: (params) => get(`${RUTAS.reservas}/hoy`, params),
  mias: () => get(`${RUTAS.reservas}/mias`),
  crear: (datos) => post(RUTAS.reservas, datos),
  actualizar: (id, datos) => put(`${RUTAS.reservas}/${id}`, datos),
  eliminar: (id) => del(`${RUTAS.reservas}/${id}`),
  confirmar: (id) => put(`${RUTAS.reservas}/${id}/confirmar`),
  cancelar: (id) => put(`${RUTAS.reservas}/${id}/cancelar`),
  completar: (id) => put(`${RUTAS.reservas}/${id}/completar`),
};

// ---------------------------------------------------------------------------
// Menú
// ---------------------------------------------------------------------------
export const platoApi = {
  listar: (params) => get(RUTAS.platos, params),
  obtener: (id) => get(`${RUTAS.platos}/${id}`),
  crear: (datos) => post(RUTAS.platos, datos),
  actualizar: (id, datos) => put(`${RUTAS.platos}/${id}`, datos),
  eliminar: (id) => del(`${RUTAS.platos}/${id}`),
};

export const categoriaApi = {
  listar: () => get(RUTAS.categorias),
  obtener: (id) => get(`${RUTAS.categorias}/${id}`),
  crear: (datos) => post(RUTAS.categorias, datos),
  actualizar: (id, datos) => put(`${RUTAS.categorias}/${id}`, datos),
  eliminar: (id) => del(`${RUTAS.categorias}/${id}`),
};

// ---------------------------------------------------------------------------
// Estadísticas y datos de apoyo
// ---------------------------------------------------------------------------
export const estadisticaApi = {
  dashboard: (params) => get(`${RUTAS.estadisticas}/dashboard`, params),
  reservas: (params) => get(`${RUTAS.estadisticas}/reservas`, params),
  mesas: (params) => get(`${RUTAS.estadisticas}/mesas`, params),
  clientes: (params) => get(`${RUTAS.estadisticas}/clientes`, params),
  ventas: (params) => get(`${RUTAS.estadisticas}/ventas`, params),
  salon: (params) => get(`${RUTAS.estadisticas}/salon`, params),
  horarios: () => get(`${RUTAS.estadisticas}/horarios`),
};

export const sistemaApi = {
  health: () => get('/api/health'),
  raiz: () => get('/'),
};

export { BASE_URL };
