/**
 * Dashboard administrativo.
 * Ruta: /admin
 *
 * TODOS los indicadores se calculan en el backend con funciones SQL
 * (fn_dashboard, fn_dashboard usa COUNT / SUM / COUNT DISTINCT) y llegan ya
 * resueltos desde GET /api/estadisticas/dashboard. React no calcula ninguna
 * mÃ©trica de negocio.
 */

import { useCallback, useEffect, useState } from 'react';
import { estadisticaApi, reservaApi } from '../services/api';
import { fechaCorta, hora as horaCorta, numero, precio, sumarMinutos } from '../utils/format';
import { fechaDesplazada, hoyISO } from '../utils/validation';
import { obtenerDuracion, obtenerSlots } from '../utils/horarios';
import Button from '../components/Button';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

export default function AdminDashboard() {
  const [fecha, setFecha] = useState(hoyISO());
  const [datos, setDatos] = useState(null);
  const [reservasHoy, setReservasHoy] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [dashboard, hoy] = await Promise.all([
        estadisticaApi.dashboard({ fecha }),
        fecha === hoyISO() ? reservaApi.hoy() : Promise.resolve({ data: [] }),
      ]);
      setDatos(dashboard.data);
      setReservasHoy(hoy.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const duracion = obtenerDuracion();
  const slots = obtenerSlots();
  const esHoy = fecha === hoyISO();

  return (
    <div className="admin-dashboard">
      <header className="admin-pagina__cabecera">
        <div>
          <h1 className="admin-pagina__titulo">Dashboard</h1>
          <p className="admin-pagina__bajada">
            {esHoy ? 'Resumen de la jornada de hoy' : `Resumen del ${fechaCorta(fecha)}`}
          </p>
        </div>

        <div className="admin-dashboard__controles">
          <label className="admin-dashboard__fecha">
            <span>Fecha</span>
            <input
              type="date"
              className="campo__control"
              value={fecha}
              max={fechaDesplazada(90)}
              onChange={(e) => setFecha(e.target.value || hoyISO())}
            />
          </label>
          <Button variante="secundario" onClick={cargar} disabled={cargando}>
            Actualizar
          </Button>
        </div>
      </header>

      <ErrorMessage mensaje={error} titulo="No pudimos cargar el dashboard" onReintentar={cargar} />

      {/* ------------------------------------------------------ MÃ‰TRICAS */}
      <div className="admin-dashboard__metricas">
        <StatCard
          cargando={cargando}
          etiqueta="Reservas del dÃ­a"
          valor={numero(datos?.reservasHoy)}
          detalle={`${datos?.personasAtendidas ?? 0} personas`}
          icono="ðŸ—“ï¸"
          tono="primario"
        />
        <StatCard
          cargando={cargando}
          etiqueta="Mesas ocupadas"
          valor={numero(datos?.mesasOcupadas)}
          detalle={`${datos?.ocupacion ?? 0}% de ocupaciÃ³n`}
          icono="ðŸª‘"
          tono="exito"
        />
        <StatCard
          cargando={cargando}
          etiqueta="Mesas disponibles"
          valor={numero(datos?.mesasDisponibles)}
          detalle={`${datos?.mesasTotales ?? 0} en total Â· ${datos?.mesasMantenimiento ?? 0} en mantenimiento`}
          icono="âœ…"
        />
        <StatCard
          cargando={cargando}
          etiqueta="Clientes registrados"
          valor={numero(datos?.clientesRegistrados)}
          detalle={`${numero(datos?.pedidosDia)} pedidos hoy`}
          icono="ðŸ‘¥"
        />
        <StatCard
          cargando={cargando}
          etiqueta="FacturaciÃ³n del dÃ­a"
          valor={precio(datos?.facturacionDia)}
          detalle={`Ticket promedio ${precio(datos?.facturacionDia / (datos?.pedidosDia || 1))}`}
          icono="ðŸ’°"
          tono="primario"
        />
      </div>

      <div className="admin-dashboard__columnas">
        {/* ------------------------------------------------- PRÃ“XIMAS */}
        <Card
          titulo="PrÃ³ximas reservas"
          subtitulo="Las mÃ¡s cercanas en el tiempo"
          acciones={<Button a="/admin/reservas" variante="fantasma" tamano="pequeno">Ver todas</Button>}
        >
          {cargando && <Loading texto="Cargando..." />}

          {!cargando && (datos?.proximasReservas?.length ?? 0) === 0 && (
            <EmptyState icono="ðŸ“­" titulo="No hay reservas prÃ³ximas" descripcion="Todo tranquilo por ahora." />
          )}

          {!cargando && datos?.proximasReservas?.length > 0 && (
            <ul className="admin-dashboard__proximas">
              {datos.proximasReservas.map((reserva) => (
                <li key={reserva.id} className="admin-dashboard__proxima">
                  <div className="admin-dashboard__proxima-hora">
                    <strong>{horaCorta(reserva.hora)}</strong>
                    <span>{fechaCorta(reserva.fecha)}</span>
                  </div>
                  <div className="admin-dashboard__proxima-info">
                    <strong>
                      Mesa {reserva.mesa.numero} Â· {reserva.cliente.nombreCompleto}
                    </strong>
                    <span>
                      {reserva.personas} personas Â· {reserva.codigo}
                    </span>
                  </div>
                  <StatusBadge estado={reserva.estado} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ------------------------------------------------ SALÃ“N HOY */}
        <Card
          titulo="Reservas del dÃ­a"
          subtitulo={esHoy ? `${reservasHoy.length} reserva(s) para hoy` : 'SeleccionÃ¡ la fecha de hoy para verlas'}
        >
          {cargando && <Loading texto="Cargando..." />}

          {!cargando && reservasHoy.length === 0 && (
            <EmptyState
              icono="ðŸ•"
              titulo={esHoy ? 'TodavÃ­a no hay reservas para hoy' : 'SÃ³lo se listan las reservas de hoy'}
              descripcion={esHoy ? 'Cuando entren reservas aparecerÃ¡n en esta lista.' : 'UsÃ¡ el selector de fecha del dashboard.'}
            />
          )}

          {!cargando && reservasHoy.length > 0 && (
            <div className="tabla__contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Mesa</th>
                    <th>Cliente</th>
                    <th>Pers.</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reservasHoy.map((reserva) => (
                    <tr key={reserva.id}>
                      <td data-label="Hora">
                        {horaCorta(reserva.hora)}
                        <span className="tabla__nota">{horaCorta(sumarMinutos(reserva.hora, duracion))}</span>
                      </td>
                      <td data-label="Mesa">N.Âº {reserva.mesa.numero}</td>
                      <td data-label="Cliente">{reserva.cliente.nombreCompleto}</td>
                      <td data-label="Pers.">{reserva.personas}</td>
                      <td data-label="Estado">
                        <StatusBadge estado={reserva.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!cargando && (
            <p className="admin-dashboard__nota">
              Turnos de atenciÃ³n: {slots.map(horaCorta).join(' Â· ')} ({duracion} min por reserva).
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
