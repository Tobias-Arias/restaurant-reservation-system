/**
 * Validaciones del frontend.
 *
 * Sirven para dar una buena experiencia (mensajes inmediatos, botones
 * deshabilitados). NUNCA son la garantía: el backend vuelve a validar todo
 * en backend/utils/validators.js y la base de datos valida con CHECK/FK.
 *
 * Todas devuelven un string (mensaje de error) o '' si el valor es válido.
 * Así se pueden encadenar con Object.values(campos).every(Boolean).
 */

const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const RE_TELEFONO = /^\+?[0-9 ()\-]{6,20}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const requerido = (valor, etiqueta = 'Este campo') =>
  valor === undefined || valor === null || String(valor).trim() === ''
    ? `${etiqueta} es obligatorio.`
    : '';

export const email = (valor) => {
  if (!String(valor ?? '').trim()) return 'El email es obligatorio.';
  return RE_EMAIL.test(String(valor).trim()) ? '' : 'Ingresá un email válido.';
};

export const telefono = (valor) => {
  if (!String(valor ?? '').trim()) return ''; // Opcional.
  return RE_TELEFONO.test(String(valor).trim()) ? '' : 'Ingresá un teléfono válido (sólo números).';
};

export const nombre = (valor, etiqueta = 'El nombre') => {
  const texto = String(valor ?? '').trim();
  if (!texto) return `${etiqueta} es obligatorio.`;
  return texto.length >= 2 ? '' : `${etiqueta} debe tener al menos 2 caracteres.`;
};

export const contrasena = (valor) => {
  const texto = String(valor ?? '');
  if (!texto) return 'La contraseña es obligatoria.';
  if (texto.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Za-z]/.test(texto) || !/\d/.test(texto)) return 'Debe incluir al menos una letra y un número.';
  return '';
};

export const fecha = (valor) => {
  if (!String(valor ?? '').trim()) return 'La fecha es obligatoria.';
  if (!RE_FECHA.test(valor)) return 'La fecha no es válida.';
  return '';
};

export const fechaFutura = (valor) => {
  const errorBase = fecha(valor);
  if (errorBase) return errorBase;
  if (String(valor) < hoyISO()) return 'No se puede reservar para una fecha pasada.';
  return '';
};

export const hora = (valor) => {
  if (!String(valor ?? '').trim()) return 'La hora es obligatoria.';
  return RE_HORA.test(valor) ? '' : 'La hora no es válida.';
};

export const horaValida = (valor, slotsValidos = []) => {
  const errorBase = hora(valor);
  if (errorBase) return errorBase;
  if (slotsValidos.length > 0 && !slotsValidos.includes(valor)) {
    return 'Ese horario no está disponible. Elegí uno de los horarios propuestos.';
  }
  return '';
};

export const personas = (valor, maximo = 40) => {
  const numero = Number(valor);
  if (!valor) return 'La cantidad de personas es obligatoria.';
  if (!Number.isInteger(numero)) return 'Ingresá un número entero.';
  if (numero <= 0) return 'La cantidad de personas debe ser mayor a 0.';
  return numero > maximo ? `El máximo por reserva es de ${maximo} personas.` : '';
};

export const precio = (valor) => {
  const numero = Number(valor);
  if (valor === '' || valor === null || valor === undefined) return 'El precio es obligatorio.';
  if (!Number.isFinite(numero)) return 'Ingresá un precio válido.';
  return numero < 0 ? 'El precio no puede ser negativo.' : '';
};

export const capacidad = (valor) => {
  const numero = Number(valor);
  if (!valor) return 'La capacidad es obligatoria.';
  if (!Number.isInteger(numero)) return 'Ingresá un número entero.';
  return numero < 1 || numero > 40 ? 'La capacidad debe estar entre 1 y 40.' : '';
};

export const observaciones = (valor) =>
  String(valor ?? '').length > 500 ? 'Las observaciones no pueden superar los 500 caracteres.' : '';

/** "YYYY-MM-DD" de hoy en la zona horaria local. */
export function hoyISO() {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset() * 60_000;
  return new Date(ahora.getTime() - offset).toISOString().slice(0, 10);
}

/** Fecha de hoy desplazada N días, en formato "YYYY-MM-DD". */
export function fechaDesplazada(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return hoyISODe(fecha);
}

function hoyISODe(fecha) {
  const offset = fecha.getTimezoneOffset() * 60_000;
  return new Date(fecha.getTime() - offset).toISOString().slice(0, 10);
}

/** ¿El conjunto de errores está vacío? */
export const sinErrores = (errores) => Object.values(errores).every((mensaje) => !mensaje);

/** Valida un login. */
export const validarLogin = ({ email: correo, password }) => ({
  email: email(correo),
  password: requerido(password, 'La contraseña'),
});

/** Valida el formulario de registro. */
export const validarRegistro = ({ nombre: nom, apellido, email: correo, password, telefono: tel }) => ({
  nombre: nombre(nom),
  apellido: nombre(apellido, 'El apellido'),
  email: email(correo),
  password: contrasena(password),
  telefono: telefono(tel),
});

/**
 * Valida el formulario de reserva.
 * `slotsValidos` proviene de GET /api/estadisticas/horarios para no duplicar
 * reglas: el backend es igualmente la autoridad.
 */
export const validarReserva = ({ fecha: f, hora: h, personas: p, slotsValidos = [] }) => ({
  fecha: fechaFutura(f),
  hora: horaValida(h, slotsValidos),
  personas: personas(p),
});

/** Valida los datos de contacto del cliente. */
export const validarContacto = ({ nombre: nom, apellido, email: correo, telefono: tel, observaciones }) => ({
  nombre: nombre(nom),
  apellido: nombre(apellido, 'El apellido'),
  email: email(correo),
  telefono: telefono(tel),
  observaciones: observaciones(observaciones),
});

/** Valida el formulario de alta/edición de una mesa (panel admin). */
export const validarMesa = ({ numero, capacidad: cap, ubicacion: ubic, estado }) => ({
  numero: enteroEnRango(numero, 'El número de mesa', 1, 999),
  capacidad: enteroEnRango(cap, 'La capacidad', 1, 40),
  ubicacion: requerido(ubic, 'La ubicación'),
  estado: requerido(estado, 'El estado'),
});

/** Valida el formulario de alta/edición de un plato (panel admin). */
export const validarPlato = ({ nombre: nom, descripcion, precio: valor, categoriaId, imagenUrl }) => ({
  nombre: nombre(nom, 'El nombre del plato'),
  descripcion: requerido(descripcion, 'La descripción') || (descripcion?.length < 3 ? 'La descripción es demasiado corta.' : ''),
  precio: precio(valor),
  categoriaId: enteroEnRango(categoriaId, 'La categoría', 1),
  imagenUrl: imagenUrl && imagenUrl.length > 500 ? 'La URL de la imagen es demasiado larga.' : '',
});

/** Valida el formulario de alta/edición de una categoría (panel admin). */
export const validarCategoria = ({ nombre: nom, descripcion }) => ({
  nombre: nombre(nom, 'El nombre de la categoría'),
  descripcion: requerido(descripcion, 'La descripción') || (descripcion?.length < 3 ? 'La descripción es demasiado corta.' : ''),
});

/** Entero dentro de un rango, con mensaje de negocio. */
function enteroEnRango(valor, etiqueta, min, max) {
  if (valor === '' || valor === null || valor === undefined) return `${etiqueta} es obligatorio.`;
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return `${etiqueta} debe ser un número entero.`;
  return numero < min || numero > max ? `${etiqueta} debe estar entre ${min} y ${max}.` : '';
}
