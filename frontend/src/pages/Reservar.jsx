/**
 * Flujo de reserva completo.
 * Ruta: /reservar
 *
 * SECUENCIA (la misma que exige el enunciado):
 *   1. Elegir fecha, hora y cantidad de personas.
 *   2. "Buscar mesas"  ->  GET /api/mesas/disponibles
 *   3. Seleccionar una mesa de las devueltas.
 *   4. Completar los datos de contacto.
 *   5. "Confirmar reserva"  ->  POST /api/reservas
 *   6. Mostrar el número de reserva.
 *
 * El backend vuelve a validar todo: aunque aquí se acepte un horario, la
 * API lo rechaza si la mesa se reservó entre tu búsqueda y el envío.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mesaApi, reservaApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { obtenerDuracion, obtenerSlots, obtenerTurnos } from '../utils/horarios';
import { fechaDesplazada, sinErrores, validarContacto, validarReserva } from '../utils/validation';
import { hora as horaCorta, rangoHora } from '../utils/format';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import MesaCard from '../components/MesaCard';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';
import EmptyState from '../components/EmptyState';

const PASO_BUSQUEDA = 1;
const PASO_MESA = 2;
const PASO_DATOS = 3;
const PASO_LISTO = 4;

export default function Reservar() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const { usuario, autenticado } = useAuth();

  // Paso actual del asistente
  const [paso, setPaso] = useState(PASO_BUSQUEDA);

  // Paso 1
  const [busqueda, setBusqueda] = useState({
    fecha: fechaDesplazada(1),
    hora: parametros.get('hora') ?? '',
    personas: 2,
  });
  const [erroresBusqueda, setErroresBusqueda] = useState({});
  const [buscando, setBuscando] = useState(false);

  // Paso 2
  const [mesas, setMesas] = useState([]);
  const [mesaElegida, setMesaElegida] = useState(null);
  const [errorMesas, setErrorMesas] = useState(null);

  // Paso 3
  const [contacto, setContacto] = useState({ nombre: '', apellido: '', email: '', telefono: '', observaciones: '' });
  const [erroresContacto, setErroresContacto] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);

  // Paso 4
  const [reservaCreada, setReservaCreada] = useState(null);

  const slots = useMemo(() => obtenerSlots(), []);
  const duracion = obtenerDuracion();

  // Si el usuario está autenticado, se precargan sus datos de contacto.
  useEffect(() => {
    if (!usuario) return;
    setContacto((anterior) => ({
      ...anterior,
      nombre: anterior.nombre || (usuario.nombre ?? '').split(' ')[0] || '',
      email: anterior.email || usuario.email || '',
    }));
  }, [usuario]);

  // ---------------------------------------------------------------- PASO 1
  const cambiarBusqueda = (campo) => (evento) => {
    const { value } = evento.target;
    setBusqueda((anterior) => ({ ...anterior, [campo]: value }));
    setErroresBusqueda((anterior) => ({ ...anterior, [campo]: '' }));
  };

  async function buscarMesas(evento) {
    evento.preventDefault();

    const validacion = validarReserva({ ...busqueda, slotsValidos: slots });
    setErroresBusqueda(validacion);
    if (!sinErrores(validacion)) return;

    setBuscando(true);
    setErrorMesas(null);
    setMesaElegida(null);

    try {
      const { data } = await mesaApi.disponibles({
        fecha: busqueda.fecha,
        hora: busqueda.hora,
        personas: busqueda.personas,
      });
      setMesas(data);
      setPaso(PASO_MESA);
    } catch (error) {
      setErrorMesas({ mensaje: error.message, detalles: error.detalles });
    } finally {
      setBuscando(false);
    }
  }

  const elegirMesa = (mesa) => {
    setMesaElegida(mesa);
    setPaso(PASO_DATOS);
  };

  // ---------------------------------------------------------------- PASO 3
  const cambiarContacto = (campo) => (evento) => {
    const { value } = evento.target;
    setContacto((anterior) => ({ ...anterior, [campo]: value }));
    setErroresContacto((anterior) => ({ ...anterior, [campo]: '' }));
  };

  async function confirmarReserva(evento) {
    evento.preventDefault();

    const validacion = validarContacto(contacto);
    setErroresContacto(validacion);
    if (!sinErrores(validacion)) return;

    setEnviando(true);
    setErrorEnvio(null);

    try {
      const { data } = await reservaApi.crear({
        fecha: busqueda.fecha,
        hora: busqueda.hora,
        personas: Number(busqueda.personas),
        mesaId: mesaElegida.id,
        ...contacto,
      });

      setReservaCreada(data);
      setPaso(PASO_LISTO);
    } catch (error) {
      setErrorEnvio({ mensaje: error.message, detalles: error.detalles });
      // Si el conflicto es de disponibilidad, se vuelve a buscar mesa.
      if (error.code === 'MESA_OCUPADA') setPaso(PASO_MESA);
    } finally {
      setEnviando(false);
    }
  }

  const reiniciar = () => {
    setPaso(PASO_BUSQUEDA);
    setMesas([]);
    setMesaElegida(null);
    setReservaCreada(null);
    setErrorEnvio(null);
    setContacto({ nombre: '', apellido: '', email: '', telefono: '', observaciones: '' });
  };

  // ------------------------------------------------------------------ VISTA
  return (
    <div className="reservar">
      <header className="reservar__cabecera">
        <h1 className="reservar__titulo">Reservar mesa</h1>
        <p className="reservar__bajada">
          Cada reserva ocupa la mesa durante {duracion} minutos. Sólo aceptamos horarios dentro de los
          turnos de atención.
        </p>

        <ol className="reservar__pasos" aria-label="Pasos de la reserva">
          {[
            { id: PASO_BUSQUEDA, etiqueta: 'Fecha y hora' },
            { id: PASO_MESA, etiqueta: 'Elegir mesa' },
            { id: PASO_DATOS, etiqueta: 'Tus datos' },
            { id: PASO_LISTO, etiqueta: 'Confirmación' },
          ].map((item) => (
            <li
              key={item.id}
              className={`reservar__paso ${paso >= item.id ? 'is-activo' : ''} ${paso === item.id ? 'is-actual' : ''}`}
            >
              <span className="reservar__paso-numero">{item.id}</span>
              {item.etiqueta}
            </li>
          ))}
        </ol>
      </header>

      {/* =========================================================== PASO 1 */}
      {paso === PASO_BUSQUEDA && (
        <Card titulo="¿Cuándo querés venir?">
          <form className="formulario formulario--reserva" onSubmit={buscarMesas} noValidate>
            <Input
              label="Fecha"
              name="fecha"
              type="date"
              value={busqueda.fecha}
              onChange={cambiarBusqueda('fecha')}
              error={erroresBusqueda.fecha}
              requerido
              min={fechaDesplazada(0)}
            />

            <div className="campo">
              <span className="campo__label">
                Hora<span className="campo__obligatorio" aria-hidden="true">*</span>
              </span>
              <div className="reservar__slots" role="radiogroup" aria-label="Horarios disponibles">
                {obtenerTurnos().map((turno) => (
                  <div key={turno.turno} className="reservar__turno">
                    <p className="reservar__turno-nombre">
                      {turno.turno} <span>({turno.inicio} - {turno.fin})</span>
                    </p>
                    <div className="reservar__turno-slots">
                      {turno.slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          role="radio"
                          aria-checked={busqueda.hora === slot}
                          className={`reservar__slot ${busqueda.hora === slot ? 'is-activo' : ''}`}
                          onClick={() => {
                            setBusqueda((anterior) => ({ ...anterior, hora: slot }));
                            setErroresBusqueda((anterior) => ({ ...anterior, hora: '' }));
                          }}
                        >
                          {horaCorta(slot)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {erroresBusqueda.hora && (
                <p className="campo__error" role="alert">
                  {erroresBusqueda.hora}
                </p>
              )}
            </div>

            <Input
              label="Cantidad de personas"
              name="personas"
              type="number"
              min={1}
              max={40}
              value={busqueda.personas}
              onChange={cambiarBusqueda('personas')}
              error={erroresBusqueda.personas}
              ayuda="Las mesas se muestran según la capacidad disponible."
              requerido
            />

            <div className="formulario__acciones">
              <Button type="submit" cargando={buscando} tamano="grande">
                Buscar mesas
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* =========================================================== PASO 2 */}
      {paso === PASO_MESA && (
        <Card
          titulo={`Mesas disponibles para ${busqueda.personas} persona(s)`}
          subtitulo={`${busqueda.fecha} · ${rangoHora(busqueda.hora, duracion)}`}
          acciones={
            <Button variante="fantasma" tamano="pequeno" onClick={() => setPaso(PASO_BUSQUEDA)}>
              Cambiar búsqueda
            </Button>
          }
        >
          {buscando && <Loading texto="Consultando disponibilidad..." />}

          <ErrorMessage
            mensaje={errorMesas?.mensaje}
            titulo="No pudimos consultar la disponibilidad"
            detalles={errorMesas?.detalles}
            onReintentar={buscarMesas}
          />

          {!buscando && mesas.length === 0 && !errorMesas && (
            <EmptyState
              icono="🪑"
              titulo="No hay mesas disponibles"
              descripcion={`No encontramos mesas para ${busqueda.personas} personas en ese horario. Probá con otro horario o con menos comensales.`}
              accion={
                <Button variante="secundario" onClick={() => setPaso(PASO_BUSQUEDA)}>
                  Elegir otro horario
                </Button>
              }
            />
          )}

          {!buscando && mesas.length > 0 && (
            <>
              <p className="reservar__ayuda">
                Las mesas se ordenan por capacidad: elegí la que prefieras.
              </p>
              <div className="reservar__rejilla">
                {mesas.map((mesa) => (
                  <MesaCard
                    key={mesa.id}
                    mesa={mesa}
                    seleccionada={mesaElegida?.id === mesa.id}
                    onSeleccionar={elegirMesa}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* =========================================================== PASO 3 */}
      {paso === PASO_DATOS && mesaElegida && (
        <div className="reservar__columnas">
          <Card titulo="Tus datos">
            <form className="formulario" onSubmit={confirmarReserva} noValidate>
              {!autenticado && (
                <p className="reservar__nota">
                  <strong>Reservás como invitado.</strong> Si creás una cuenta con el mismo email,
                  vas a poder ver y cancelar esta reserva desde "Mis reservas".
                </p>
              )}

              <div className="formulario__fila">
                <Input
                  label="Nombre"
                  name="nombre"
                  value={contacto.nombre}
                  onChange={cambiarContacto('nombre')}
                  error={erroresContacto.nombre}
                  autoComplete="given-name"
                  requerido
                />
                <Input
                  label="Apellido"
                  name="apellido"
                  value={contacto.apellido}
                  onChange={cambiarContacto('apellido')}
                  error={erroresContacto.apellido}
                  autoComplete="family-name"
                  requerido
                />
              </div>

              <div className="formulario__fila">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={contacto.email}
                  onChange={cambiarContacto('email')}
                  error={erroresContacto.email}
                  autoComplete="email"
                  requerido
                />
                <Input
                  label="Teléfono"
                  name="telefono"
                  type="tel"
                  value={contacto.telefono}
                  onChange={cambiarContacto('telefono')}
                  error={erroresContacto.telefono}
                  ayuda="Para confirmarte o avisarte cambios."
                  requerido
                />
              </div>

              <Input
                label="Observaciones"
                name="observaciones"
                value={contacto.observaciones}
                onChange={cambiarContacto('observaciones')}
                error={erroresContacto.observaciones}
                rows={3}
                ayuda="Alergias, cumpleaños, silla de ruedas... (opcional)"
                placeholder="Sin observaciones"
              />

              <ErrorMessage
                mensaje={errorEnvio?.mensaje}
                titulo="No pudimos crear la reserva"
                detalles={errorEnvio?.detalles}
              />

              <div className="formulario__acciones">
                <Button variante="fantasma" type="button" onClick={() => setPaso(PASO_MESA)} disabled={enviando}>
                  Volver
                </Button>
                <Button type="submit" cargando={enviando} tamano="grande">
                  Confirmar reserva
                </Button>
              </div>
            </form>
          </Card>

          <aside className="reservar__resumen">
            <Card titulo="Tu reserva" variante="destacada">
              <dl className="reservar__resumen-datos">
                <div>
                  <dt>Mesa</dt>
                  <dd>N.º {mesaElegida.numero}</dd>
                </div>
                <div>
                  <dt>Capacidad</dt>
                  <dd>{mesaElegida.capacidad} lugares</dd>
                </div>
                <div>
                  <dt>Ubicación</dt>
                  <dd>{mesaElegida.ubicacion}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{busqueda.fecha.split('-').reverse().join('/')}</dd>
                </div>
                <div>
                  <dt>Hora</dt>
                  <dd>{rangoHora(busqueda.hora, duracion)}</dd>
                </div>
                <div>
                  <dt>Personas</dt>
                  <dd>{busqueda.personas}</dd>
                </div>
              </dl>
              <p className="reservar__resumen-nota">
                La mesa queda apartada {duracion} minutos. Si no se presentan, la reserva se cancela
                automáticamente.
              </p>
            </Card>
          </aside>
        </div>
      )}

      {/* =========================================================== PASO 4 */}
      {paso === PASO_LISTO && reservaCreada && (
        <div className="reservar__exito">
          <Card variante="exito">
            <SuccessMessage titulo="¡Reserva realizada correctamente!">
              Tu mesa quedó apartada. A continuación están todos los detalles de la reserva.
            </SuccessMessage>

            <div className="reservar__codigo">
              <p>Número de reserva</p>
              <strong>{reservaCreada.codigo}</strong>
              <span>Anotá este código por si necesitás consultar o cancelar.</span>
            </div>

            <dl className="reservar__resumen-datos">
              <div>
                <dt>Fecha</dt>
                <dd>{reservaCreada.fecha.split('-').reverse().join('/')}</dd>
              </div>
              <div>
                <dt>Hora</dt>
                <dd>{rangoHora(reservaCreada.hora, duracion)}</dd>
              </div>
              <div>
                <dt>Mesa</dt>
                <dd>N.º {reservaCreada.mesa.numero}</dd>
              </div>
              <div>
                <dt>Personas</dt>
                <dd>{reservaCreada.personas}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd className="reservar__estado">{reservaCreada.estado}</dd>
              </div>
              <div>
                <dt>A nombre de</dt>
                <dd>
                  {reservaCreada.cliente.nombre} {reservaCreada.cliente.apellido}
                </dd>
              </div>
            </dl>

            <div className="reservar__exito-acciones">
              {autenticado && (
                <Button a="/mis-reservas" variante="secundario">
                  Ver mis reservas
                </Button>
              )}
              <Button variante="fantasma" onClick={reiniciar}>
                Hacer otra reserva
              </Button>
              <Button variante="fantasma" a="/menu">
                Ver el menú
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
