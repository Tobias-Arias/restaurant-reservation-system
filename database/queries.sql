-- ============================================================================
--  SISTEMA DE GESTIÓN DE RESERVAS DE RESTAURANTE
--  Archivo : database/queries.sql
--  Documentación de las consultas SQL más importantes del sistema.
--
--  Estas consultas NO se ejecutan desde React. Sirven para:
--    1. Documentar el modelo de datos y la lógica de negocio en SQL puro.
--    2. Verificar los resultados que devuelve la API REST.
--    3. Demostrar el uso de SELECT / FROM / WHERE / JOIN / LEFT JOIN /
--       GROUP BY / HAVING / ORDER BY / COUNT / SUM / AVG / subconsultas.
--
--  Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================================


-- ###########################################################################
--  1. OBTENER RESERVAS DE UN DÍA
--  Flujo real: GET /api/reservas/hoy  ->  reservaService.listar()
--  JOIN de tres tablas + filtro por estado activo.
-- ###########################################################################
SELECT
  r.id,
  r.codigo            AS numero_reserva,
  r.hora,
  r.personas,
  r.estado,
  r.observaciones,
  c.id                AS cliente_id,
  c.nombre            AS cliente_nombre,
  c.apellido          AS cliente_apellido,
  c.email             AS cliente_email,
  c.telefono          AS cliente_telefono,
  m.id                AS mesa_id,
  m.numero            AS mesa_numero,
  m.capacidad         AS mesa_capacidad,
  m.ubicacion         AS mesa_ubicacion
FROM public.reservas r
INNER JOIN public.clientes c ON c.id = r.cliente_id
INNER JOIN public.mesas    m ON m.id = r.mesa_id
WHERE r.fecha = CURRENT_DATE
  AND r.estado <> 'cancelada'
ORDER BY r.hora ASC, m.numero ASC;


-- ###########################################################################
--  1.b OBTENER RESERVAS DE UN DÍA CON SU FACTURACIÓN
--  LEFT JOIN para no perder reservas que todavía no tienen pedido.
--  Flujo real: GET /api/estadisticas/dashboard
-- ###########################################################################
SELECT
  r.id,
  r.codigo,
  r.hora,
  r.personas,
  r.estado,
  m.numero AS mesa,
  c.nombre || ' ' || c.apellido AS cliente,
  COALESCE(p.total, 0) AS facturado,
  p.estado  AS estado_pedido
FROM public.reservas r
INNER JOIN      public.mesas    m ON m.id = r.mesa_id
INNER JOIN      public.clientes c ON c.id = r.cliente_id
LEFT JOIN       public.pedidos  p ON p.reserva_id = r.id
WHERE r.fecha = CURRENT_DATE
ORDER BY r.hora;


-- ###########################################################################
--  2. OBTENER MESAS DISPONIBLES
--  REGLA CENTRAL: una mesa no puede tener dos reservas superpuestas.
--  Cada reserva ocupa 90 minutos (fn_duracion_reserva()).
--  El operador OVERLAPS resuelve la condición de solapamiento.
--  Flujo real: GET /api/mesas/disponibles  ->  mesaService.listarDisponibles()
-- ###########################################################################
SELECT
  m.id,
  m.numero,
  m.capacidad,
  m.ubicacion
FROM public.mesas m
WHERE m.estado = 'disponible'
  AND m.capacidad >= 4                 -- :personas
  AND NOT EXISTS (
    SELECT 1
    FROM public.reservas r
    WHERE r.mesa_id = m.id
      AND r.fecha   = '2026-09-15'     -- :fecha
      AND r.estado IN ('pendiente', 'confirmada')
      AND (r.hora, r.hora + INTERVAL '90 minutes')
          OVERLAPS (TIME '21:00', TIME '21:00' + INTERVAL '90 minutes')
  )
ORDER BY m.capacidad ASC, m.numero ASC;


-- ###########################################################################
--  2.b MESAS DISPONIBLES CON SU PRÓXIMA RESERVA LIBRE
--  LATERAL + LEFT JOIN: muestra a qué hora se libera cada mesa.
-- ###########################################################################
SELECT
  m.id,
  m.numero,
  m.capacidad,
  m.ubicacion,
  lib.hora     AS proxima_hora,
  lib.codigo  AS proximo_codigo
FROM public.mesas m
LEFT JOIN LATERAL (
  SELECT r.hora, r.codigo
  FROM public.reservas r
  WHERE r.mesa_id = m.id
    AND r.fecha   = CURRENT_DATE
    AND r.estado IN ('pendiente', 'confirmada')
  ORDER BY r.hora
  LIMIT 1
) lib ON true
WHERE m.estado = 'disponible'
ORDER BY m.capacidad, m.numero;


-- ###########################################################################
--  2.c ESTADO DEL SALÓN (mesas ocupadas y libres en una franja)
--  Flujo real: GET /api/mesas/estado-salon
-- ###########################################################################
SELECT * FROM public.fn_estado_salon(CURRENT_DATE, TIME '21:00');

-- Variante escrita a mano con LEFT JOIN + COALESCE:
SELECT
  m.id,
  m.numero,
  m.capacidad,
  m.estado AS estado_mesa,
  CASE
    WHEN r.id IS NULL THEN 'libre'
    ELSE 'ocupada'
  END AS estado_salon,
  r.codigo,
  r.hora,
  r.personas,
  c.nombre AS cliente_nombre
FROM public.mesas m
LEFT JOIN public.reservas r
       ON r.mesa_id = m.id
      AND r.fecha   = CURRENT_DATE
      AND r.estado IN ('pendiente', 'confirmada')
      AND (r.hora, r.hora + INTERVAL '90 minutes')
          OVERLAPS (TIME '21:00', TIME '21:00' + INTERVAL '90 minutes')
LEFT JOIN public.clientes c ON c.id = r.cliente_id
ORDER BY m.numero;


-- ###########################################################################
--  3. OBTENER RESERVAS DE UN CLIENTE
--  Flujo real: GET /api/clientes/:id/reservas
-- ###########################################################################
SELECT
  r.id,
  r.codigo,
  r.fecha,
  r.hora,
  r.personas,
  r.estado,
  r.observaciones,
  m.numero AS mesa_numero,
  m.ubicacion AS mesa_ubicacion
FROM public.reservas r
INNER JOIN public.mesas m ON m.id = r.mesa_id
WHERE r.cliente_id = 1                 -- :cliente_id
ORDER BY r.fecha DESC, r.hora DESC;


-- ###########################################################################
--  3.b HISTORIAL DE UN CLIENTE CON SU GASTO
--  Subconsulta correlacionada para el total por reserva.
-- ###########################################################################
SELECT
  r.id,
  r.codigo,
  r.fecha,
  r.hora,
  r.estado,
  m.numero AS mesa,
  r.personas,
  (SELECT COALESCE(SUM(pe.total), 0)
     FROM public.pedidos pe
    WHERE pe.reserva_id = r.id AND pe.estado <> 'cancelado') AS gasto
FROM public.reservas r
INNER JOIN public.mesas m ON m.id = r.mesa_id
WHERE r.cliente_id = 1
ORDER BY r.fecha DESC, r.hora DESC;


-- ###########################################################################
--  4. CANTIDAD DE RESERVAS POR DÍA
--  COUNT + COUNT FILTER + SUM + AVG + GROUP BY + HAVING
--  Flujo real: GET /api/estadisticas/reservas?desde=&hasta=
-- ###########################################################################
SELECT
  fecha                                   AS dia,
  COUNT(*)                                AS total_reservas,
  COUNT(*) FILTER (WHERE estado = 'pendiente')  AS pendientes,
  COUNT(*) FILTER (WHERE estado = 'confirmada') AS confirmadas,
  COUNT(*) FILTER (WHERE estado = 'cancelada')  AS canceladas,
  COUNT(*) FILTER (WHERE estado = 'completada') AS completadas,
  COALESCE(SUM(personas), 0)              AS personas,
  ROUND(AVG(personas)::numeric, 2)        AS promedio_personas
FROM public.reservas
WHERE fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
GROUP BY fecha
HAVING COUNT(*) > 0
ORDER BY fecha DESC;


-- ###########################################################################
--  5. MESAS MÁS UTILIZADAS
--  JOIN + GROUP BY + HAVING + subconsulta para el porcentaje.
--  Flujo real: GET /api/estadisticas/mesas
-- ###########################################################################
SELECT
  m.id,
  m.numero,
  m.capacidad,
  m.ubicacion,
  COUNT(r.id)                 AS veces_reservada,
  COALESCE(SUM(r.personas),0) AS personas_atendidas,
  ROUND(
    (COUNT(r.id) * 100.0) /
    NULLIF((SELECT COUNT(*) FROM public.reservas
             WHERE fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
               AND estado <> 'cancelada'), 0),
    2
  ) AS porcentaje_del_total
FROM public.mesas m
INNER JOIN public.reservas r ON r.mesa_id = m.id
WHERE r.fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
  AND r.estado <> 'cancelada'
GROUP BY m.id, m.numero, m.capacidad, m.ubicacion
HAVING COUNT(r.id) > 0
ORDER BY veces_reservada DESC, m.numero ASC
LIMIT 10;


-- ###########################################################################
--  6. CANTIDAD DE CLIENTES ATENDIDOS
--  COUNT(DISTINCT) + SUM + AVG
--  Flujo real: GET /api/estadisticas/clientes
-- ###########################################################################
SELECT
  (SELECT COUNT(*) FROM public.clientes)                        AS clientes_registrados,
  COUNT(DISTINCT r.cliente_id)                                 AS clientes_atendidos,
  COALESCE(SUM(r.personas), 0)                                 AS personas_atendidas,
  COALESCE(ROUND(AVG(r.personas)::numeric, 2), 0)              AS promedio_por_reserva,
  COALESCE(ROUND(AVG(m.capacidad)::numeric, 2), 0)              AS promedio_capacidad_mesa
FROM public.reservas r
INNER JOIN public.mesas m ON m.id = r.mesa_id
WHERE r.fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
  AND r.estado <> 'cancelada';


-- ###########################################################################
--  7. FACTURACIÓN TOTAL
--  SUM + AVG sobre pedidos no cancelados.
--  Flujo real: GET /api/estadisticas/ventas
-- ###########################################################################
SELECT
  COALESCE(SUM(total), 0)                    AS facturacion_total,
  COUNT(*)                                   AS cantidad_pedidos,
  COALESCE(ROUND(AVG(total)::numeric, 2), 0) AS ticket_promedio,
  COALESCE(MAX(total), 0)                    AS pedido_mayor
FROM public.pedidos
WHERE estado <> 'cancelado'
  AND created_at::date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE;


-- ###########################################################################
--  7.b FACTURACIÓN DIARIA
--  GROUP BY sobre la fecha truncada.
-- ###########################################################################
SELECT
  created_at::date                          AS dia,
  COUNT(*)                                  AS pedidos,
  SUM(total)                                AS facturado,
  ROUND(AVG(total)::numeric, 2)             AS ticket_promedio
FROM public.pedidos
WHERE estado <> 'cancelado'
  AND created_at::date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
GROUP BY created_at::date
ORDER BY dia DESC;


-- ###########################################################################
--  8. FACTURACIÓN POR MES
--  GROUP BY sobre mes y año, función to_char.
--  Flujo real: GET /api/estadisticas/ventas?anio=
-- ###########################################################################
SELECT
  TO_CHAR(created_at, 'YYYY-MM')  AS mes,
  EXTRACT(YEAR FROM created_at)   AS anio,
  COUNT(*)                        AS pedidos,
  SUM(total)                      AS facturado,
  ROUND(AVG(total)::numeric, 2)   AS ticket_promedio
FROM public.pedidos
WHERE estado <> 'cancelado'
  AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY 1, 2
ORDER BY 1 DESC;


-- ###########################################################################
--  9. PLATO MÁS VENDIDO
--  JOIN de 4 tablas + GROUP BY + HAVING + ORDER BY.
--  Flujo real: GET /api/estadisticas/ventas?platos=1
-- ###########################################################################
SELECT
  pl.id,
  pl.nombre                     AS plato,
  cat.nombre                    AS categoria,
  SUM(d.cantidad)               AS unidades_vendidas,
  SUM(d.subtotal)               AS ingresos,
  COUNT(DISTINCT d.pedido_id)   AS pedidos
FROM public.detalle_pedido d
INNER JOIN public.platos     pl  ON pl.id  = d.plato_id
INNER JOIN public.categorias cat ON cat.id = pl.categoria_id
INNER JOIN public.pedidos    pe  ON pe.id  = d.pedido_id
WHERE pe.estado <> 'cancelado'
GROUP BY pl.id, pl.nombre, cat.nombre
HAVING SUM(d.cantidad) > 0
ORDER BY unidades_vendidas DESC, ingresos DESC
LIMIT 1;


-- ###########################################################################
--  9.b TOP 10 PLATOS
-- ###########################################################################
SELECT
  pl.nombre           AS plato,
  cat.nombre          AS categoria,
  SUM(d.cantidad)     AS unidades,
  SUM(d.subtotal)     AS ingresos,
  ROUND(AVG(d.precio_unitario)::numeric, 2) AS precio_medio
FROM public.detalle_pedido d
INNER JOIN public.platos     pl  ON pl.id  = d.plato_id
INNER JOIN public.categorias cat ON cat.id = pl.categoria_id
INNER JOIN public.pedidos    pe  ON pe.id  = d.pedido_id
WHERE pe.estado <> 'cancelado'
GROUP BY pl.nombre, cat.nombre
HAVING SUM(d.cantidad) > 0
ORDER BY unidades DESC
LIMIT 10;


-- ###########################################################################
-- 10. CANTIDAD DE RESERVAS POR ESTADO
--  GROUP BY + subconsulta para el porcentaje.
--  Flujo real: GET /api/estadisticas/reservas
-- ###########################################################################
SELECT
  estado,
  COUNT(*)                     AS total,
  ROUND(
    (COUNT(*) * 100.0) /
    NULLIF((SELECT COUNT(*) FROM public.reservas
             WHERE fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE), 0),
    2
  ) AS porcentaje
FROM public.reservas
WHERE fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
GROUP BY estado
ORDER BY total DESC;


-- ###########################################################################
-- 11. CLIENTES CON MAYOR CANTIDAD DE RESERVAS
--  GROUP BY + HAVING + subconsulta de gasto + LEFT JOIN.
--  Flujo real: GET /api/estadisticas/clientes?limite=
-- ###########################################################################
SELECT
  c.id,
  c.nombre,
  c.apellido,
  c.email,
  c.telefono,
  COUNT(r.id)                                          AS total_reservas,
  COUNT(r.id) FILTER (WHERE r.estado = 'completada')   AS visitas,
  COALESCE((
    SELECT SUM(pe.total)
      FROM public.pedidos pe
     WHERE pe.cliente_id = c.id AND pe.estado <> 'cancelado'
  ), 0)                                                AS gasto_total
FROM public.clientes c
INNER JOIN public.reservas r ON r.cliente_id = c.id
WHERE r.fecha BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE
GROUP BY c.id, c.nombre, c.apellido, c.email, c.telefono
HAVING COUNT(r.id) >= 2
ORDER BY total_reservas DESC, gasto_total DESC
LIMIT 10;


-- ###########################################################################
-- 12. HORARIOS CON MAYOR CANTIDAD DE RESERVAS
--  Flujo real: GET /api/estadisticas/reservas (bloque horarios)
-- ###########################################################################
SELECT
  hora,
  COUNT(*)                              AS reservas,
  COALESCE(SUM(personas), 0)            AS personas,
  ROUND(AVG(personas)::numeric, 2)      AS promedio_personas,
  ROUND(
    (COUNT(*) * 100.0) /
    NULLIF((SELECT COUNT(*)
              FROM public.reservas
             WHERE fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
               AND estado <> 'cancelada'), 0),
    2
  ) AS porcentaje
FROM public.reservas
WHERE fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
  AND estado <> 'cancelada'
GROUP BY hora
ORDER BY reservas DESC, hora ASC;


-- ###########################################################################
-- 13. TASA DE CONVERSIÓN (reservas confirmadas vs. canceladas)
-- (window function)
-- ###########################################################################
SELECT
  fecha,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE estado = 'cancelada') AS canceladas,
  ROUND(
    100.0 - (
      (COUNT(*) FILTER (WHERE estado = 'cancelada') * 100.0) / NULLIF(COUNT(*), 0)
    ), 2
  ) AS tasa_no_cancelacion
FROM public.reservas
WHERE fecha BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
GROUP BY fecha
ORDER BY fecha DESC;


-- ###########################################################################
-- 14. MESAS QUE NUNCA SE HAN RESERVADO (LEFT JOIN ... IS NULL)
--  Útil para detectar mesas infrautilizadas o mal ubicadas.
-- ###########################################################################
SELECT
  m.id,
  m.numero,
  m.capacidad,
  m.ubicacion,
  m.estado
FROM public.mesas m
LEFT JOIN public.reservas r ON r.mesa_id = m.id
WHERE r.id IS NULL
ORDER BY m.numero;


-- ###########################################################################
-- 15. COMPROBAR QUE NO EXISTEN RESERVAS SUPERPUESTAS
--  Debe devolver 0 filas. Es el control de calidad de la regla principal.
-- ###########################################################################
SELECT
  a.id AS reserva_a,
  b.id AS reserva_b,
  a.mesa_id,
  a.fecha,
  a.hora AS hora_a,
  b.hora AS hora_b
FROM public.reservas a
INNER JOIN public.reservas b
        ON a.id < b.id
       AND a.mesa_id = b.mesa_id
       AND a.fecha   = b.fecha
       AND a.estado IN ('pendiente', 'confirmada')
       AND b.estado IN ('pendiente', 'confirmada')
       AND (a.hora, a.hora + INTERVAL '90 minutes')
           OVERLAPS (b.hora, b.hora + INTERVAL '90 minutes');


-- ###########################################################################
-- 16. PROBAR LA REGLA FUNDAMENTAL
--  El segundo INSERT debe fallar con el error 23P01 (exclusion_violation).
--  Ejecutar en una transacción y hacer ROLLBACK al terminar.
-- ###########################################################################
BEGIN;

-- Reserva base: mesa 1, hoy, 19:00, confirmada
INSERT INTO public.reservas (cliente_id, mesa_id, fecha, hora, personas, estado)
SELECT (SELECT MIN(id) FROM public.clientes), 1, CURRENT_DATE, TIME '19:00', 2, 'confirmada';

-- Esta se solapa (19:30 está dentro de 19:00-20:30) -> DEBE FALLAR
INSERT INTO public.reservas (cliente_id, mesa_id, fecha, hora, personas, estado)
SELECT (SELECT MIN(id) FROM public.clientes), 1, CURRENT_DATE, TIME '19:30', 2, 'confirmada';

-- Esta NO se solapa (21:00 empieza después de 20:30) -> DEBE FUNCIONAR
INSERT INTO public.reservas (cliente_id, mesa_id, fecha, hora, personas, estado)
SELECT (SELECT MIN(id) FROM public.clientes), 1, CURRENT_DATE, TIME '21:00', 2, 'confirmada';

ROLLBACK;
