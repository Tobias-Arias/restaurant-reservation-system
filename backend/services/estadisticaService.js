/**
 * Servicio de estadísticas.
 *
 * IMPORTANTE: el dashboard NO calcula nada en React. Todas las métricas se
 * resuelven en PostgreSQL mediante funciones SQL (COUNT, SUM, AVG, GROUP BY,
 * HAVING, JOIN, subconsultas) definidas en database/schema.sql y documentadas
 * en database/queries.sql. Aquí sólo se invocan y se adapta el formato.
 */

const db = require('../database/supabase');
const HttpError = require('../utils/HttpError');
const { validarFecha, validarEntero, hoyISO } = require('../utils/validators');
const { obtenerSlotsValidos } = require('../config/horarios');
const { normalizarHora } = require('./mesaService');

/** Rango por defecto de los informes: los últimos 30 días. */
function rangoPorDefecto(desde, hasta) {
  const fin = hasta ?? hoyISO();
  const inicio = desde ?? desplazarDias(fin, -30);
  return { desde: inicio, hasta: fin };
}

function desplazarDias(iso, dias) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return fecha.toISOString().slice(0, 10);
}

function validarRango(desde, hasta) {
  const { desde: inicio, hasta: fin } = rangoPorDefecto(desde, hasta);
  const fechaDesde = validarFecha(inicio, 'desde', { permitirPasado: true });
  const fechaHasta = validarFecha(fin, 'hasta', { permitirPasado: true });

  if (fechaDesde > fechaHasta) {
    throw HttpError.badRequest('La fecha "desde" no puede ser posterior a la fecha "hasta".');
  }
  if (desplazarDias(fechaDesde, 366) < fechaHasta) {
    throw HttpError.badRequest('El rango solicitado es demasiado amplio (máximo 1 año).');
  }

  return { desde: fechaDesde, hasta: fechaHasta };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** GET /api/estadisticas/dashboard?fecha= */
async function dashboard({ fecha } = {}) {
  const fechaDashboard = validarFecha(fecha ?? hoyISO(), 'fecha', { permitirPasado: true });

  const [resumen, proximas] = await Promise.all([
    db.ejecutar(() => db.admin.rpc('fn_dashboard', { p_fecha: fechaDashboard })),
    require('./reservaService').proximas(8),
  ]);

  const d = resumen || {};

  return {
    fecha: fechaDashboard,
    reservasHoy: Number(d.reservas_hoy ?? 0),
    mesasOcupadas: Number(d.mesas_ocupadas ?? 0),
    mesasTotales: Number(d.mesas_totales ?? 0),
    mesasDisponibles: Number(d.mesas_disponibles ?? 0),
    mesasMantenimiento: Number(d.mesas_mantenimiento ?? 0),
    clientesRegistrados: Number(d.clientes_registrados ?? 0),
    personasAtendidas: Number(d.personas_atendidas ?? 0),
    facturacionDia: Number(d.facturacion_dia ?? 0),
    pedidosDia: Number(d.pedidos_dia ?? 0),
    ocupacion: Number(d.mesas_totales ?? 0) > 0
      ? Math.round(((d.mesas_ocupadas ?? 0) / d.mesas_totales) * 100)
      : 0,
    proximasReservas: proximas,
  };
}

// ---------------------------------------------------------------------------
// Informes
// ---------------------------------------------------------------------------

/** GET /api/estadisticas/reservas?desde=&hasta= */
async function reservas({ desde, hasta } = {}) {
  const { desde: fechaDesde, hasta: fechaHasta } = validarRango(desde, hasta);

  const [porDia, porEstado, porMes, horarios] = await Promise.all([
    db.ejecutar(() =>
      db.admin.rpc('fn_reservas_por_dia', { p_desde: fechaDesde, p_hasta: fechaHasta })
    ),
    db.ejecutar(() =>
      db.admin.rpc('fn_reservas_por_estado', { p_desde: fechaDesde, p_hasta: fechaHasta })
    ),
    db.ejecutar(() =>
      db.admin.rpc('fn_reservas_por_mes', { p_desde: fechaDesde, p_hasta: fechaHasta })
    ),
    db.ejecutar(() =>
      db.admin.rpc('fn_horarios_mas_demandados', { p_desde: fechaDesde, p_hasta: fechaHasta })
    ),
  ]);

  const slotsValidos = new Set(obtenerSlotsValidos());

  return {
    rango: { desde: fechaDesde, hasta: fechaHasta },
    porDia: (porDia || []).map((fila) => ({
      dia: fila.dia,
      total: Number(fila.total),
      pendientes: Number(fila.pendientes),
      confirmadas: Number(fila.confirmadas),
      canceladas: Number(fila.canceladas),
      completadas: Number(fila.completadas),
      personas: Number(fila.personas),
      promedioPersonas: Number(fila.promedio_personas ?? 0),
    })),
    porEstado: (porEstado || []).map((fila) => ({
      estado: fila.estado,
      total: Number(fila.total),
      porcentaje: Number(fila.porcentaje ?? 0),
    })),
    porMes: (porMes || []).map((fila) => ({
      mes: fila.mes,
      anio: Number(fila.anio),
      total: Number(fila.total),
      personas: Number(fila.personas),
      facturacion: Number(fila.facturacion ?? 0),
    })),
    horarios: (horarios || []).map((fila) => ({
      hora: normalizarHora(fila.hora),
      reservas: Number(fila.reservas),
      personas: Number(fila.personas),
      promedioPersonas: Number(fila.promedio_personas ?? 0),
      dentroDeHorario: slotsValidos.has(normalizarHora(fila.hora)),
    })),
  };
}

/** GET /api/estadisticas/mesas?desde=&hasta= */
async function mesas({ desde, hasta } = {}) {
  const { desde: fechaDesde, hasta: fechaHasta } = validarRango(desde, hasta);

  const utilization = await db.ejecutar(() =>
    db.admin.rpc('fn_mesas_mas_utilizadas', { p_desde: fechaDesde, p_hasta: fechaHasta })
  );

  const inventario = await db.ejecutar(() =>
    db.admin.from('mesas').select('id, numero, capacidad, ubicacion, estado')
  );

  const usadas = (utilization || []).map((fila) => ({
    mesaId: Number(fila.mesa_id),
    numero: Number(fila.mesa_numero),
    capacidad: Number(fila.capacidad),
    ubicacion: fila.ubicacion,
    veces: Number(fila.veces),
    personas: Number(fila.personas),
    porcentaje: Number(fila.porcentaje ?? 0),
  }));

  const idAMasUsada = new Map(usadas.map((u) => [u.mesaId, u.veces]));

  return {
    rango: { desde: fechaDesde, hasta: fechaHasta },
    masUtilizadas: usadas,
    sinUso: inventario
      .filter((mesa) => !idAMasUsada.has(Number(mesa.id)))
      .map((mesa) => ({
        mesaId: Number(mesa.id),
        numero: Number(mesa.numero),
        capacidad: Number(mesa.capacidad),
        ubicacion: mesa.ubicacion,
        estado: mesa.estado,
      })),
    totalMesas: inventario.length,
    totalDisponibles: inventario.filter((m) => m.estado === 'disponible').length,
  };
}

/** GET /api/estadisticas/clientes?desde=&hasta=&limite= */
async function clientes({ desde, hasta, limite = 10 } = {}) {
  const { desde: fechaDesde, hasta: fechaHasta } = validarRango(desde, hasta);
  const limiteNum = validarEntero(limite ?? 10, 'limite', { min: 1, max: 50 });

  const [resumen, top] = await Promise.all([
    db.ejecutar(() =>
      db.admin.rpc('fn_clientes_atendidos', { p_desde: fechaDesde, p_hasta: fechaHasta })
    ),
    db.ejecutar(() =>
      db.admin.rpc('fn_clientes_top', {
        p_desde: fechaDesde,
        p_hasta: fechaHasta,
        p_limite: limiteNum,
      })
    ),
  ]);

  const r = resumen || {};

  return {
    rango: { desde: fechaDesde, hasta: fechaHasta },
    totalClientes: Number(r.total_clientes ?? 0),
    clientesAtendidos: Number(r.clientes_atendidos ?? 0),
    personasAtendidas: Number(r.personas_atendidas ?? 0),
    promedioPersonas: Number(r.promedio_personas ?? 0),
    tasaRecurrencia:
      Number(r.total_clientes ?? 0) > 0
        ? Math.round((Number(r.clientes_atendidos ?? 0) / r.total_clientes) * 100)
        : 0,
    top: (top || []).map((fila) => ({
      clienteId: Number(fila.cliente_id),
      nombre: fila.nombre,
      apellido: fila.apellido,
      nombreCompleto: `${fila.nombre} ${fila.apellido}`.trim(),
      email: fila.email,
      telefono: fila.telefono,
      reservas: Number(fila.reservas),
      visitas: Number(fila.visitas),
      gasto: Number(fila.gasto ?? 0),
    })),
  };
}

/** GET /api/estadisticas/ventas?desde=&hasta=&anio= */
async function ventas({ desde, hasta, anio } = {}) {
  const { desde: fechaDesde, hasta: fechaHasta } = validarRango(desde, hasta);
  const anioNum = validarEntero(anio ?? new Date().getFullYear(), 'anio', {
    min: 2000,
    max: 2100,
  });

  const [resumen, porMes, platos] = await Promise.all([
    db.ejecutar(() => db.admin.rpc('fn_ventas', { p_desde: fechaDesde, p_hasta: fechaHasta })),
    db.ejecutar(() => db.admin.rpc('fn_ventas_por_mes', { p_anio: anioNum })),
    db.ejecutar(() =>
      db.admin.rpc('fn_platos_mas_vendidos', {
        p_desde: fechaDesde,
        p_hasta: fechaHasta,
        p_limite: 10,
      })
    ),
  ]);

  const r = resumen || {};

  return {
    rango: { desde: fechaDesde, hasta: fechaHasta },
    anio: anioNum,
    facturacionTotal: Number(r.total ?? 0),
    cantidadPedidos: Number(r.cantidad_pedidos ?? 0),
    ticketPromedio: Number(r.ticket_promedio ?? 0),
    porMes: (porMes || []).map((fila) => ({
      mes: fila.mes,
      total: Number(fila.total ?? 0),
      pedidos: Number(fila.pedidos ?? 0),
      ticketPromedio: Number(fila.ticket_promedio ?? 0),
    })),
    platosMasVendidos: (platos || []).map((fila) => ({
      platoId: Number(fila.plato_id),
      plato: fila.plato,
      categoria: fila.categoria,
      unidades: Number(fila.unidades),
      ingresos: Number(fila.ingresos ?? 0),
      pedidos: Number(fila.pedidos ?? 0),
    })),
    platoMasVendido: (platos || [])[0]
      ? {
          plato: platos[0].plato,
          categoria: platos[0].categoria,
          unidades: Number(platos[0].unidades),
          ingresos: Number(platos[0].ingresos ?? 0),
        }
      : null,
  };
}

/** Resumen compacto del inventario de mesas. */
function resumenInventario(mesas) {
  return {
    total: mesas.length,
    disponibles: mesas.filter((m) => m.estado === 'disponible').length,
    mantenimiento: mesas.filter((m) => m.estado === 'mantenimiento').length,
    capacidadTotal: mesas
      .filter((m) => m.estado === 'disponible')
      .reduce((suma, m) => suma + Number(m.capacidad), 0),
  };
}

module.exports = { dashboard, reservas, mesas, clientes, ventas, validarRango, resumenInventario };
