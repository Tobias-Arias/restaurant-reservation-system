/**
 * Página de menú.
 * Ruta: /menu
 *
 * Los platos y las categorías se obtienen SIEMPRE de la API
 * (GET /api/platos y GET /api/categorias). No hay datos hardcodeados.
 */

import { useEffect, useMemo, useState } from 'react';
import { categoriaApi, platoApi } from '../services/api';
import Button from '../components/Button';
import PlatoCard from '../components/PlatoCard';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

const TODAS = 'todas';

export default function Menu() {
  const [platos, setPlatos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(TODAS);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const [platosRes, categoriasRes] = await Promise.all([platoApi.listar(), categoriaApi.listar()]);
        if (!vigente) return;
        setPlatos(platosRes.data);
        setCategorias(categoriasRes.data);
      } catch (err) {
        if (vigente) setError(err.message);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return platos.filter((plato) => {
      const coincideCategoria = categoriaActiva === TODAS || String(plato.categoriaId) === String(categoriaActiva);
      const coincideTexto =
        texto === '' ||
        plato.nombre.toLowerCase().includes(texto) ||
        (plato.descripcion ?? '').toLowerCase().includes(texto);
      return coincideCategoria && coincideTexto;
    });
  }, [platos, categoriaActiva, busqueda]);

  /** Agrupa por categoría respetando el orden de las categorías del backend. */
  const porCategoria = useMemo(() => {
    if (categoriaActiva !== TODAS) return [{ id: categoriaActiva, nombre: nombreDe(categoriaActiva), platos: filtrados }];
    return categorias
      .map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        platos: filtrados.filter((plato) => plato.categoriaId === categoria.id),
      }))
      .filter((grupo) => grupo.platos.length > 0);
  }, [categorias, categoriaActiva, filtrados]);

  function nombreDe(categoriaId) {
    return categorias.find((c) => String(c.id) === String(categoriaId))?.nombre ?? 'Otros';
  }

  return (
    <div className="menu">
      <header className="menu__cabecera">
        <h1 className="menu__titulo">Nuestro menú</h1>
        <p className="menu__bajada">
          Platos de temporada/elaborados a la parrilla y al horno de leña. Los precios incluyen los
          impuestos. Los platos agotados se actualizan a diario.
        </p>
      </header>

      {/* ------------------------------------------------------- FILTROS */}
      <div className="menu__filtros">
        <div className="menu__pestanas" role="tablist" aria-label="Categorías del menú">
          <button
            type="button"
            role="tab"
            aria-selected={categoriaActiva === TODAS}
            className={`menu__pestana ${categoriaActiva === TODAS ? 'is-activa' : ''}`}
            onClick={() => setCategoriaActiva(TODAS)}
          >
            Todo
          </button>
          {categorias.map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              role="tab"
              aria-selected={categoriaActiva === categoria.id}
              className={`menu__pestana ${categoriaActiva === categoria.id ? 'is-activa' : ''}`}
              onClick={() => setCategoriaActiva(categoria.id)}
            >
              {categoria.nombre}
            </button>
          ))}
        </div>

        <div className="menu__buscador">
          <input
            type="search"
            className="campo__control"
            placeholder="Buscar un plato..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar platos por nombre o descripción"
          />
        </div>
      </div>

      {/* --------------------------------------------------------- LISTA */}
      {cargando && <Loading texto="Cargando el menú..." variante="esqueleto" filas={6} />}

      <ErrorMessage
        mensaje={error}
        titulo="No pudimos cargar el menú"
        onReintentar={() => window.location.reload()}
      />

      {!cargando && !error && filtrados.length === 0 && (
        <EmptyState
          icono="🔍"
          titulo="No encontramos platos"
          descripcion="Probá con otro término de búsqueda o quitá el filtro de categoría."
          accion={
            <Button
              variante="secundario"
              onClick={() => {
                setBusqueda('');
                setCategoriaActiva(TODAS);
              }}
            >
              Limpiar filtros
            </Button>
          }
        />
      )}

      {!cargando &&
        !error &&
        porCategoria.map((grupo) => (
          <section key={grupo.id} className="menu__seccion">
            <h2 className="menu__seccion-titulo">{grupo.nombre.toUpperCase()}</h2>
            <div className="menu__rejilla">
              {grupo.platos.map((plato) => (
                <PlatoCard key={plato.id} plato={plato} />
              ))}
            </div>
          </section>
        ))}

      <div className="menu__cta">
        <p>¿Te gustaron los platos? Reservá tu mesa.</p>
        <Button a="/reservar" tamano="grande">
          Reservar mesa
        </Button>
      </div>
    </div>
  );
}
