/**
 * Servicio de menú: platos y categorías.
 *
 * Se agrupan en un mismo servicio porque las categorías sin platos no tienen
 * sentido por sí solas y el panel administrativo de menú las gestiona juntas.
 */

const db = require('../database/supabase');
const HttpError = require('../utils/HttpError');
const {
  validarId,
  validarTexto,
  validarDecimal,
  normalizarTexto,
} = require('../utils/validators');

const CAMPOS_PLATO = 'id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, created_at';
const CAMPOS_CATEGORIA = 'id, nombre, descripcion';

// ---------------------------------------------------------------------------
// Platos
// ---------------------------------------------------------------------------

/**
 * Lista platos. Si `soloDisponibles` es true y no se indica `todos=true`
 * (uso del administrador), se ocultan los desactivados al público.
 */
async function listarPlatos({ categoriaId, busqueda, disponible, incluirInactivos = false } = {}) {
  let consulta = db.admin.from('platos').select(CAMPOS_PLATO);

  if (categoriaId) consulta = consulta.eq('categoria_id', validarId(categoriaId, 'categoriaId'));
  if (disponible !== undefined && disponible !== '') {
    consulta = consulta.eq('disponible', disponible === 'true' || disponible === true);
  } else if (!incluirInactivos) {
    consulta = consulta.eq('disponible', true);
  }

  const texto = normalizarTexto(busqueda ?? '');
  if (texto.length >= 2) {
    consulta = consulta.or(`nombre.ilike.%${texto}%,descripcion.ilike.%${texto}%`);
  }

  const platos = await db.ejecutar(() =>
    consulta.order('categoria_id', { ascending: true }).order('nombre', { ascending: true })
  );

  const categorias = await listarCategorias();
  const nombrePorId = new Map(categorias.map((c) => [c.id, c.nombre]));

  return platos.map((plato) => ({
    ...normalizarPlato(plato),
    categoria: nombrePorId.get(plato.categoria_id) ?? 'Sin categoría',
  }));
}

async function obtenerPlato(id) {
  const platoId = validarId(id, 'id');
  const plato = await db.ejecutar(() =>
    db.admin.from('platos').select(CAMPOS_PLATO).eq('id', platoId).maybeSingle()
  );
  if (!plato) throw HttpError.noEncontrado('El plato solicitado no existe.');
  return normalizarPlato(plato);
}

async function crearPlato({ categoriaId, nombre, descripcion, precio, imagenUrl, disponible }) {
  const datos = {
    categoria_id: validarId(categoriaId, 'categoriaId'),
    nombre: validarTexto(nombre, 'nombre', { min: 3, max: 100 }),
    descripcion: validarTexto(descripcion, 'descripcion', { min: 3, max: 400, esRequerido: false }),
    precio: validarDecimal(precio, 'precio', { min: 0, max: 100_000 }),
    imagen_url: validarTexto(imagenUrl, 'imagenUrl', { min: 0, max: 500, esRequerido: false }),
    disponible: disponible === undefined ? true : Boolean(disponible),
  };

  await afirmarCategoriaExiste(datos.categoria_id);

  const plato = await db.ejecutar(() => db.admin.from('platos').insert(datos).select(CAMPOS_PLATO).single());
  return normalizarPlato(plato);
}

async function actualizarPlato(id, cuerpo) {
  const platoId = validarId(id, 'id');

  const existente = await db.ejecutar(() => db.admin.from('platos').select('id').eq('id', platoId).maybeSingle());
  if (!existente) throw HttpError.noEncontrado('El plato solicitado no existe.');

  const datos = {};
  if (cuerpo.categoriaId !== undefined) {
    datos.categoria_id = validarId(cuerpo.categoriaId, 'categoriaId');
    await afirmarCategoriaExiste(datos.categoria_id);
  }
  if (cuerpo.nombre !== undefined) datos.nombre = validarTexto(cuerpo.nombre, 'nombre', { min: 3, max: 100 });
  if (cuerpo.descripcion !== undefined) {
    datos.descripcion = validarTexto(cuerpo.descripcion, 'descripcion', { min: 3, max: 400, esRequerido: false });
  }
  if (cuerpo.precio !== undefined) {
    datos.precio = validarDecimal(cuerpo.precio, 'precio', { min: 0, max: 100_000 });
  }
  if (cuerpo.imagenUrl !== undefined) {
    datos.imagen_url = validarTexto(cuerpo.imagenUrl, 'imagenUrl', { min: 0, max: 500, esRequerido: false });
  }
  if (cuerpo.disponible !== undefined) datos.disponible = Boolean(cuerpo.disponible);

  if (Object.keys(datos).length === 0) {
    throw HttpError.badRequest('No se envió ningún campo para actualizar.');
  }

  const plato = await db.ejecutar(() =>
    db.admin.from('platos').update(datos).eq('id', platoId).select(CAMPOS_PLATO).single()
  );
  return normalizarPlato(plato);
}

/**
 * Elimina un plato. Si ya aparece en el historial de pedidos no se borra:
 * se desactiva, porque los pedidos antiguos deben conservar su precio.
 */
async function eliminarPlato(id) {
  const platoId = validarId(id, 'id');

  const plato = await db.ejecutar(() => db.admin.from('platos').select('id, nombre').eq('id', platoId).maybeSingle());
  if (!plato) throw HttpError.noEncontrado('El plato solicitado no existe.');

  const { count } = await db.admin
    .from('detalle_pedido')
    .select('id', { count: 'exact', head: true })
    .eq('plato_id', platoId);

  if ((count ?? 0) > 0) {
    await db.ejecutar(() => db.admin.from('platos').update({ disponible: false }).eq('id', platoId));
    return {
      id: platoId,
      desactivado: true,
      mensaje: `"${plato.nombre}" aparece en pedidos históricos, por lo que se desactivó en lugar de eliminarse.`,
    };
  }

  await db.ejecutar(() => db.admin.from('platos').delete().eq('id', platoId));
  return { id: platoId, desactivado: false, mensaje: `Plato "${plato.nombre}" eliminado correctamente.` };
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

/** Lista las categorías con el número de platos de cada una. */
async function listarCategorias() {
  const categorias = await db.ejecutar(() =>
    db.admin.from('categorias').select(CAMPOS_CATEGORIA).order('nombre', { ascending: true })
  );

  const platos = await db.ejecutar(() => db.admin.from('platos').select('categoria_id, disponible'));

  return categorias.map((categoria) => {
    const propios = platos.filter((p) => p.categoria_id === categoria.id);
    return {
      ...normalizarCategoria(categoria),
      totalPlatos: propios.length,
      platosDisponibles: propios.filter((p) => p.disponible).length,
    };
  });
}

async function obtenerCategoria(id) {
  const categoriaId = validarId(id, 'id');
  const categorias = await listarCategorias();
  const encontrada = categorias.find((c) => c.id === categoriaId);
  if (!encontrada) throw HttpError.noEncontrado('La categoría solicitada no existe.');
  return encontrada;
}

async function crearCategoria({ nombre, descripcion }) {
  const datos = {
    nombre: validarTexto(nombre, 'nombre', { min: 3, max: 60 }),
    descripcion: validarTexto(descripcion, 'descripcion', { min: 3, max: 300, esRequerido: false }),
  };

  const repetida = await db.ejecutar(() => db.admin.from('categorias').select('id').ilike('nombre', datos.nombre).maybeSingle());
  if (repetida) throw HttpError.conflicto('Ya existe una categoría con ese nombre.');

  const categoria = await db.ejecutar(() =>
    db.admin.from('categorias').insert(datos).select(CAMPOS_CATEGORIA).single()
  );
  return normalizarCategoria(categoria);
}

async function actualizarCategoria(id, cuerpo) {
  const categoriaId = validarId(id, 'id');

  const existente = await db.ejecutar(() => db.admin.from('categorias').select('id').eq('id', categoriaId).maybeSingle());
  if (!existente) throw HttpError.noEncontrado('La categoría solicitada no existe.');

  const datos = {};
  if (cuerpo.nombre !== undefined) {
    datos.nombre = validarTexto(cuerpo.nombre, 'nombre', { min: 3, max: 60 });
    const repetida = await db.admin
      .from('categorias')
      .select('id')
      .ilike('nombre', datos.nombre)
      .neq('id', categoriaId)
      .maybeSingle();
    if (repetida) throw HttpError.conflicto('Ya existe una categoría con ese nombre.');
  }
  if (cuerpo.descripcion !== undefined) {
    datos.descripcion = validarTexto(cuerpo.descripcion, 'descripcion', { min: 3, max: 300, esRequerido: false });
  }

  if (Object.keys(datos).length === 0) {
    throw HttpError.badRequest('No se envió ningún campo para actualizar.');
  }

  const categoria = await db.ejecutar(() =>
    db.admin.from('categorias').update(datos).eq('id', categoriaId).select(CAMPOS_CATEGORIA).single()
  );
  return normalizarCategoria(categoria);
}

/** Elimina una categoría. Sólo si no tiene platos asociados. */
async function eliminarCategoria(id) {
  const categoriaId = validarId(id, 'id');

  const categoria = await db.ejecutar(() => db.admin.from('categorias').select('id, nombre').eq('id', categoriaId).maybeSingle());
  if (!categoria) throw HttpError.noEncontrado('La categoría solicitada no existe.');

  const { count } = await db.admin
    .from('platos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', categoriaId);

  if ((count ?? 0) > 0) {
    throw HttpError.conflicto(
      `No se puede eliminar la categoría "${categoria.nombre}": tiene ${count} plato(s) asociados. ` +
        'Reasignalos o eliminalos primero.'
    );
  }

  await db.ejecutar(() => db.admin.from('categorias').delete().eq('id', categoriaId));
  return { id: categoriaId, mensaje: `Categoría "${categoria.nombre}" eliminada correctamente.` };
}

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

async function afirmarCategoriaExiste(categoriaId) {
  const existe = await db.ejecutar(() => db.admin.from('categorias').select('id').eq('id', categoriaId).maybeSingle());
  if (!existe) throw HttpError.noProcesable('La categoría seleccionada no existe.');
}

function normalizarPlato(plato) {
  return {
    id: Number(plato.id),
    categoriaId: Number(plato.categoria_id),
    nombre: plato.nombre,
    descripcion: plato.descripcion,
    precio: Number(plato.precio),
    imagenUrl: plato.imagen_url,
    disponible: Boolean(plato.disponible),
    createdAt: plato.created_at,
  };
}

function normalizarCategoria(categoria) {
  return {
    id: Number(categoria.id),
    nombre: categoria.nombre,
    descripcion: categoria.descripcion,
  };
}

module.exports = {
  listarPlatos,
  obtenerPlato,
  crearPlato,
  actualizarPlato,
  eliminarPlato,
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
};
