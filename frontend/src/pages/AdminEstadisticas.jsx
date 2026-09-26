/**
 * EstadÃ­sticas (administrador).
 * Ruta: /admin/estadisticas
 *
 * Consume los cuatro informes del backend. Cada uno ejecuta funciones SQL con
 * COUNT / SUM / AVG / GROUP BY / HAVING / JOIN definidas en database/schema.sql.
 * Los grÃ¡ficos son de barras con CSS puro: sin librerÃ­as externas.
 */

import { useCallback, useEffect, useState } from 'react';
import { estadisticaApi } from '../services/api';
import { fechaDesplazada } from '../utils/validation';
import { hora as horaCorta, mesCorto, numero, precio, fechaCorta } from '../utils/format';
import Button from '../components/Button';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import Table from '../components/Table';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';

const RANGOS = [
  { valor: 7, etiqueta: 'Ãšltimos 7 dÃ­as' },
  { valor: 30, etiqueta: 'Ãšltimos 30 dÃ­as' },
  { valor: 90, etiqueta: 'Ãšltimos 90 dÃ­as' },
  { valor: 365, etiqueta: 'Ãšltimo aÃ±o' },
];

export default function AdminEstadisticas() {
  const [dias, setDias] = useState(30);
  const [informes, setInformes] = useState({ reservas: null, mesas: null, clientes: null, ventas: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const desde = fechaDesplazada(-dias);
    const hasta = fechaDesplazada(0);
    try {
      const [reservas, mesas, clientes, ventas] = await Promise.all([
        estadisticaApi.reservas({ desde, hasta }),
        estadisticaApi.mesas({ desde, hasta }),
        estadisticaApi.clientes({ desde, hasta, limite: 10 }),
        estadisticaApi.ventas({ desde, hasta }),
      ]);
      setInformes({ reservas: reservas.data, mesas: mesas.data, clientes: clientes.data, ventas: ventas.data });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [dias]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando && !informes.reservas) {
    return <Loading texto="Calculando estadÃ­sticas..." variante="esqueleto" filas={6} />;
  }

  const { reservas, mesas, clientes, ventas } = informes;

  return (
    <div className="admin-estadisticas">
      <header className="admin-pagina__cabecera">
        <div>
          <h1 className="admin-pagina__titulo">EstadÃ­sticas</h1>
          <p className="admin-pagina__bajada">
            {fechaCorta(reservas?.rango?.desde)} â€” {fechaCorta(reservas?.rango?.hasta)}
          </p>
        </div>
        <div className="admin-pagina__acciones">
          {RANGOS.map((rango) => (
            <Button
              key={rango.valor}
              variante={dias === rango.valor ? 'primario' : 'fantasma'}
              tamano="pequeno"
              onClick={() => setDias(rango.valor)}
            >
              {rango.etiqueta}
            </Button>
          ))}
        </div>
      </header>

      <ErrorMessage mensaje={error} titulo="No pudimos calcular las estadÃ­sticas" onReintentar={cargar} />

      {/* ------------------------------------------------------ RESUMEN */}
      <div className="admin-dashboard__metricas">
        <StatCard
          cargando={cargando}
          etiqueta="FacturaciÃ³n del perÃ­odo"
          valor={precio(ventas?.facturacionTotal)}
          detalle={`${numero(ventas?.cantidadPedidos)} pedidos`}
          icono="ðŸ’°"
          tono="primario"
        />
        <StatCard
          cargando={cargando}
          etiqueta="Ticket promedio"
          valor={precio(ventas?.ticketPromedio)}
          detalle={`${numero(ventas?.porMes?.length)} meses con ventas`}
          icono="ðŸ§¾"
        />
        <StatCard
          cargando={cargando}
          etiqueta="Clientes atendidos"
          valor={numero(clientes?.clientesAtendidos)}
          detalle={`${clientes?.tasaRecurrencia ?? 0}% del padrÃ³n Total`}
          icono="ðŸ‘¥"
          tono="exito"
        />
        <StatCard
          cargando={cargando}
          etiqueta="Personas atendidas"
          valor={numero(clientes?.personasAtendidas)}
          detalle={`${clientes?.promedioPersonas ?? 0} por reserva`}
          icono="ðŸ½ï¸"
        />
      </div>

      {/* --------------------------------------------- RESERVAS POR DÃA */}
      <Card titulo="Reservas por dÃ­a" subtitulo="Cantidad de reservas y personas por fecha">
        {cargando ? (
          <Loading texto="Cargando..." />
        ) : reservas?.porDia?.length === 0 ? (
          <EmptyState icono="ðŸ“Š" titulo="Sin reservas en el perÃ­odo" descripcion="ProbÃ¡ con un rango mÃ¡s amplio." />
        ) : (
          <GraficoBarras
            datos={reservas.porDia.map((fila) => ({
              etiqueta: fechaCorta(fila.dia),
              valor: fila.total,
              pie: `${fila.personas} pers.`,
            }))}
            vacio="Sin datos"
          />
        )}
      </Card>

      <div className="admin-estadisticas__columnas">
        {/* ------------------------------------------- RESERVAS POR ESTADO */}
        <Card titulo="Reservas por estado">
          {cargando ? (
            <Loading texto="Cargando..." />
          ) : (
            <ul className="lista-porcentaje">
              {reservas?.porEstado?.map((fila) => (
                <li key={fila.estado}>
                  <div className="lista-porcentaje__encabezado">
                    <span className={`badge ${CLASE_ESTADO[fila.estado] ?? 'is-neutro'}`}>{fila.estado}</span>
                    <span>
                      {numero(fila.total)} Â· {fila.porcentaje}%
                    </span>
                  </div>
                  <div className="barra">
                    <span className="barra__relleno" style={{ width: `${fila.porcentaje}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ------------------------------------------------- HORARIOS */}
        <Card titulo="Horarios mÃ¡s demandados" subtitulo="Franja con mÃ¡s reservas">
          {cargando ? (
            <Loading texto="Cargando..." />
          ) : (
            <ul className="lista-porcentaje">
              {reservas?.horarios?.slice(0, 6).map((fila) => {
                const maximo = reservas.horarios[0]?.reservas || 1;
                return (
                  <li key={fila.hora}>
                    <div className="lista-porcentaje__encabezado">
                      <span>
                        {horaCorta(fila.hora)}
                        {fila.dentroDeHorario && <span className="lista-porcentaje__ok"> âœ“</span>}
                      </span>
                      <span>
                        {numero(fila.reservas)} Â· {fila.promedioPersonas} prom.
                      </span>
                    </div>
                    <div className="barra">
                      <span
                        className="barra__relleno"
                        style={{ width: `${Math.round((fila.reservas / maximo) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ------------------------------------------- MESAS MÃS UTILIZADAS */}
      <Card titulo="Mesas mÃ¡s utilizadas" subtitulo="Ranking por cantidad de reservas">
        <Table
          columnas={[
            { clave: 'numero', titulo: 'Mesa', render: (m) => `N.Âº ${m.numero}` },
            { clave: 'capacidad', titulo: 'Capacidad', alinear: 'center', render: (m) => m.capacidad },
            { clave: 'ubicacion', titulo: 'UbicaciÃ³n', render: (m) => m.ubicacion },
            { clave: 'veces', titulo: 'Veces reservada', alinear: 'right', render: (m) => numero(m.veces) },
            { clave: 'personas', titulo: 'Personas', alinear: 'right', render: (m) => numero(m.personas) },
            {
              clave: 'porcentaje',
              titulo: '% del total',
              alinear: 'right',
              render: (m) => `${m.porcentaje}%`,
            },
          ]}
          filas={mesas?.masUtilizadas ?? []}
          cargando={cargando}
          mensajeVacio="Ninguna mesa fue reservada en el perÃ­odo."
        />
      </Card>

      {/* ------------------------------------------ FACTURACIÃ“N POR MES */}
      <div className="admin-estadisticas__columnas">
        <Card titulo={`FacturaciÃ³n por mes Â· ${ventas?.anio ?? ''}`}>
          {cargando ? (
            <Loading texto="Cargando..." />
          ) : ventas?.porMes?.length === 0 ? (
            <EmptyState icono="ðŸ’¸" titulo="Sin facturaciÃ³n registrada" descripcion="TodavÃ­a no hay pedidos en el perÃ­odo." />
          ) : (
            <GraficoBarras
              datos={ventas.porMes.map((fila) => ({
                etiqueta: mesCorto(fila.mes),
                valor: Number(fila.total),
                pie: `${numero(fila.pedidos)} pedidos`,
                formato: 'moneda',
              }))}
              vacio="Sin datos"
            />
          )}
        </Card>

        <Card titulo="Plato mÃ¡s solicitado">
          {!ventas?.platoMasVendido ? (
            <EmptyState icono="ðŸ´" titulo="Sin ventas registradas" descripcion="TodavÃ­a no hay detalle de pedidos." />
          ) : (
            <div className="plato-destacado">
              <p className="plato-destacado__nombre">{ventas.platoMasVendido.plato}</p>
              <p className="plato-destacado__categoria">{ventas.platoMasVendido.categoria}</p>
              <div className="plato-destacado__datos">
                <div>
                  <span>Unidades</span>
                  <strong>{numero(ventas.platoMasVendido.unidades)}</strong>
                </div>
                <div>
                  <span>Ingresos</span>
                  <strong>{precio(ventas.platoMasVendido.ingresos)}</strong>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------- TOP PLATOS */}
      <Card titulo="Top 10 platos" subtitulo="Por unidades vendidas">
        <Table
          columnas={[
            { clave: 'plato', titulo: 'Plato', render: (p) => p.plato },
            { clave: 'categoria', titulo: 'CategorÃ­a', render: (p) => p.categoria },
            { clave: 'unidades', titulo: 'Unidades', alinear: 'right', render: (p) => numero(p.unidades) },
            { clave: 'pedidos', titulo: 'Pedidos', alinear: 'right', render: (p) => numero(p.pedidos) },
            { clave: 'ingresos', titulo: 'Ingresos', alinear: 'right', render: (p) => precio(p.ingresos) },
          ]}
          filas={ventas?.platosMasVendidos ?? []}
          cargando={cargando}
          mensajeVacio="TodavÃ­a no hay ventas de platos."
        />
      </Card>

      {/* ------------------------------------------- CLIENTES FRECUENTES */}
      <Card titulo="Clientes con mÃ¡s reservas" subtitulo="Fidelidad y consumo">
        <Table
          columnas={[
            { clave: 'cliente', titulo: 'Cliente', render: (c) => (
              <div className="tabla__principal">
                <strong>{c.nombreCompleto}</strong>
                <span className="tabla__nota">{c.email}</span>
              </div>
            ) },
            { clave: 'reservas', titulo: 'Reservas', alinear: 'right', render: (c) => numero(c.reservas) },
            { clave: 'visitas', titulo: 'Visitas', alinear: 'right', render: (c) => numero(c.visitas) },
            { clave: 'gasto', titulo: 'Gasto total', alinear: 'right', render: (c) => precio(c.gasto) },
          ]}
          filas={clientes?.top ?? []}
          cargando={cargando}
          mensajeVacio="Sin reservas en el perÃ­odo."
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes locales
// ---------------------------------------------------------------------------

/**
 * GrÃ¡fico de barras horizontal en CSS puro.
 * @param {{datos: {etiqueta: string, valor: number, pie?: string, formato?: string}[]}} props
 */
function GraficoBarras({ datos, vacio }) {
  if (!datos || datos.length === 0) {
    return <EmptyState icono="ðŸ“‰" titulo={vacio ?? 'Sin datos'} descripcion="No hay informaciÃ³n para el perÃ­odo elegido." />;
  }

  const maximo = Math.max(...datos.map((d) => Number(d.valor) || 0), 1);

  return (
    <ul className="grafico">
      {datos.map((dato) => (
        <li key={dato.etiqueta} className="grafico__fila">
          <span className="grafico__etiqueta" title={dato.etiqueta}>
            {dato.etiqueta}
          </span>
          <div className="barra">
            <span
              className="barra__relleno"
              style={{ width: `${Math.max((Number(dato.valor) / maximo) * 100, 1)}%` }}
            />
          </div>
          <span className="grafico__valor">
            {dato.formato === 'moneda' ? precio(dato.valor) : numero(dato.valor)}
            {dato.pie && <small>{dato.pie}</small>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const CLASE_ESTADO = {
  pendiente: 'is-pendiente',
  confirmada: 'is-confirmada',
  cancelada: 'is-cancelada',
  completada: 'is-completada',
};
