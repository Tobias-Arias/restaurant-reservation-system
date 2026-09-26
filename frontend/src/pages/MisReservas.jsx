/**
 * Reservas del cliente autenticado.
 * Ruta: /mis-reservas
 *
 * Consume GET /api/reservas/mias. El backend ya filtra por cliente_id, de
 * modo que un usuario no puede ver (ni cancelar) reservas de otra persona
 * aunque manipule la URL.
 */

import { useCallback, useEffect, useState } from 'react';
import { reservaApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fechaRelativa } from '../utils/format';
import { hoyISO } from '../utils/validation';
import Button from '../components/Button';
import Card from '../components/Card';
import ReservaCard from '../components/ReservaCard';
import Modal, { ModalAcciones } from '../components/Modal';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';
import EmptyState from '../components/EmptyState';

const FILTROS = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'proximas', etiqueta: 'PrÃ³ximas' },
  { valor: 'activas', etiqueta: 'Pendientes y confirmadas' },
  { valor: 'pasadas', etiqueta: 'Historial' },
  { valor: 'canceladas', etiqueta: 'Canceladas' },
];

export default function MisReservas() {
  const { usuario } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState('');
  const [filtro, setFiltro] = useState('todas');

  const [aCancelar, setACancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await reservaApi.mias();
      setReservas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cancelar() {
    setCancelando(true);
    setErrorCancelar(null);
    try {
      await reservaApi.cancelar(aCancelar.id);
      setReservas((anteriores) =>
        anteriores.map((r) => (r.id === aCancelar.id ? { ...r, estado: 'cancelada' } : r))
      );
      setExito(`La reserva ${aCancelar.codigo} fue cancelada.`);
      setACancelar(null);
    } catch (err) {
      setErrorCancelar(err.message);
    } finally {
      setCancelando(false);
    }
  }

  const hoy = hoyISO();
  const visibles = reservas.filter((reserva) => {
    const esPasada = reserva.fecha < hoy;
    const activa = reserva.estado === 'pendiente' || reserva.estado === 'confirmada';
    switch (filtro) {
      case 'proximas':
        return reserva.fecha >= hoy && reserva.estado !== 'cancelada';
      case 'activas':
        return activa;
      case 'pasadas':
        return esPasada && reserva.estado !== 'cancelada';
      case 'canceladas':
        return reserva.estado === 'cancelada';
      default:
        return true;
    }
  });

  const proximas = visibles.filter((r) => r.fecha >= hoy && r.estado !== 'cancelada');
  const historial = visibles.filter((r) => r.fecha < hoy || r.estado === 'cancelada');

  return (
    <div className="mis-reservas">
      <header className="mis-reservas__cabecera">
        <div>
          <h1 className="mis-reservas__titulo">Mis reservas</h1>
          <p className="mis-reservas__bajada">
            Hola {usuario?.nombre?.split(' ')[0]}, acÃ¡ estÃ¡n todas tus reservas.
          </p>
        </div>
        <Button a="/reservar" variante="secundario">
          Nueva reserva
        </Button>
      </header>

      <ErrorMessage
        mensaje={error}
        titulo="No pudimos cargar tus reservas"
        onReintentar={cargar}
      />

      <SuccessMessage
        mensaje={exito}
        onCerrar={() => setExito('')}
        autoCerrar={6000}
      />

      <nav className="mis-reservas__filtros" aria-label="Filtrar reservas">
        {FILTROS.map((item) => (
          <button
            key={item.valor}
            type="button"
            className={`chip ${filtro === item.valor ? 'is-activo' : ''}`}
            onClick={() => setFiltro(item.valor)}
          >
            {item.etiqueta}
          </button>
        ))}
      </nav>

      {cargando && <Loading texto="Cargando tus reservas..." variante="esqueleto" filas={4} />}

      {!cargando && !error && reservas.length === 0 && (
        <EmptyState
          icono="ðŸ—“ï¸"
          titulo="TodavÃ­a no tenÃ©s reservas"
          descripcion="Cuando reserves una mesa, vas a verla acÃ¡ con su nÃºmero y estado."
          accion={<Button a="/reservar">Reservar mi primera mesa</Button>}
        />
      )}

      {!cargando && !error && reservas.length > 0 && visibles.length === 0 && (
        <EmptyState
          icono="ðŸ”"
          titulo="No hay reservas con ese filtro"
          descripcion="ProbÃ¡ seleccionando otro filtro."
          accion={
            <Button variante="secundario" onClick={() => setFiltro('todas')}>
              Ver todas
            </Button>
          }
        />
      )}

      {proximas.length > 0 && (
        <Card titulo="PrÃ³ximas" subtitulo={`${proximas.length} reserva(s) activas`}>
          <div className="mis-reservas__rejilla">
            {proximas.map((reserva) => (
              <ReservaCard
                key={reserva.id}
                reserva={reserva}
                onCancelar={
                  reserva.estado === 'pendiente' || reserva.estado === 'confirmada'
                    ? () => {
                        setErrorCancelar(null);
                        setACancelar(reserva);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </Card>
      )}

      {historial.length > 0 && (
        <Card titulo="Historial" subtitulo="Visitas anteriores y reservas canceladas">
          <div className="mis-reservas__rejilla">
            {historial.map((reserva) => (
              <ReservaCard key={reserva.id} reserva={reserva} compacta />
            ))}
          </div>
        </Card>
      )}

      {/* ------------------------------------------- CONFIRMAR CANCELACIÃ“N */}
      <Modal
        abierto={Boolean(aCancelar)}
        onCerrar={() => setACancelar(null)}
        titulo="Cancelar reserva"
        descripcion="Esta acciÃ³n libera la mesa para otros clientes."
        pie={
          <ModalAcciones
            onCancelar={() => setACancelar(null)}
            onConfirmar={cancelar}
            textoConfirmar="SÃ­, cancelar reserva"
            cargando={cancelando}
          />
        }
      >
        {aCancelar && (
          <div className="modal__texto">
            <p>
              Â¿ConfirmÃ¡s que querÃ©s cancelar la reserva <strong>{aCancelar.codigo}</strong> del{' '}
              {fechaRelativa(aCancelar.fecha)} a las {aCancelar.hora} para {aCancelar.personas}{' '}
              persona(s)?
            </p>
            <ErrorMessage mensaje={errorCancelar} onCerrar={() => setErrorCancelar(null)} />
            <p className="modal__nota">
              Si querÃ©s cambiar la fecha, volvÃ© al formulario de reserva y elegÃ­ un nuevo horario.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
