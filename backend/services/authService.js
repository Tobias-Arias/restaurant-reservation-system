/**
 * Servicio de autenticación.
 *
 * Decisión de diseño: las contraseñas NUNCA se tocan en este servidor.
 *  - El registro y el login se delegan en Supabase Auth.
 *  - El backend sólo valida los datos de entrada, crea el perfil en
 *    `public.usuarios` y devuelve el access_token de Supabase.
 *  - La tabla `usuarios.password_hash` permanece siempre en NULL.
 *
 * Flujo de registro:
 *   1. signUp en Supabase Auth
 *   2. se confirma el email si el proyecto lo requiere (evita fricción en
 *      el entorno de pruebas) y se inicia sesión
 *   3. se inserta el perfil en public.usuarios con rol 'cliente'
 *   4. se crea o vincula el registro en public.clientes por email
 */

const db = require('../database/supabase');
const HttpError = require('../utils/HttpError');
const {
  validarEmail,
  validarContrasena,
  validarTexto,
  normalizar,
} = require('../utils/validators');
const { ROL_CLIENTE } = require('../middleware/authMiddleware');

const PERFIL_SELECT = 'id, nombre, email, rol, created_at';

/**
 * Registra un nuevo usuario. Siempre con rol 'cliente': nadie puede auto-asignarse
 * el rol de administrador.
 */
async function registrar({ nombre, email, password, telefono }) {
  const nombreLimpio = validarTexto(nombre, 'nombre', { min: 2, max: 80 });
  const emailLimpio = validarEmail(email);
  const contrasena = validarContrasena(password);

  const { data: signup, error: errorSignup } = await db.publico.auth.signUp({
    email: emailLimpio,
    password: contrasena,
    options: { data: { nombre: nombreLimpio } },
  });

  if (errorSignup) throw traducirErrorAuth(errorSignup, 'registro');

  const authUser = signup?.user;
  if (!authUser) {
    throw HttpError.badRequest('No se pudo crear la cuenta. Intentá de nuevo.');
  }

  // Si el proyecto de Supabase tiene la confirmación de email activa, no se
  // devuelve sesión. En un entorno de desarrollo eso bloquea el primer acceso,
  // así que se confirma la cuenta y se inicia sesión automáticamente.
  let sesion = signup.session;
  if (!sesion) {
    const { error: errorConfirmar } = await db.admin.auth.admin.updateUserById(authUser.id, {
      email_confirm: true,
    });
    if (errorConfirmar) {
      throw HttpError.badRequest(
        'Cuenta creada. Revisá tu correo para confirmar el acceso antes de iniciar sesión.'
      );
    }
    sesion = await iniciarSesion(emailLimpio, contrasena);
  }

  const cliente = await crearOVincularCliente({ nombre: nombreLimpio, email: emailLimpio, telefono, usuarioId: authUser.id });

  const perfil = await db.ejecutar(() =>
    db.admin
      .from('usuarios')
      .insert({ id: authUser.id, nombre: nombreLimpio, email: emailLimpio, rol: ROL_CLIENTE })
      .select(PERFIL_SELECT)
      .single()
  );

  return construirSesion(perfil, sesion, cliente?.id ?? null);
}

/** Inicia sesión con email y contraseña. */
async function iniciarSesion(email, password) {
  const emailLimpio = validarEmail(email);
  const contrasena = validarContrasena(password);

  const { data, error } = await db.publico.auth.signInWithPassword({
    email: emailLimpio,
    password: contrasena,
  });

  if (error || !data?.session) {
    throw HttpError.noAutorizado('Email o contraseña incorrectos.');
  }

  const authUserId = data.user?.id;
  if (!authUserId) throw HttpError.noAutorizado('No se pudo validar la sesión. Intentá de nuevo.');

  const perfil = await db.ejecutar(() =>
    db.admin.from('usuarios').select(PERFIL_SELECT).eq('id', authUserId).maybeSingle()
  );

  if (!perfil) {
    throw HttpError.prohibido('Tu cuenta no está activa en la aplicación. Contactá al restaurante.');
  }

  const cliente = await db.ejecutar(() =>
    db.admin.from('clientes').select('id').eq('usuario_id', perfil.id).maybeSingle()
  );

  return construirSesion(perfil, data.session, cliente?.id ?? null);
}

/** Recupera el perfil del usuario a partir de un access_token válido. */
async function perfilDesdeToken(token) {
  const { data, error } = await db.admin.auth.getUser(token);
  if (error || !data?.user) {
    throw HttpError.noAutorizado('Tu sesión expiró. Volvé a iniciar sesión.');
  }

  const perfil = await db.ejecutar(() =>
    db.admin.from('usuarios').select(PERFIL_SELECT).eq('id', data.user.id).maybeSingle()
  );

  if (!perfil) {
    throw HttpError.prohibido('Tu cuenta no está activa en la aplicación.');
  }

  return {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: perfil.rol,
    clienteId: perfil.cliente_id ?? null,
    createdAt: perfil.created_at,
  };
}

/** Actualiza los datos de perfil del usuario autenticado. */
async function actualizarPerfil(usuarioId, { nombre }) {
  const nombreLimpio = validarTexto(nombre, 'nombre', { min: 2, max: 80 });

  const { data, error } = await db.admin
    .from('usuarios')
    .update({ nombre: nombreLimpio })
    .eq('id', usuarioId)
    .select(PERFIL_SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw HttpError.noEncontrado('No se encontró el perfil del usuario.');

  await db.ejecutar(() =>
    db.admin.from('clientes').update({ nombre: nombreLimpio }).eq('usuario_id', usuarioId)
  );

  return data;
}

/**
 * Renueva una sesión a partir de su refresh token.
 * Permite que el frontend mantenga la sesión abierta sin volver a pedir
 * credenciales. El refresh token viaja cifrado por HTTPS y se valida en
 * Supabase Auth, no en este servidor.
 */
async function renovarSesion(refreshToken) {
  const token = String(refreshToken ?? '').trim();
  if (!token) {
    throw HttpError.badRequest('Falta el refresh token para renovar la sesión.', { campo: 'refreshToken' });
  }

  const { data, error } = await db.publico.auth.refreshSession({ refresh_token: token });
  if (error || !data?.session) {
    throw HttpError.noAutorizado('Tu sesión expiró. Volvé a iniciar sesión.');
  }

  const perfil = await db.ejecutar(() =>
    db.admin.from('usuarios').select(PERFIL_SELECT).eq('id', data.user.id).maybeSingle()
  );
  if (!perfil) {
    throw HttpError.prohibido('Tu cuenta no está activa en la aplicación.');
  }

  const cliente = await db.ejecutar(() =>
    db.admin.from('clientes').select('id').eq('usuario_id', perfil.id).maybeSingle()
  );

  return construirSesion(perfil, data.session, cliente?.id ?? null);
}

/** Cierra la sesión en Supabase (revoca el refresh token del lado del servidor). */
async function cerrarSesion(token) {
  if (!token) return { mensaje: 'Sesión finalizada.' };
  const { error } = await db.admin.auth.admin.signOut(token);
  // Un token ya revocado no es un error para el usuario: la sesión local se
  // limpia igual en el frontend.
  if (error && !/session|not_found/i.test(error.message || '')) throw error;
  return { mensaje: 'Sesión finalizada correctamente.' };
}

/**
 * Crea un cliente nuevo o, si ya existe uno con ese email, lo vincula a la
 * cuenta recién creada. Así un invitado que se registra después encuentra
 * automáticamente sus reservas históricas.
 */
async function crearOVincularCliente({ nombre, email, telefono, usuarioId }) {
  const emailLimpio = normalizar(email);
  const telefonoLimpio = telefono ? String(telefono).trim() : null;

  const existente = await db.ejecutar(() =>
    db.admin.from('clientes').select('id, usuario_id').eq('email', emailLimpio).maybeSingle()
  );

  if (existente) {
    if (existente.usuario_id && existente.usuario_id !== usuarioId) {
      throw HttpError.conflicto('Ese email ya está asociado a otra cuenta.');
    }
    const { data } = await db.admin
      .from('clientes')
      .update({ usuario_id: usuarioId, telefono: telefonoLimpio ?? undefined })
      .eq('id', existente.id)
      .select('id')
      .single();
    return data;
  }

  const { data } = await db.admin
    .from('clientes')
    .insert({ nombre, email: emailLimpio, telefono: telefonoLimpio, usuario_id: usuarioId })
    .select('id')
    .single();
  return data;
}

/** Construye la respuesta de sesión que consume el frontend. */
function construirSesion(perfil, sesion, clienteId) {
  return {
    token: sesion.access_token,
    refreshToken: sesion.refresh_token ?? null,
    expiraEn: sesion.expires_in ?? 3600,
    usuario: {
      id: perfil.id,
      nombre: perfil.nombre,
      email: perfil.email,
      rol: perfil.rol,
      clienteId: clienteId ?? null,
      createdAt: perfil.created_at ?? null,
    },
  };
}

/** Traduce los errores de Supabase Auth al dominio de la aplicación. */
function traducirErrorAuth(error, contexto) {
  const mensaje = error?.message || '';

  if (/User already registered|already been registered|duplicate/i.test(mensaje)) {
    return HttpError.conflicto('Ya existe una cuenta con ese email.');
  }
  if (/Password should be at least/i.test(mensaje)) {
    return HttpError.badRequest('La contraseña debe tener al menos 8 caracteres.', { campo: 'password' });
  }
  if (/Email not confirmed/i.test(mensaje)) {
    return HttpError.prohibido('Confirmá tu email antes de iniciar sesión.');
  }
  if (/rate limit|too many/i.test(mensaje)) {
    return new HttpError(429, 'Demasiados intentos. Probá de nuevo en unos minutos.');
  }
  if (/unable to validate email|invalid email/i.test(mensaje)) {
    return HttpError.badRequest('El email no tiene un formato válido.', { campo: 'email' });
  }
  if (/signups not allowed/i.test(mensaje)) {
    return HttpError.prohibito('El registro está deshabilitado en este proyecto. Contactá al restaurante.');
  }

  console.error(`[auth:${contexto}]`, error);
  return new HttpError(500, 'Ha ocurrido un error inesperado. Intentá de nuevo.');
}

module.exports = {
  registrar,
  iniciarSesion,
  renovarSesion,
  perfilDesdeToken,
  actualizarPerfil,
  cerrarSesion,
};
