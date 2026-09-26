/**
 * GestiÃ³n del menÃº (administrador).
 * Ruta: /admin/menu
 *
 * Platos: crear, editar, activar/desactivar y eliminar.
 * CategorÃ­as: crear y editar.
 */

import { useCallback, useEffect, useState } from 'react';
import { categoriaApi, platoApi } from '../services/api';
import { precio as precioFormato } from '../utils/format';
import { sinErrores, validarCategoria, validarPlato } from '../utils/validation';
import Button from '../components/Button';
import Card from '../components/Card';
import Table from '../components/Table';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalAcciones } from '../components/Modal';
import Input, { Select } from '../components/Input';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';
import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';

const PLATO_VACIO = {
  id: null,
  nombre: '',
  descripcion: '',
  precio: '',
  categoriaId: '',
  imagenUrl: '',
  disponible: true,
};

const CATEGORIA_VACIA = { id: null, nombre: '', descripcion: '' };

export default function AdminMenu() {
  const [platos, setPlatos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState('');

  const [editandoPlato, setEditandoPlato] = useState(null);
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [platosRes, categoriasRes] = await Promise.all([
        platoApi.listar({ incluirInactivos: mostrarInactivos, categoriaId: categoriaActiva }),
        categoriaApi.listar(),
      ]);
      setPlatos(platosRes.data);
      setCategorias(categoriasRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [mostrarInactivos, categoriaActiva]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ------------------------------------------------------------- acciones
  async function guardarPlato(evento) {
    evento.preventDefault();

    const validacion = validarPlato(editandoPlato.plato);
    setEditandoPlato((anterior) => ({ ...anterior, errores: validacion }));
    if (!sinErrores(validacion)) return;

    setProcesando(true);
    setErrorAccion(null);
    try {
      const cuerpo = {
        nombre: editandoPlato.plato.nombre,
        descripcion: editandoPlato.plato.descripcion,
        precio: Number(editandoPlato.plato.precio),
        categoriaId: Number(editandoPlato.plato.categoriaId),
        imagenUrl: editandoPlato.plato.imagenUrl,
        disponible: editandoPlato.plato.disponible,
      };
      const { data } = editandoPlato.plato.id
        ? await platoApi.actualizar(editandoPlato.plato.id, cuerpo)
        : await platoApi.crear(cuerpo);

      setPlatos((anteriores) =>
        editandoPlato.plato.id
          ? anteriores.map((p) => (p.id === data.id ? { ...p, ...data } : p))
          : [...anteriores, data]
      );
      setExito(editandoPlato.plato.id ? `Plato "${data.nombre}" actualizado.` : `Plato "${data.nombre}" creado.`);
      setEditandoPlato(null);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function guardarCategoria(evento) {
    evento.preventDefault();

    const validacion = validarCategoria(editandoCategoria.categoria);
    setEditandoCategoria((anterior) => ({ ...anterior, errores: validacion }));
    if (!sinErrores(validacion)) return;

    setProcesando(true);
    setErrorAccion(null);
    try {
      const cuerpo = {
        nombre: editandoCategoria.categoria.nombre,
        descripcion: editandoCategoria.categoria.descripcion,
      };
      const { data } = editandoCategoria.categoria.id
        ? await categoriaApi.actualizar(editandoCategoria.categoria.id, cuerpo)
        : await categoriaApi.crear(cuerpo);

      setCategorias((anteriores) =>
        editandoCategoria.categoria.id
          ? anteriores.map((c) => (c.id === data.id ? { ...c, ...data } : c))
          : [...anteriores, { ...data, totalPlatos: 0, platosDisponibles: 0 }]
      );
      setExito(`CategorÃ­a "${data.nombre}" guardada.`);
      setEditandoCategoria(null);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function alternarDisponibilidad(plato) {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const { data } = await platoApi.actualizar(plato.id, { disponible: !plato.disponible });
      setPlatos((anteriores) => anteriores.map((p) => (p.id === data.id ? { ...p, ...data } : p)));
      setExito(`"${data.nombre}" quedÃ³ ${data.disponible ? 'disponible' : 'desactivado'}.`);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function eliminar() {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const { data } = await platoApi.eliminar(aEliminar.id);
      if (data.desactivado) {
        setPlatos((anteriores) => anteriores.map((p) => (p.id === data.id ? { ...p, disponible: false } : p)));
      } else {
        setPlatos((anteriores) => anteriores.filter((p) => p.id !== data.id));
      }
      setExito(data.mensaje);
      setAEliminar(null);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  // ------------------------------------------------------------ columnas
  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Plato',
      render: (p) => (
        <div className="tabla__principal">
          <strong>{p.nombre}</strong>
          <span className="tabla__nota">{p.descripcion}</span>
        </div>
      ),
    },
    { clave: 'categoria', titulo: 'CategorÃ­a', render: (p) => p.categoria },
    {
      clave: 'precio',
      titulo: 'Precio',
      alinear: 'right',
      render: (p) => precioFormato(p.precio),
    },
    {
      clave: 'disponible',
      titulo: 'Estado',
      render: (p) => <StatusBadge estado={p.disponible ? 'disponible' : 'cancelada'} />,
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (p) => (
        <div className="tabla__acciones">
          <button
            type="button"
            className="link"
            onClick={() => { setEditandoPlato({ plato: { ...p }, errores: {} }); setErrorAccion(null); }}
          >
            Editar
          </button>
          <button type="button" className="link" onClick={() => alternarDisponibilidad(p)} disabled={procesando}>
            {p.disponible ? 'Desactivar' : 'Activar'}
          </button>
          <button type="button" className="link link--peligro" onClick={() => { setAEliminar(p); setErrorAccion(null); }}>
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-menu">
      <header className="admin-pagina__cabecera">
        <div>
          <h1 className="admin-pagina__titulo">MenÃº</h1>
          <p className="admin-pagina__bajada">
            {platos.length} plato(s) en {categorias.length} categorÃ­a(s)
          </p>
        </div>
        <div className="admin-pagina__acciones">
          <Select
            label="CategorÃ­a"
            name="filtroCategoriaMenu"
            value={categoriaActiva}
            onChange={(e) => setCategoriaActiva(e.target.value)}
            opciones={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            placeholder="Todas las categorÃ­as"
          />
          <Button onClick={() => { setEditandoPlato({ plato: { ...PLATO_VACIO }, errores: {} }); setErrorAccion(null); }}>
            Crear plato
          </Button>
        </div>
      </header>

      <SuccessMessage mensaje={exito} onCerrar={() => setExito('')} autoCerrar={6000} />
      <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />

      {/* ----------------------------------------------------- PLATOS */}
      <Card sinPadding>
        <div className="admin-menu__barra">
          <h2 className="admin-menu__titulo">Platos</h2>
          <label className="admin-menu__switch">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            Mostrar desactivados
          </label>
        </div>

        <ErrorMessage mensaje={error} titulo="No pudimos cargar el menÃº" onReintentar={cargar} />
        <Table
          columnas={columnas}
          filas={platos}
          cargando={cargando}
          mensajeVacio="No hay platos en esta categorÃ­a."
        />
      </Card>

      {/* ------------------------------------------------- CATEGORÃAS */}
      <Card titulo="CategorÃ­as" subtitulo="Agrupan los platos del menÃº">
        {cargando ? (
          <Loading texto="Cargando categorÃ­as..." />
        ) : categorias.length === 0 ? (
          <EmptyState icono="ðŸ“‚" titulo="No hay categorÃ­as" descripcion="CreÃ¡ la primera para poder agregar platos." />
        ) : (
          <div className="admin-menu__categorias">
            {categorias.map((categoria) => (
              <article key={categoria.id} className="admin-menu__categoria">
                <div>
                  <h3>{categoria.nombre}</h3>
                  <p>{categoria.descripcion}</p>
                  <span className="admin-menu__contador">
                    {categoria.platosDisponibles} de {categoria.totalPlatos} disponibles
                  </span>
                </div>
                <div className="admin-menu__categoria-acciones">
                  <Button
                    variante="fantasma"
                    tamano="pequeno"
                    onClick={() => { setEditandoCategoria({ categoria: { ...categoria }, errores: {} }); setErrorAccion(null); }}
                  >
                    Editar
                  </Button>
                  <Button
                    variante="fantasma"
                    tamano="pequeno"
                    onClick={() => { setEditandoPlato({ plato: { ...PLATO_VACIO, categoriaId: categoria.id }, errores: {} }); setErrorAccion(null); }}
                  >
                    + Plato
                  </Button>
                </div>
              </article>
            ))}

            <Button
              variante="secundario"
              onClick={() => { setEditandoCategoria({ categoria: { ...CATEGORIA_VACIA }, errores: {} }); setErrorAccion(null); }}
            >
              Crear categorÃ­a
            </Button>
          </div>
        )}
      </Card>

      {/* -------------------------------------------------- MODAL PLATO */}
      <Modal
        abierto={Boolean(editandoPlato)}
        onCerrar={() => setEditandoPlato(null)}
        titulo={editandoPlato?.plato?.id ? `Editar ${editandoPlato.plato.nombre}` : 'Crear plato'}
        descripcion="Los platos desactivados no aparecen en el menÃº pÃºblico."
        pie={
          <ModalAcciones
            onCancelar={() => setEditandoPlato(null)}
            onConfirmar={guardarPlato}
            textoConfirmar={editandoPlato?.plato?.id ? 'Guardar cambios' : 'Crear plato'}
            cargando={procesando}
          />
        }
      >
        {editandoPlato && (
          <form className="formulario" onSubmit={guardarPlato} noValidate>
            <Input
              label="Nombre"
              name="platoNombre"
              value={editandoPlato.plato.nombre}
              onChange={(e) => setEditandoPlato((a) => ({ ...a, plato: { ...a.plato, nombre: e.target.value } }))}
              error={editandoPlato.errores?.nombre}
              requerido
            />

            <div className="formulario__fila">
              <Select
                label="CategorÃ­a"
                name="platoCategoria"
                value={editandoPlato.plato.categoriaId}
                onChange={(e) => setEditandoPlato((a) => ({ ...a, plato: { ...a.plato, categoriaId: e.target.value } }))}
                error={editandoPlato.errores?.categoriaId}
                opciones={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
                placeholder="Seleccionar categorÃ­a"
                requerido
              />
              <Input
                label="Precio"
                name="platoPrecio"
                type="number"
                min={0}
                step="0.01"
                value={editandoPlato.plato.precio}
                onChange={(e) => setEditandoPlato((a) => ({ ...a, plato: { ...a.plato, precio: e.target.value } }))}
                error={editandoPlato.errores?.precio}
                requerido
              />
            </div>

            <Input
              label="DescripciÃ³n"
              name="platoDescripcion"
              rows={3}
              value={editandoPlato.plato.descripcion ?? ''}
              onChange={(e) => setEditandoPlato((a) => ({ ...a, plato: { ...a.plato, descripcion: e.target.value } }))}
              error={editandoPlato.errores?.descripcion}
              requerido
            />

            <Input
              label="URL de la imagen"
              name="platoImagen"
              type="url"
              value={editandoPlato.plato.imagenUrl ?? ''}
              onChange={(e) => setEditandoPlato((a) => ({ ...a, plato: { ...a.plato, imagenUrl: e.target.value } }))}
              error={editandoPlato.errores?.imagenUrl}
              ayuda="Opcional. Si queda vacÃ­a se muestra la inicial del plato."
            />

            <label className="admin-menu__check">
              <input
                type="checkbox"
                checked={Boolean(editandoPlato.plato.disponible)}
                onChange={(e) => setEditandoPlato((a) => ({ ...a, plato: { ...a.plato, disponible: e.target.checked } }))}
              />
              Plato disponible (visible en el menÃº pÃºblico)
            </label>

            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </form>
        )}
      </Modal>

      {/* --------------------------------------------- MODAL CATEGORÃA */}
      <Modal
        abierto={Boolean(editandoCategoria)}
        onCerrar={() => setEditandoCategoria(null)}
        titulo={editandoCategoria?.categoria?.id ? 'Editar categorÃ­a' : 'Crear categorÃ­a'}
        pie={
          <ModalAcciones
            onCancelar={() => setEditandoCategoria(null)}
            onConfirmar={guardarCategoria}
            textoConfirmar="Guardar"
            cargando={procesando}
          />
        }
      >
        {editandoCategoria && (
          <form className="formulario" onSubmit={guardarCategoria} noValidate>
            <Input
              label="Nombre"
              name="categoriaNombre"
              value={editandoCategoria.categoria.nombre}
              onChange={(e) => setEditandoCategoria((a) => ({ ...a, categoria: { ...a.categoria, nombre: e.target.value } }))}
              error={editandoCategoria.errores?.nombre}
              requerido
            />
            <Input
              label="DescripciÃ³n"
              name="categoriaDescripcion"
              rows={2}
              value={editandoCategoria.categoria.descripcion ?? ''}
              onChange={(e) => setEditandoCategoria((a) => ({ ...a, categoria: { ...a.categoria, descripcion: e.target.value } }))}
              error={editandoCategoria.errores?.descripcion}
              requerido
            />
            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </form>
        )}
      </Modal>

      {/* -------------------------------------------------- MODAL BORRAR */}
      <Modal
        abierto={Boolean(aEliminar)}
        onCerrar={() => setAEliminar(null)}
        titulo="Eliminar plato"
        descripcion="Si el plato aparece en pedidos histÃ³ricos se desactivarÃ¡ en lugar de eliminarse."
        tamano="chico"
        pie={
          <ModalAcciones
            onCancelar={() => setAEliminar(null)}
            onConfirmar={eliminar}
            textoConfirmar="SÃ­, eliminar"
            cargando={procesando}
          />
        }
      >
        {aEliminar && (
          <div className="modal__texto">
            <p>
              Â¿Eliminar <strong>{aEliminar.nombre}</strong> ({precioFormato(aEliminar.precio)})?
            </p>
            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
