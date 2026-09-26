-- ============================================================================
--  SISTEMA DE GESTIÓN DE RESERVAS DE RESTAURANTE
--  Archivo : database/seed.sql
--  Motor   : PostgreSQL 15+ (Supabase)
--  Uso     : Supabase Dashboard > SQL Editor > New query > Ejecutar
--            (EJECUTAR DESPUÉS de schema.sql)
--
--  Escribe datos de prueba realistas. Es idempotente gracias al uso de
--  ON CONFLICT: puedes ejecutarlo varias veces sin duplicar registros.
-- ============================================================================


-- ============================================================================
-- 1. MESAS (10 mesas)
-- ============================================================================
INSERT INTO public.mesas (numero, capacidad, ubicacion, estado) VALUES
  (1,  2, 'ventana',  'disponible'),
  (2,  2, 'ventana',  'disponible'),
  (3,  4, 'interior', 'disponible'),
  (4,  4, 'interior', 'disponible'),
  (5,  4, 'terraza',  'disponible'),
  (6,  6, 'interior', 'disponible'),
  (7,  6, 'terraza',  'disponible'),
  (8,  8, 'privada',  'disponible'),
  (9,  2, 'barra',    'disponible'),
  (10, 4, 'interior', 'disponible')
ON CONFLICT (numero) DO UPDATE
  SET capacidad = EXCLUDED.capacidad,
      ubicacion = EXCLUDED.ubicacion;


-- ============================================================================
-- 2. CATEGORÍAS DEL MENÚ
-- ============================================================================
INSERT INTO public.categorias (nombre, descripcion) VALUES
  ('Entradas',    'Para empezar a compartir antes del plato principal.'),
  ('Principales', 'Platos de la casa elaboration a la parrilla y horno de leña.'),
  ('Bebidas',     'Refrescos, jugos naturales y bebidasSin alcohol.'),
  ('Postres',     'Final dulce elaborado en la pastelería de la casa.')
ON CONFLICT (nombre) DO UPDATE
  SET descripcion = EXCLUDED.descripcion;


-- ============================================================================
-- 3. PLATOS (16 platos)
-- ============================================================================
INSERT INTO public.platos (categoria_id, nombre, descripcion, precio, imagen_url, disponible)
SELECT c.id, v.nombre, v.descripcion, v.precio, v.imagen_url, v.disponible
FROM (VALUES
  ('Entradas',    'Empanadas',      'Seis empanadas de carne mecanida al horno con chimichurri.',            12.50,  '/img/platos/empanadas.jpg',      true),
  ('Entradas',    'Bruschettas',    'Pan de masa madre con tomate, albahaca y aceite de oliva.',             11.00,  '/img/platos/bruschettas.jpg',    true),
  ('Entradas',    'Papas rusticas', 'Papas con piel, romero y alioli de ajo artesano.',                     13.00,  '/img/platos/papas.jpg',          true),
  ('Entradas',    'Croquetas',      'Seis croquetas de jamon y queso crema con bechamel.',                   14.50,  '/img/platos/croquetas.jpg',      true),

  ('Principales', 'Pizza',          'Masa fermentada 48 h, tomate San Marzano, mozzarella y albahaca.',       28.00,  '/img/platos/pizza.jpg',          true),
  ('Principales', 'Hamburguesa',    'Res 150 g, queso cheddar, lechuga, tomate y salsa de la casa.',          26.50,  '/img/platos/hamburguesa.jpg',    true),
  ('Principales', 'Pasta',          'Tagliatelle a la boloñesa con carne picada y parmesano.',                24.00,  '/img/platos/pasta.jpg',          true),
  ('Principales', 'Pollo grillado', 'Medio pollo a la parrilla con verduras asadas y pommes frites.',       27.00,  '/img/platos/pollo.jpg',          true),
  ('Principales', 'Bife de chorizo','Bife madurado a la parrilla con guarnicion a elegir.',                  42.00,  '/img/platos/bife.jpg',           true),
  ('Principales', 'Pescado del dia','Pescado fresco del dia con guarnicion y limonada de la casa.',          38.00,  '/img/platos/pescado.jpg',        false),

  ('Bebidas',     'Agua',           'Agua mineral sin gas 500 ml.',                                         3.50,   '/img/platos/agua.jpg',           true),
  ('Bebidas',     'Gaseosa',        'Gaseosa de cola 400 ml.',                                              5.00,   '/img/platos/gaseosa.jpg',        true),
  ('Bebidas',     'Limonada',       'Limonada de la casa con menta fresca y hielo.',                        7.00,   '/img/platos/limonada.jpg',       true),
  ('Bebidas',     'Jugo natural',   'Jugo prensado de naranja 400 ml.',                                     6.50,   '/img/platos/jugo.jpg',           true),

  ('Postres',     'Flan',           'Flan casero con dulce de leche y crema batida.',                         8.50,   '/img/platos/flan.jpg',           true),
  ('Postres',     'Tiramisu',       'Tiramisu clasico con cafe espresso y mascarpone.',                      10.00,  '/img/platos/tiramisu.jpg',       true),
  ('Postres',     'Brownie',        'Brownie tibio con helado de vainilla y salsa de chocolate.',           11.50,  '/img/platos/brownie.jpg',        true)
) AS v(categoria, nombre, descripcion, precio, imagen_url, disponible)
JOIN public.categorias c ON c.nombre = v.categoria
ON CONFLICT (categoria_id, lower(nombre)) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      precio      = EXCLUDED.precio,
      imagen_url  = EXCLUDED.imagen_url,
      disponible  = EXCLUDED.disponible;


-- ============================================================================
-- 4. USUARIOS Y CLIENTES DE PRUEBA
--    Las contraseñas NO se definen aquí: Supabase Auth las gestiona.
--    Tras registrarte en la app, ejecuta database/promote_admin.sql para
--    convertir una cuenta en administrador.
--
--    Los clientes de abajo se crean sin cuenta asociada (usuario_id NULL):
--    sirven para reservas hechas como invitado.
-- ============================================================================
INSERT INTO public.clientes (nombre, apellido, email, telefono) VALUES
  ('Laura',  'Gomez',   'laura.gomez@correo.com',   '+54 11 5555 1001'),
  ('Diego',  'Ramirez', 'diego.ramirez@correo.com', '+54 11 5555 1002'),
  ('Sofia',  'Martinez','sofia.martinez@correo.com','+54 11 5555 1003'),
  ('Carlos', 'Fernandez','carlos.fernandez@correo.com','+54 11 5555 1004'),
  ('Marta',  'Lopez',   'marta.lopez@correo.com',    '+54 11 5555 1005'),
  ('Javier', 'Perez',   'javier.perez@correo.com',  '+54 11 5555 1006'),
  ('Lucia',  'Sanchez', 'lucia.sanchez@correo.com',  '+54 11 5555 1007'),
  ('Andres', 'Diaz',    'andres.diaz@correo.com',    '+54 11 5555 1008')
ON CONFLICT (email) DO UPDATE
  SET nombre   = EXCLUDED.nombre,
      apellido = EXCLUDED.apellido,
      telefono = EXCLUDED.telefono;


-- ============================================================================
-- 5. RESERVAS DE PRUEBA
--    Se generan sobre la semana actual (desde hoy hasta 6 días después)
--    respetando la regla de no solapamiento: cada mesa como máximo una vez
--    por franja horaria.
-- ============================================================================
DO $$
DECLARE
  v_dia   date;
  v_base  record;
  v_creadas integer := 0;
BEGIN
  FOR i IN 0..6 LOOP
    v_dia := CURRENT_DATE + i;

    FOR v_base IN
      SELECT * FROM (VALUES
        (1,  TIME '11:00', 2),
        (1,  TIME '18:00', 2),
        (3,  TIME '12:30', 4),
        (3,  TIME '19:30', 3),
        (4,  TIME '11:00', 4),
        (4,  TIME '21:00', 4),
        (6,  TIME '13:30', 6),
        (6,  TIME '19:30', 5),
        (8,  TIME '20:00', 8),
        (10, TIME '11:00', 4),
        (10, TIME '18:00', 2)
      ) AS t(mesa, hora, personas)
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.reservas r
         WHERE r.mesa_id = v_base.mesa
           AND r.fecha   = v_dia
           AND r.estado IN ('pendiente', 'confirmada')
           AND (r.hora, r.hora + INTERVAL '90 minutes') OVERLAPS
               (v_base.hora, v_base.hora + INTERVAL '90 minutes')
      ) THEN
        INSERT INTO public.reservas (cliente_id, mesa_id, fecha, hora, personas, estado, observaciones)
        SELECT
          c.id,
          v_base.mesa,
          v_dia,
          v_base.hora,
          v_base.personas,
          -- El cast es obligatorio: un CASE de literales resuelve a text y
          -- PostgreSQL no implica la conversión text -> enum.
          (CASE
            WHEN i = 0 AND v_base.hora < TIME '15:00' THEN 'completada'
            WHEN i = 0 THEN 'confirmada'
            WHEN i = 1 THEN 'pendiente'
            ELSE 'confirmada'
          END)::public.estado_reserva,
          CASE
            WHEN v_base.hora < TIME '15:00' THEN 'Almuerzo del mediodia'
            ELSE 'Mesa para cenar, incluye opcion vegetariana.'
          END
        FROM (
          SELECT id FROM public.clientes
           ORDER BY id
           LIMIT 1 OFFSET ((v_creadas) % 8)
        ) c;

        v_creadas := v_creadas + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Reservas de prueba generadas: %', v_creadas;
END $$;


-- ============================================================================
-- 6. PEDIDOS Y FACTURACIÓN
--    Un pedido por reserva confirmada/completada, con detalle coherente.
--    Los totales se calculan siempre como SUM(cantidad * precio_unitario)
--    para que la restricción detalle_subtotal_calc_chk nunca falle.
--    El cast a enum es obligatorio (un CASE de literales resuelve a text).
-- ============================================================================
INSERT INTO public.pedidos (reserva_id, cliente_id, estado, total, created_at)
SELECT
  r.id,
  r.cliente_id,
  (CASE WHEN r.fecha < CURRENT_DATE THEN 'entregado' ELSE 'preparado' END)::public.estado_pedido,
  0, -- se recalcula abajo tras insertar el detalle
  r.created_at
FROM public.reservas r
WHERE r.estado IN ('confirmada', 'completada')
  AND NOT EXISTS (SELECT 1 FROM public.pedidos p WHERE p.reserva_id = r.id);


INSERT INTO public.detalle_pedido (pedido_id, plato_id, cantidad, precio_unitario, subtotal)
SELECT
  pe.id,
  pl.id,
  v.cantidad,
  pl.precio,
  round(v.cantidad * pl.precio, 2)
FROM public.pedidos pe
JOIN (VALUES
  ('Empanadas',      1, 2),
  ('Pizza',          1, 2),
  ('Agua',           1, 4),
  ('Bruschettas',    2, 1),
  ('Hamburguesa',    1, 2),
  ('Gaseosa',        2, 2),
  ('Papas rusticas', 1, 3),
  ('Pasta',          1, 2),
  ('Limonada',       1, 4),
  ('Pollo grillado', 1, 1),
  ('Tiramisu',       1, 2),
  ('Flan',           1, 4)
) AS v(plato_nombre, orden, cantidad) ON true
JOIN (
  SELECT DISTINCT ON (lower(nombre)) id, nombre, precio
    FROM public.platos
   ORDER BY lower(nombre), id
) pl ON pl.nombre = v.plato_nombre
WHERE (pe.id % 12) = v.orden
ON CONFLICT (pedido_id, plato_id) DO NOTHING;


-- Recalcular el total de cada pedido a partir de su detalle.
UPDATE public.pedidos pe
   SET total = COALESCE(s.total, 0)
  FROM (
    SELECT d.pedido_id, SUM(d.subtotal) AS total
      FROM public.detalle_pedido d
     GROUP BY d.pedido_id
  ) s
 WHERE s.pedido_id = pe.id
   AND pe.total <> s.total;


-- ============================================================================
-- 7. RESUMEN
-- ============================================================================
DO $$
DECLARE
  v_mesas integer;
  v_platos integer;
  v_clientes integer;
  v_reservas integer;
  v_total numeric;
BEGIN
  SELECT count(*) INTO v_mesas    FROM public.mesas;
  SELECT count(*) INTO v_platos   FROM public.platos;
  SELECT count(*) INTO v_clientes FROM public.clientes;
  SELECT count(*) INTO v_reservas FROM public.reservas;
  SELECT COALESCE(SUM(total), 0) INTO v_total FROM public.pedidos;

  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE ' Datos de prueba cargados correctamente';
  RAISE NOTICE '   Mesas ............ %', v_mesas;
  RAISE NOTICE '   Platos ........... %', v_platos;
  RAISE NOTICE '   Categorias ....... %', (SELECT count(*) FROM public.categorias);
  RAISE NOTICE '   Clientes ......... %', v_clientes;
  RAISE NOTICE '   Reservas ......... %', v_reservas;
  RAISE NOTICE '   Facturacion total  %', v_total;
  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE ' Siguiente paso: registra un usuario en /registro y ejecuta';
  RAISE NOTICE ' database/promote_admin.sql para darle el rol de administrador.';
END $$;
