-- ============================================================================
--  database/legacy_backup.sql
--
--  Respaldo del esquema y los datos que existían en el proyecto Supabase
--  `adminbar` ANTES de aplicar `database/schema.sql`.
--
--  CONTEXTO
--  Encontramos 6 tablas de una iteración anterior de este mismo proyecto con
--  un diseño incompatible con el código actual:
--
--    - `clientes.id` era UUID y no bigserial, y el vinculo con la cuenta se
--      llamaba `user_id` en lugar de `usuario_id`.
--    - `reservas` no tenía la columna `codigo`, de la que depende todo el
--      flujo de reserva (es el "número de reserva" que ve el cliente).
--    - No existían `pedidos` ni `detalle_pedido` (la facturación).
--    - No había triggers, ni vistas, ni funciones SQL, ni RLS.
--
--  Los datos eran de prueba (2 clientes, 2 reservas) y se regeneran con
--  `database/seed.sql`, pero se conservan acá para trazabilidad.
--
--  IMPORTANTE SOBRE LAS CUENTAS
--  Las 3 filas de `usuarios` se reinstate después de aplicar schema.sql
--  conservando el MISMO id, para no romper el vínculo con auth.users y no
--  obligar a los usuarios a registrarse otra vez.
-- ============================================================================

-- ============================================================================
--  ESTRUCTURA ORIGINAL
-- ============================================================================
-- usuarios    (id uuid PK, nombre varchar(100), email varchar(255) UNIQUE,
--              rol varchar(20) CHECK IN (admin,cliente), created_at)
-- categorias  (id integer PK, nombre varchar(100) UNIQUE, descripcion text)
-- clientes    (id uuid PK, user_id uuid UNIQUE FK, nombre, apellido,
--              email varchar(255) UNIQUE, telefono varchar(20), created_at)
-- mesas       (id integer PK, numero integer UNIQUE, capacidad integer
--              CHECK > 0, ubicacion varchar(50), estado varchar(20)
--              CHECK IN (disponible,mantenimiento), created_at)
-- platos     (id integer PK, categoria_id integer FK, nombre varchar(200),
--              descripcion text, precio numeric(10,2) CHECK >= 0,
--              imagen_url text, disponible boolean, created_at)
-- reservas    (id integer PK, cliente_id uuid FK, mesa_id integer FK,
--              fecha date, hora time, personas integer CHECK > 0,
--              estado varchar(20) CHECK IN (...), observaciones, created_at)


-- ============================================================================
--  DATOS ORIGINALES
-- ============================================================================

-- usuarios  (los ids se conservan: son los mismos de auth.users)
INSERT INTO public.usuarios (id, nombre, email, rol, created_at) VALUES
  ('a725ecbb-7f58-4c6e-b4cf-9bd53a5e5438', 'Admin',     'admin@restaurante.com', 'admin',   '2026-09-08T03:44:39.17901+00:00'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Juan Pérez',  'juan@example.com',    'cliente', '2026-09-08T03:44:39.17901+00:00'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'María López', 'maria@example.com',  'cliente', '2026-09-08T03:44:39.17901+00:00');

-- categorias
INSERT INTO public.categorias (id, nombre, descripcion) VALUES
  (1, 'Entradas',    'Platos para empezar'),
  (2, 'Principales', 'Platos fuertes'),
  (3, 'Bebidas',     'Bebidas y refrescos'),
  (4, 'Postres',     'Dulces finales');

-- clientes
INSERT INTO public.clientes (id, user_id, nombre, apellido, email, telefono, created_at) VALUES
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Juan',  'Pérez', 'juan@example.com',  '123456789', '2026-09-08T03:44:39.17901+00:00'),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'María', 'López', 'maria@example.com', '987654321', '2026-09-08T03:44:39.17901+00:00');

-- mesas
INSERT INTO public.mesas (id, numero, capacidad, ubicacion, estado, created_at) VALUES
  (1,  1, 2, 'interior', 'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (2,  2, 2, 'interior', 'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (3,  3, 4, 'interior', 'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (4,  4, 4, 'terraza',  'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (5,  5, 4, 'terraza',  'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (6,  6, 6, 'ventana',  'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (7,  7, 6, 'ventana',  'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (8,  8, 8, 'interior', 'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (9,  9, 2, 'terraza',  'disponible', '2026-09-08T03:44:39.17901+00:00'),
  (10, 10, 4, 'interior', 'disponible', '2026-09-08T03:44:39.17901+00:00');

-- platos
INSERT INTO public.platos (id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, created_at) VALUES
  (1,  1, 'Empanadas',        'Empanadas de carne y pollo',        8.50, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (2,  1, 'Bruschettas',      'Pan tostado con tomate y albahaca',  7.00, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (3,  1, 'Papas rústicas',   'Papas con romero y sal gruesa',      6.50, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (4,  2, 'Pizza Margarita',  'Mozzarella, tomate y albahaca',     12.00, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (5,  2, 'Hamburguesa Clásica','Carne, queso, lechuga y tomate',  11.50, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (6,  2, 'Pasta al Pesto',   'Fettuccine con pesto y piñones',    13.00, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (7,  2, 'Pollo grillado',   'Pollo a la parrilla con ensalada',  14.50, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (8,  3, 'Agua mineral',     'Agua con gas o sin gas',             2.00, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (9,  3, 'Gaseosa',          'Bebida cola',                       2.50, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (10, 3, 'Limonada',         'Limonada natural',                  3.00, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (11, 4, 'Flan',             'Flan casero con caramelo',           5.00, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00'),
  (12, 4, 'Tiramisú',         'Postre italiano con café',           6.50, 'https://via.placeholder.com/150', true, '2026-09-08T03:44:39.17901+00:00');

-- reservas
INSERT INTO public.reservas (id, cliente_id, mesa_id, fecha, hora, personas, estado, observaciones, created_at) VALUES
  (1, 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 3, '2026-09-09', TIME '20:00', 4, 'confirmada', 'Mesa cerca de la ventana', '2026-09-08T03:44:39.17901+00:00'),
  (2, 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 5, '2026-09-10', TIME '21:30', 2, 'pendiente',  'Aniversario',               '2026-09-08T03:44:39.17901+00:00');
