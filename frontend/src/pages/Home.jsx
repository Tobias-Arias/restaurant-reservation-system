/**
 * Página de inicio.
 * Ruta: /
 */

import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { mesaApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { obtenerTurnos } from '../utils/horarios';
import { hora, numero } from '../utils/format';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

export default function Home() {
  const { autenticado, esAdmin } = useAuth();
  const [datos, setDatos] = useState({ cargando: true, error: null, mesas: 0,ocupadas: 0, proximas: [] });

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      try {
        // `hoy` requiere sesión; por eso el bloque público usa sólo el salón.
        const { data: salon } = await mesaApi.estadoSalon({ hora: obtenerTurnos()[1]?.slots[1] ?? '20:00' });
        if (!vigente) return;

        const ocupadas = salon.filter((fila) => fila.ocupada).length;
        setDatos({ cargando: false, error: null, mesas: salon.length, ocupadas, proximas: [] });
      } catch (error) {
        if (vigente) setDatos({ cargando: false, error: error.message, mesas: 0, ocupadas: 0, proximas: [] });
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, []);

  const turnos = obtenerTurnos();

  return (
    <div className="home">
      {/* ---------------------------------------------------------- HERO */}
      <section className="hero">
        <div className="hero__contenido">
          <p className="hero__kicker">Cocina de autor · Producto de temporada</p>
          <h1 className="hero__titulo">Restaurante La Reserva</h1>
          <p className="hero__descripcion">
            Un salón cálido en el corazón de la ciudad, donde cada plato se cocina al momento y cada
            mesa se reserva con el cuidado que merece. Menú de temporada, sommelier y un servicio que
            se toma en serio.
          </p>

          <div className="hero__acciones">
            <Button tamano="grande" a="/reservar">
              Reservar mesa
            </Button>
            <Button tamano="grande" variante="secundario" a="/menu">
              Ver menú
            </Button>
          </div>

          <ul className="hero__datos">
            <li>
              <strong>{turnos.flatMap((t) => t.slots).length}</strong> horarios diarios
            </li>
            <li>
              <strong>90</strong> minutos por reserva
            </li>
            <li>
              <strong>Lun a Dom</strong> siempre abierto
            </li>
          </ul>
        </div>

        <aside className="hero__visual" aria-hidden="true">
          <div className="hero__mesa">
            <span className="hero__mesa-numero">4</span>
            <span className="hero__mesa-etiqueta">Mesa junto a la ventana</span>
          </div>
        </aside>
      </section>

      {/* ------------------------------------------------------- HORARIOS */}
      <section className="seccion">
        <h2 className="seccion__titulo">Horarios de reserva</h2>
        <p className="seccion__bajada">
          Las reservas duran 90 minutos y sólo se aceptan dentro de los siguientes turnos.
        </p>

        <div className="home__turnos">
          {turnos.map((turno) => (
            <Card key={turno.turno} titulo={turno.turno} subtitulo={`${turno.inicio} - ${turno.fin} hs`}>
              <ul className="home__slots">
                {turno.slots.map((slot) => (
                  <li key={slot}>
                    <Link to={`/reservar?hora=${slot}`}>{hora(slot)}</Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- EXPERIENCIA */}
      <section className="seccion seccion--alternativa">
        <h2 className="seccion__titulo">Cómo reservar</h2>
        <div className="home__pasos">
          <article className="home__paso">
            <span className="home__paso-numero">1</span>
            <h3>Elegí fecha y hora</h3>
            <p>Seleccionás el día, el horario y cuántos son. El sistema te muestra las mesas libres en tiempo real.</p>
          </article>
          <article className="home__paso">
            <span className="home__paso-numero">2</span>
            <h3>Elegí tu mesa</h3>
            <p>Ves capacidad, ubicación y si está en la terraza, la barra o la ventana. La que prefieras.</p>
          </article>
          <article className="home__paso">
            <span className="home__paso-numero">3</span>
            <h3>Confirmá la reserva</h3>
            <p>Dejás tus datos y recibís un número de reserva. Podés seguirla o cancelarla cuando quieras.</p>
          </article>
        </div>
      </section>

      {/* -------------------------------------------------------- ESTADO */}
      <section className="seccion">
        <h2 className="seccion__titulo">Estado de la casa</h2>

        {datos.cargando && <Loading texto="Consultando la disponibilidad..." />}

        <ErrorMessage
          mensaje={datos.error}
          titulo="No pudimos consultar el estado del salón"
          onReintentar={() => window.location.reload()}
        />

        {!datos.cargando && !datos.error && datos.mesas > 0 && (
          <div className="home__estado">
            <Card titulo="Mesas en servicio" variante="destacada">
              <p className="home__cifra">{numero(datos.mesas)}</p>
              <p className="home__cifra-nota">
                {numero(datos.ocupadas)} ocupadas ahora · {numero(datos.mesas - datos.ocupadas)} disponibles
              </p>
            </Card>

            <Card titulo="¿Ya reservaste?">
              {autenticado ? (
                <Button a="/mis-reservas" variante="secundario" className="btn--completo">
                  Ver mis reservas
                </Button>
              ) : (
                <EmptyState
                  icono="🔐"
                  titulo="Iniciá sesión para ver tus reservas"
                  descripcion="Crea tu cuenta en un minuto y gestioná tus reservas cuando quieras."
                  accion={<Button a="/registro" className="btn--completo">Crear cuenta</Button>}
                />
              )}
            </Card>

            {esAdmin && (
              <Card titulo="Panel administrativo">
                <Button a="/admin" variante="primario" className="btn--completo">
                  Entrar al panel
                </Button>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="home__cta">
        <h2>¿Reservas abiertas para esta semana?</h2>
        <p>Los horarios se agotan rápido en fin de semana. Reservá con antelación.</p>
        <Button a="/reservar" tamano="grande" variante="secundario">
          Reservar ahora
        </Button>
      </section>
    </div>
  );
}
