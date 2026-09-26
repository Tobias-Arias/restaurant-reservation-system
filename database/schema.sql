-- ============================================================================
--  SISTEMA DE GESTIÓN DE RESERVAS DE RESTAURANTE
--  Archivo : database/schema.sql
--  Motor   : PostgreSQL 15+ (Supabase)
--  Uso     : Supabase Dashboard > SQL Editor > New query > Ejecutar
--
--  Este script es IDEMPOTENTE: puede ejecutarse varias veces sin romper nada.
--  IMPORTANTE: ejecutarlo ANTES que seed.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0.b CONTROL PREVIO DE COMPATIBILIDAD
--     Si una versión anterior del proyecto dejó tablas con el mismo nombre pero
--     tipos distintos (por ejemplo `mesas.ubicacion` como varchar en lugar del
--     enum ubicacion_mesa), los CREATE TABLE IF NOT EXISTS las ignorarían y las
--     funciones SQL fallarían más adelante con un error incomprensible
--     ("return type mismatch"). Se detecta y se frena acá, con un mensaje claro.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_incompatible text;
BEGIN
  SELECT string_agg(t.tabla || '.' || t.columna || ' es ' || t.tipo_actual
                   || ' y debería ser ' || t.tipo_esperado, E'\n  - ', ORDER BY t.tabla, t.columna)
    INTO v_incompatible
    FROM (
      SELECT 'mesas' AS tabla, 'ubicacion' AS columna, 'ubicacion_mesa' AS tipo_esperado
      UNION ALL SELECT 'mesas', 'estado', 'estado_mesa'
      UNION ALL SELECT 'reservas', 'estado', 'estado_reserva'
      UNION ALL SELECT 'pedidos', 'estado', 'estado_pedido'
      UNION ALL SELECT 'usuarios', 'rol', 'rol_usuario'
    ) t
   JOIN information_schema.columns ic
     ON ic.table_schema = 'public' AND ic.table_name = t.tabla AND ic.column_name = t.columna
   JOIN pg_namespace n ON n.nspname = 'public'
   JOIN pg_type ty ON ty.typname = ic.udt_name
  WHERE ty.typname <> t.tipo_esperado;

  IF v_incompatible IS NOT NULL THEN
    RAISE EXCEPTION E'ATENCION: hay tablas de una version anterior del proyecto con tipos incompatibles:\n  - %\n\nEste script usa CREATE TABLE IF NOT EXISTS, por lo que no puede corregirlas solo.\n\nOpciones:\n  a) Si no te importa la data:  DROP TABLE public.mesas, public.reservas, public.pedidos CASCADE;\n  b) Si la data importa: migrala a mano antes de continuar.\n\nConsulta el respaldo del esquema anterior en database/legacy_backup.sql.', v_incompatible;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONES
--    btree_gist permite combinar operadores de igualdad (=) con el operador
--    de rango && dentro de una restricción EXCLUDE. Es la base de la
--    garantía de integridad "una mesa no puede tener dos reservas superpuestas".
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";


-- ============================================================================
-- 1. TIPOS DE ESTADO (dominios)
--    Encapsulan los valores permitidos y_documentan el dominio de negocio.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
    CREATE TYPE public.rol_usuario AS ENUM ('admin', 'cliente');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_mesa') THEN
    CREATE TYPE public.estado_mesa AS ENUM ('disponible', 'mantenimiento');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_reserva') THEN
    CREATE TYPE public.estado_reserva AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_pedido') THEN
    CREATE TYPE public.estado_pedido AS ENUM ('pendiente', 'preparado', 'entregado', 'cancelado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ubicacion_mesa') THEN
    CREATE TYPE public.ubicacion_mesa AS ENUM ('interior', 'terraza', 'ventana', 'barra', 'privada');
  END IF;
END $$;


-- ============================================================================
-- 2. FUNCIÓN AUXILIAR DE NEGOCIO
--    Duración de cada reserva. Es el bloque básico sobre el que se calcula
--    cualquier solapamiento. Se mantiene en un único lugar para que el
--    backend (config/restaurante.js) y la base de datos no se diverjan.
-- ----------------------------------------------------------------------------
--  Nota: PostgreSQL no permite pasar parámetros a un valor por defecto de
--  función, por eso el intervalo se declara como constante aquí.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_duracion_reserva()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT INTERVAL '90 minutes';
$$;


-- ============================================================================
-- 3. TABLA: usuarios
--    Perfil de aplicación asociado 1:1 a una cuenta de Supabase Auth
--    (auth.users). El email es único en ambos lados.
--
--    NOTA DE SEGURIDAD
--    La columna password_hash se conserva porque forma parte del modelo de
--    datos solicitado, PERO permanece siempre en NULL: las credenciales
--    viven cifradas en Supabase Auth (bcrypt) y el backend jamás escribe en
--    esta columna. No se almacenan contraseñas en texto plano en ningún punto
--    del sistema. Ver README.md > Autenticación.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text        NOT NULL,
  email         text        NOT NULL UNIQUE,
  password_hash text,
  rol           public.rol_usuario NOT NULL DEFAULT 'cliente',
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usuarios_email_formato_chk
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT usuarios_nombre_no_vacio_chk
    CHECK (length(btrim(nombre)) >= 2)
);

COMMENT ON COLUMN public.usuarios.password_hash IS
  'Siempre NULL: Supabase Auth gestiona el hash de la contrasena. Columna reservada por diseno del modelo de datos.';

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios (rol);


-- ============================================================================
-- 4. TABLA: clientes
--    Persona que se sienta en el restaurante. Puede tener o no una cuenta de
--    acceso (reservas como invitado). usuario_id enlaza con usuarios.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id         bigserial PRIMARY KEY,
  usuario_id uuid UNIQUE REFERENCES public.usuarios (id) ON DELETE SET NULL,
  nombre     text        NOT NULL,
  apellido   text        NOT NULL,
  email      text        NOT NULL UNIQUE,
  telefono   text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clientes_nombre_chk
    CHECK (length(btrim(nombre)) >= 2),
  CONSTRAINT clientes_apellido_chk
    CHECK (length(btrim(apellido)) >= 2),
  CONSTRAINT clientes_email_unico_chk
    CHECK (email = lower(btrim(email))),
  CONSTRAINT clientes_email_formato_chk
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT clientes_telefono_chk
    CHECK (telefono IS NULL OR telefono ~ '^\+?[0-9 ()\-]{6,20}$')
);

CREATE INDEX IF NOT EXISTS idx_clientes_email    ON public.clientes (email);
CREATE INDEX IF NOT EXISTS idx_clientes_usuario  ON public.clientes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_created  ON public.clientes (created_at DESC);


-- ============================================================================
-- 5. TABLA: mesas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mesas (
  id         bigserial PRIMARY KEY,
  numero     integer     NOT NULL UNIQUE,
  capacidad  integer     NOT NULL,
  ubicacion  public.ubicacion_mesa NOT NULL DEFAULT 'interior',
  estado     public.estado_mesa  NOT NULL DEFAULT 'disponible',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mesas_numero_chk     CHECK (numero > 0),
  CONSTRAINT mesas_capacidad_chk  CHECK (capacidad > 0 AND capacidad <= 40)
);

CREATE INDEX IF NOT EXISTS idx_mesas_capacidad ON public.mesas (capacidad);
CREATE INDEX IF NOT EXISTS idx_mesas_estado    ON public.mesas (estado);


-- ============================================================================
-- 6. TABLA: categorias
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categorias (
  id          bigserial PRIMARY KEY,
  nombre      text NOT NULL UNIQUE,
  descripcion text,

  CONSTRAINT categorias_nombre_chk CHECK (length(btrim(nombre)) >= 3)
);


-- ============================================================================
-- 7. TABLA: platos
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platos (
  id           bigserial PRIMARY KEY,
  categoria_id bigint NOT NULL REFERENCES public.categorias (id) ON DELETE RESTRICT,
  nombre       text     NOT NULL,
  descripcion  text,
  precio       numeric(10, 2) NOT NULL,
  imagen_url   text,
  disponible   boolean  NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT platos_precio_chk     CHECK (precio >= 0),
  CONSTRAINT platos_nombre_chk     CHECK (length(btrim(nombre)) >= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platos_categoria_nombre
  ON public.platos (categoria_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_platos_categoria  ON public.platos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_platos_disponible ON public.platos (disponible);


-- ============================================================================
-- 8. TABLA: reservas
--    REGLA FUNDAMENTAL
--    Una mesa NO puede tener dos reservas superpuestas.
--
--    Mechanismo de integridad (3 capas, todas en esta base de datos):
--      a) Columnas generadas franja_inicio / franja_fin = fecha + hora + 90'.
--      b) Restricción EXCLUDE USING gist que PROHÍBE el solapamiento a nivel
--         de motor: ninguna INSERT/UPDATE puede saltarse esta regla, ni
--         siquiera desde el SQL Editor de Supabase o una petición concurrente.
--      c) Trigger BEFORE INSERT/UPDATE que emite un mensaje de error legible
--         en español para la aplicación.
--
--    Solo se consideran bloqueantes los estados 'pendiente' y 'confirmada'.
--    Una reserva cancelada o completada libera la franja.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reservas (
  id                bigserial PRIMARY KEY,
  codigo            text NOT NULL UNIQUE,
  cliente_id        bigint NOT NULL REFERENCES public.clientes (id) ON DELETE CASCADE,
  mesa_id           bigint NOT NULL REFERENCES public.mesas (id)    ON DELETE RESTRICT,
  fecha             date    NOT NULL,
  hora              time    NOT NULL,
  personas          integer NOT NULL,
  estado            public.estado_reserva NOT NULL DEFAULT 'pendiente',
  observaciones     text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Columnas generadas: definen la franja ocupada por la reserva.
  franja_inicio     timestamp GENERATED ALWAYS AS (fecha::timestamp + hora) STORED,
  franja_fin        timestamp GENERATED ALWAYS AS (fecha::timestamp + hora + public.fn_duracion_reserva()) STORED,

  CONSTRAINT reservas_personas_chk CHECK (personas > 0 AND personas <= 40),
  CONSTRAINT reservas_fecha_chk    CHECK (fecha >= date '2020-01-01'),
  CONSTRAINT reservas_hora_chk     CHECK (hora >= TIME '00:00' AND hora < TIME '24:00'),
  CONSTRAINT reservas_codigo_chk   CHECK (codigo ~ '^RSV-[0-9A-Z]{6}$')
);

COMMENT ON COLUMN public.reservas.codigo IS
  'Código corto legible por el cliente (ej. RSV-4KQ2ZM). Es el "número de reserva".';

CREATE INDEX IF NOT EXISTS idx_reservas_fecha        ON public.reservas (fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_hora         ON public.reservas (hora);
CREATE INDEX IF NOT EXISTS idx_reservas_estado       ON public.reservas (estado);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente      ON public.reservas (cliente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reservas_mesa         ON public.reservas (mesa_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_franja       ON public.reservas USING gist (franja_inicio, franja_fin);


-- 8.b Restricción de no solapamiento (garantía fuerte, a nivel de motor)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservas_franja_no_superpuesta'
  ) THEN
    ALTER TABLE public.reservas
      ADD CONSTRAINT reservas_franja_no_superpuesta
      EXCLUDE USING gist (
        mesa_id           WITH =,
        fecha             WITH =,
        tsrange(franja_inicio, franja_fin, '[)') WITH &&
      )
      WHERE (estado IN ('pendiente', 'confirmada'));
  END IF;
END $$;


-- 8.c Trigger con mensaje de error de negocio legible
CREATE OR REPLACE FUNCTION public.fn_reservas_validar_superposicion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_duracion interval := public.fn_duracion_reserva();
  v_conflicto record;
BEGIN
  -- Sólo las reservas activas ocupan la mesa.
  IF NEW.estado NOT IN ('pendiente', 'confirmada') THEN
    RETURN NEW;
  END IF;

  SELECT r.id, r.codigo, r.hora
    INTO v_conflicto
    FROM public.reservas r
   WHERE r.mesa_id  = NEW.mesa_id
     AND r.fecha    = NEW.fecha
     AND r.estado IN ('pendiente', 'confirmada')
     AND r.id <> NEW.id
     AND (r.hora, r.hora + v_duracion) OVERLAPS (NEW.hora, NEW.hora + v_duracion)
   ORDER BY r.hora
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'La mesa % ya tiene la reserva % de las % a las %',
      NEW.mesa_id, v_conflicto.codigo, v_conflicto.hora, (v_conflicto.hora + v_duracion)
      USING ERRCODE = '23P01',
            HINT    = 'Elige otra mesa u otro horario.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservas_validar_superposicion ON public.reservas;
CREATE TRIGGER trg_reservas_validar_superposicion
  BEFORE INSERT OR UPDATE OF mesa_id, fecha, hora, estado ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reservas_validar_superposicion();


-- 8.d Capacidad: no se puede reservar una mesa para más personas de las que cabe.
CREATE OR REPLACE FUNCTION public.fn_reservas_validar_capacidad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacidad integer;
BEGIN
  SELECT m.capacidad INTO v_capacidad
    FROM public.mesas m
   WHERE m.id = NEW.mesa_id;

  IF v_capacidad IS NULL THEN
    RAISE EXCEPTION 'La mesa indicada no existe.' USING ERRCODE = '23503';
  END IF;

  IF NEW.personas > v_capacidad THEN
    RAISE EXCEPTION
      'La mesa % solo tiene % lugares y la reserva es para % personas.',
      NEW.mesa_id, v_capacidad, NEW.personas
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservas_validar_capacidad ON public.reservas;
CREATE TRIGGER trg_reservas_validar_capacidad
  BEFORE INSERT OR UPDATE OF mesa_id, personas ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reservas_validar_capacidad();


-- 8.e Código de reserva legible y único (base 32 sin caracteres ambiguos).
CREATE OR REPLACE FUNCTION public.fn_reservas_generar_codigo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_codigo   text;
  v_intento  integer;
BEGIN
  IF NEW.codigo IS NOT NULL AND btrim(NEW.codigo) <> '' THEN
    RETURN NEW;
  END IF;

  FOR v_intento IN 1..20 LOOP
    v_codigo := 'RSV-'
      || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1)
      || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1)
      || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1)
      || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1)
      || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1)
      || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);

    IF NOT EXISTS (SELECT 1 FROM public.reservas r WHERE r.codigo = v_codigo) THEN
      NEW.codigo := v_codigo;
      RETURN NEW;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'No se pudo generar un código de reserva único.' USING ERRCODE = '23505';
END;
$$;

DROP TRIGGER IF EXISTS trg_reservas_generar_codigo ON public.reservas;
CREATE TRIGGER trg_reservas_generar_codigo
  BEFORE INSERT ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reservas_generar_codigo();


-- ============================================================================
-- 9. TABLA: pedidos   (facturación)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
  id         bigserial PRIMARY KEY,
  reserva_id bigint UNIQUE REFERENCES public.reservas (id) ON DELETE CASCADE,
  cliente_id bigint NOT NULL REFERENCES public.clientes (id) ON DELETE CASCADE,
  estado     public.estado_pedido NOT NULL DEFAULT 'pendiente',
  total      numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pedidos_total_chk CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON public.pedidos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado  ON public.pedidos (estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha   ON public.pedidos (created_at DESC);


-- ============================================================================
-- 10. TABLA: detalle_pedido
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.detalle_pedido (
  id              bigserial PRIMARY KEY,
  pedido_id       bigint NOT NULL REFERENCES public.pedidos (id) ON DELETE CASCADE,
  plato_id        bigint NOT NULL REFERENCES public.platos  (id) ON DELETE RESTRICT,
  cantidad        integer NOT NULL,
  precio_unitario numeric(10, 2) NOT NULL,
  subtotal        numeric(12, 2) NOT NULL,

  CONSTRAINT detalle_cantidad_chk  CHECK (cantidad > 0),
  CONSTRAINT detalle_precio_chk    CHECK (precio_unitario >= 0),
  CONSTRAINT detalle_subtotal_chk  CHECK (subtotal >= 0),
  CONSTRAINT detalle_subtotal_calc_chk
    CHECK (subtotal = round(cantidad * precio_unitario, 2)),
  CONSTRAINT detalle_unico_plato_chk UNIQUE (pedido_id, plato_id)
);

CREATE INDEX IF NOT EXISTS idx_detalle_pedido ON public.detalle_pedido (pedido_id);
CREATE INDEX IF NOT EXISTS idx_detalle_plato  ON public.detalle_pedido (plato_id);


-- ============================================================================
-- 11. FK usuarios.id -> auth.users.id (solo en Supabase)
--     Se crea condicionalmente para que schema.sql también sea ejecutable en
--     un PostgreSQL "vanilla" (por ejemplo, en un contenedor de pruebas).
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'auth' AND table_name = 'users'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_auth_fk'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_auth_fk
      FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================================
-- 12. SEGURIDAD: ROW LEVEL SECURITY
--     Toda la aplicación se comunica con la base de datos a través del backend
--     usando la SERVICE ROLE KEY, que ignora RLS por diseño. Activando RLS y
--     NO creando políticas públicas, la tabla queda inaccesible para anon y
--     authenticated: nadie puede saltarse la API REST.
--     Ver README.md > Seguridad.
-- ============================================================================
ALTER TABLE public.usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedido ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 13. VISTAS DE LECTURA
--     Simplifican los JOIN de la capa de servicios y evitan duplicar el
--     mapeo de relaciones en JavaScript.
-- ============================================================================
CREATE OR REPLACE VIEW public.v_reservas AS
SELECT
  r.id,
  r.codigo,
  r.cliente_id,
  c.nombre  AS cliente_nombre,
  c.apellido AS cliente_apellido,
  c.email   AS cliente_email,
  c.telefono AS cliente_telefono,
  r.mesa_id,
  m.numero    AS mesa_numero,
  m.capacidad AS mesa_capacidad,
  m.ubicacion AS mesa_ubicacion,
  m.estado    AS mesa_estado,
  r.fecha,
  r.hora,
  r.franja_inicio,
  r.franja_fin,
  r.personas,
  r.estado,
  r.observaciones,
  r.created_at
FROM public.reservas r
JOIN public.clientes c ON c.id = r.cliente_id
JOIN public.mesas    m ON m.id = r.mesa_id;

COMMENT ON VIEW public.v_reservas IS
  'Reservas con datos de cliente y mesa desnormalizados. Base de /api/reservas.';

CREATE OR REPLACE VIEW public.v_platos AS
SELECT
  p.id,
  p.categoria_id,
  cat.nombre     AS categoria,
  cat.descripcion AS categoria_descripcion,
  p.nombre,
  p.descripcion,
  p.precio,
  p.imagen_url,
  p.disponible,
  p.created_at
FROM public.platos p
JOIN public.categorias cat ON cat.id = p.categoria_id;

CREATE OR REPLACE VIEW public.v_mesas_ocupadas AS
SELECT
  m.id        AS mesa_id,
  m.numero    AS mesa_numero,
  m.capacidad,
  m.ubicacion,
  m.estado    AS mesa_estado,
  r.id        AS reserva_id,
  r.codigo,
  r.hora,
  r.personas,
  r.estado    AS reserva_estado,
  c.nombre    AS cliente_nombre,
  c.apellido  AS cliente_apellido
FROM public.mesas m
LEFT JOIN public.reservas r
       ON r.mesa_id = m.id
      AND r.estado IN ('pendiente', 'confirmada')
LEFT JOIN public.clientes c ON c.id = r.cliente_id;

COMMENT ON VIEW public.v_mesas_ocupadas IS
  'Estado de mesas con su reserva activa a una fecha/hora concretas.';


-- ============================================================================
-- 14. FUNCIONES DE DISPONIBILIDAD
-- ============================================================================

-- 14.a Mesas libres para una fecha, hora y cantidad de personas.
CREATE OR REPLACE FUNCTION public.fn_mesas_disponibles(
  p_fecha     date,
  p_hora      time,
  p_personas  integer
)
RETURNS TABLE (id bigint, numero integer, capacidad integer, ubicacion public.ubicacion_mesa)
LANGUAGE sql
STABLE
AS $$
  SELECT m.id, m.numero, m.capacidad, m.ubicacion
    FROM public.mesas m
   WHERE m.estado = 'disponible'
     AND m.capacidad >= p_personas
     AND NOT EXISTS (
           SELECT 1
             FROM public.reservas r
            WHERE r.mesa_id  = m.id
              AND r.fecha    = p_fecha
              AND r.estado IN ('pendiente', 'confirmada')
              AND (r.hora, r.hora + public.fn_duracion_reserva())
                  OVERLAPS (p_hora, p_hora + public.fn_duracion_reserva())
         )
   ORDER BY m.capacidad ASC, m.numero ASC;
$$;

COMMENT ON FUNCTION public.fn_mesas_disponibles(date, time, integer) IS
  'Mesas con capacidad suficiente, en servicio y sin reservas solapadas.';


-- 14.b Reservas que chocan con una propuesta concreta.
--     p_excluir_id permite reutilizar la función al EDITAR una reserva.
CREATE OR REPLACE FUNCTION public.fn_reservas_conflictantes(
  p_mesa_id      bigint,
  p_fecha        date,
  p_hora         time,
  p_excluir_id   bigint DEFAULT NULL
)
RETURNS TABLE (id bigint, codigo text, mesa_id bigint, fecha date, hora time, estado public.estado_reserva)
LANGUAGE sql
STABLE
AS $$
  SELECT r.id, r.codigo, r.mesa_id, r.fecha, r.hora, r.estado
    FROM public.reservas r
   WHERE r.mesa_id = p_mesa_id
     AND r.fecha   = p_fecha
     AND r.estado IN ('pendiente', 'confirmada')
     AND (p_excluir_id IS NULL OR r.id <> p_excluir_id)
     AND (r.hora, r.hora + public.fn_duracion_reserva())
         OVERLAPS (p_hora, p_hora + public.fn_duracion_reserva())
   ORDER BY r.hora;
$$;


-- 14.c Estado del salón a una fecha/hora: ocupadas y libres.
CREATE OR REPLACE FUNCTION public.fn_estado_salon(p_fecha date, p_hora time)
RETURNS TABLE (
  mesa_id        bigint,
  mesa_numero    integer,
  mesa_capacidad integer,
  mesa_ubicacion public.ubicacion_mesa,
  mesa_estado    public.estado_mesa,
  ocupada        boolean,
  reserva_id     bigint,
  reserva_codigo text,
  reserva_estado public.estado_reserva,
  reserva_hora   time,
  reserva_personas integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id,
    m.numero,
    m.capacidad,
    m.ubicacion,
    m.estado,
    (r.id IS NOT NULL) AS ocupada,
    r.id,
    r.codigo,
    r.estado,
    r.hora,
    r.personas
  FROM public.mesas m
  LEFT JOIN LATERAL (
    SELECT res.id, res.codigo, res.estado, res.hora, res.personas
      FROM public.reservas res
     WHERE res.mesa_id = m.id
       AND res.fecha   = p_fecha
       AND res.estado IN ('pendiente', 'confirmada')
       AND (res.hora, res.hora + public.fn_duracion_reserva())
           OVERLAPS (p_hora, p_hora + public.fn_duracion_reserva())
     LIMIT 1
  ) r ON true
  ORDER BY m.numero;
$$;


-- ============================================================================
-- 15. FUNCIONES DE ESTADÍSTICAS
--     Todo el cálculo pesado ocurre en PostgreSQL (COUNT / SUM / AVG /
--     GROUP BY / HAVING / JOIN / subconsultas). React solo pinta resultados.
-- ============================================================================

-- 15.a Dashboard administrativo
CREATE OR REPLACE FUNCTION public.fn_dashboard(p_fecha date)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'fecha', p_fecha,
    'reservas_hoy', (
      SELECT count(*) FROM public.reservas r
       WHERE r.fecha = p_fecha
         AND r.estado <> 'cancelada'
    ),
    'mesas_ocupadas', (
      SELECT count(DISTINCT r.mesa_id) FROM public.reservas r
       WHERE r.fecha = p_fecha
         AND r.estado IN ('pendiente', 'confirmada')
    ),
    'mesas_totales', (SELECT count(*) FROM public.mesas),
    'mesas_disponibles', (
      SELECT count(*) FROM public.mesas WHERE estado = 'disponible'
    ),
    'mesas_mantenimiento', (
      SELECT count(*) FROM public.mesas WHERE estado = 'mantenimiento'
    ),
    'clientes_registrados', (SELECT count(*) FROM public.clientes),
    'personas_atendidas', (
      SELECT COALESCE(sum(r.personas), 0) FROM public.reservas r
       WHERE r.fecha = p_fecha AND r.estado <> 'cancelada'
    ),
    'facturacion_dia', (
      SELECT COALESCE(sum(p.total), 0) FROM public.pedidos p
       WHERE p.created_at::date = p_fecha AND p.estado <> 'cancelado'
    ),
    'pedidos_dia', (
      SELECT count(*) FROM public.pedidos p
       WHERE p.created_at::date = p_fecha AND p.estado <> 'cancelado'
    )
  );
$$;


-- 15.b Reservas por día
CREATE OR REPLACE FUNCTION public.fn_reservas_por_dia(p_desde date, p_hasta date)
RETURNS TABLE (
  dia date, total bigint, pendientes bigint, confirmadas bigint,
  canceladas bigint, completadas bigint, personas bigint,
  promedio_personas numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.fecha AS dia,
    count(*) AS total,
    count(*) FILTER (WHERE r.estado = 'pendiente')   AS pendientes,
    count(*) FILTER (WHERE r.estado = 'confirmada')  AS confirmadas,
    count(*) FILTER (WHERE r.estado = 'cancelada')   AS canceladas,
    count(*) FILTER (WHERE r.estado = 'completada')  AS completadas,
    COALESCE(sum(r.personas), 0) AS personas,
    round(AVG(r.personas)::numeric, 2) AS promedio_personas
  FROM public.reservas r
  WHERE r.fecha BETWEEN p_desde AND p_hasta
  GROUP BY r.fecha
  HAVING count(*) > 0
  ORDER BY r.fecha DESC;
$$;


-- 15.c Reservas por mes
--     Se usan dos CTE y un LEFT JOIN en lugar de una subconsulta correlacionada
--     en el SELECT: referenciar r.fecha dentro de la lista de selección exigiría
--     que la columna estuviera en el GROUP BY (sólo lo están sus expresiones).
CREATE OR REPLACE FUNCTION public.fn_reservas_por_mes(p_desde date, p_hasta date)
RETURNS TABLE (
  mes text, anio integer, total bigint, personas bigint, facturacion numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH reservas_mes AS (
    SELECT
      to_char(fecha, 'YYYY-MM')            AS mes,
      EXTRACT(YEAR FROM fecha)::integer    AS anio,
      count(*)                            AS total,
      COALESCE(sum(personas), 0)           AS personas
    FROM public.reservas
    WHERE fecha BETWEEN p_desde AND p_hasta
      AND estado <> 'cancelada'
    GROUP BY 1, 2
  ),
  ventas_mes AS (
    SELECT
      to_char(r2.fecha, 'YYYY-MM') AS mes,
      sum(pe.total)               AS facturacion
    FROM public.pedidos pe
    JOIN public.reservas r2 ON r2.id = pe.reserva_id
    WHERE r2.estado <> 'cancelada'
      AND r2.fecha BETWEEN p_desde AND p_hasta
    GROUP BY 1
  )
  SELECT
    rm.mes,
    rm.anio,
    rm.total,
    rm.personas,
    COALESCE(vm.facturacion, 0) AS facturacion
  FROM reservas_mes rm
  LEFT JOIN ventas_mes vm ON vm.mes = rm.mes
  ORDER BY rm.mes DESC;
$$;


-- 15.d Mesas más utilizadas
CREATE OR REPLACE FUNCTION public.fn_mesas_mas_utilizadas(p_desde date, p_hasta date)
RETURNS TABLE (
  mesa_id bigint, mesa_numero integer, capacidad integer, ubicacion public.ubicacion_mesa,
  veces bigint, personas bigint, porcentaje numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH totales AS (
    SELECT count(*)::numeric AS total_reservas
      FROM public.reservas
     WHERE fecha BETWEEN p_desde AND p_hasta AND estado <> 'cancelada'
  )
  SELECT
    m.id,
    m.numero,
    m.capacidad,
    m.ubicacion,
    count(r.id) AS veces,
    COALESCE(sum(r.personas), 0) AS personas,
    CASE
      WHEN t.total_reservas = 0 THEN 0
      ELSE round((count(r.id) / t.total_reservas) * 100, 2)
    END AS porcentaje
  FROM public.mesas m
  JOIN public.reservas r ON r.mesa_id = m.id
  CROSS JOIN totales t
  WHERE r.fecha BETWEEN p_desde AND p_hasta
    AND r.estado <> 'cancelada'
  GROUP BY m.id, m.numero, m.capacidad, m.ubicacion, t.total_reservas
  HAVING count(r.id) > 0
  ORDER BY veces DESC, m.numero ASC;
$$;


-- 15.e Clientes atendidos (resumen + ranking)
CREATE OR REPLACE FUNCTION public.fn_clientes_atendidos(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_clientes', (SELECT count(*) FROM public.clientes),
    'clientes_atendidos', (
      SELECT count(DISTINCT cliente_id) FROM public.reservas
       WHERE fecha BETWEEN p_desde AND p_hasta AND estado <> 'cancelada'
    ),
    'personas_atendidas', (
      SELECT COALESCE(sum(personas), 0) FROM public.reservas
       WHERE fecha BETWEEN p_desde AND p_hasta AND estado <> 'cancelada'
    ),
    'promedio_personas', (
      SELECT COALESCE(round(AVG(personas)::numeric, 2), 0) FROM public.reservas
       WHERE fecha BETWEEN p_desde AND p_hasta AND estado <> 'cancelada'
    )
  );
$$;


-- 15.f Clientes con mayor cantidad de reservas
CREATE OR REPLACE FUNCTION public.fn_clientes_top(
  p_desde date, p_hasta date, p_limite integer DEFAULT 10
)
RETURNS TABLE (
  cliente_id bigint, nombre text, apellido text, email text, telefono text,
  reservas bigint, visitas bigint, gasto numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id, c.nombre, c.apellido, c.email, c.telefono,
    count(r.id) AS reservas,
    count(r.id) FILTER (WHERE r.estado IN ('confirmada', 'completada')) AS visitas,
    COALESCE((
      SELECT sum(pe.total)
        FROM public.pedidos pe
       WHERE pe.cliente_id = c.id
         AND pe.estado <> 'cancelado'
    ), 0) AS gasto
  FROM public.clientes c
  JOIN public.reservas r ON r.cliente_id = c.id
  WHERE r.fecha BETWEEN p_desde AND p_hasta
  GROUP BY c.id, c.nombre, c.apellido, c.email, c.telefono
  HAVING count(r.id) > 0
  ORDER BY reservas DESC, gasto DESC
  LIMIT p_limite;
$$;


-- 15.g Plato más solicitado / ranking de platos
CREATE OR REPLACE FUNCTION public.fn_platos_mas_vendidos(
  p_desde date, p_hasta date, p_limite integer DEFAULT 10
)
RETURNS TABLE (
  plato_id bigint, plato text, categoria text,
  unidades bigint, ingresos numeric, pedidos bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.nombre,
    cat.nombre,
    sum(d.cantidad) AS unidades,
    sum(d.subtotal)  AS ingresos,
    count(DISTINCT d.pedido_id) AS pedidos
  FROM public.detalle_pedido d
  JOIN public.platos     p   ON p.id  = d.plato_id
  JOIN public.categorias cat ON cat.id = p.categoria_id
  JOIN public.pedidos    pe  ON pe.id  = d.pedido_id
  WHERE pe.estado <> 'cancelado'
    AND (p_desde IS NULL OR pe.created_at::date >= p_desde)
    AND (p_hasta IS NULL OR pe.created_at::date <= p_hasta)
  GROUP BY p.id, p.nombre, cat.nombre
  HAVING sum(d.cantidad) > 0
  ORDER BY unidades DESC, ingresos DESC
  LIMIT p_limite;
$$;


-- 15.h Facturación total y por período
CREATE OR REPLACE FUNCTION public.fn_ventas(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'total', (
      SELECT COALESCE(sum(total), 0) FROM public.pedidos
       WHERE estado <> 'cancelado'
         AND created_at::date BETWEEN p_desde AND p_hasta
    ),
    'cantidad_pedidos', (
      SELECT count(*) FROM public.pedidos
       WHERE estado <> 'cancelado'
         AND created_at::date BETWEEN p_desde AND p_hasta
    ),
    'ticket_promedio', (
      SELECT COALESCE(round(AVG(total)::numeric, 2), 0) FROM public.pedidos
       WHERE estado <> 'cancelado'
         AND created_at::date BETWEEN p_desde AND p_hasta
    )
  );
$$;


-- 15.i Facturación por mes
CREATE OR REPLACE FUNCTION public.fn_ventas_por_mes(p_anio integer)
RETURNS TABLE (
  mes text, total numeric, pedidos bigint, ticket_promedio numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    to_char(pe.created_at, 'YYYY-MM') AS mes,
    sum(pe.total) AS total,
    count(*) AS pedidos,
    round(AVG(pe.total)::numeric, 2) AS ticket_promedio
  FROM public.pedidos pe
  WHERE pe.estado <> 'cancelado'
    AND EXTRACT(YEAR FROM pe.created_at)::integer = p_anio
  GROUP BY 1
  ORDER BY 1 DESC;
$$;


-- 15.j Reservas por estado
CREATE OR REPLACE FUNCTION public.fn_reservas_por_estado(p_desde date, p_hasta date)
RETURNS TABLE (estado public.estado_reserva, total bigint, porcentaje numeric)
LANGUAGE sql
STABLE
AS $$
  WITH totales AS (
    SELECT count(*)::numeric AS n FROM public.reservas
     WHERE fecha BETWEEN p_desde AND p_hasta
  )
  SELECT
    r.estado,
    count(*) AS total,
    CASE WHEN t.n = 0 THEN 0 ELSE round((count(*) / t.n) * 100, 2) END AS porcentaje
  FROM public.reservas r
  CROSS JOIN totales t
  WHERE r.fecha BETWEEN p_desde AND p_hasta
  GROUP BY r.estado, t.n
  ORDER BY total DESC;
$$;


-- 15.k Horarios con mayor cantidad de reservas
CREATE OR REPLACE FUNCTION public.fn_horarios_mas_demandados(p_desde date, p_hasta date)
RETURNS TABLE (hora time, reservas bigint, personas bigint, promedio_personas numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.hora,
    count(*) AS reservas,
    COALESCE(sum(r.personas), 0) AS personas,
    round(AVG(r.personas)::numeric, 2) AS promedio_personas
  FROM public.reservas r
  WHERE r.fecha BETWEEN p_desde AND p_hasta
    AND r.estado <> 'cancelada'
  GROUP BY r.hora
  ORDER BY reservas DESC, r.hora ASC;
$$;


-- ============================================================================
-- 16. GRACIAS / PRUEBAS RÁPIDAS
-- ============================================================================
--  Ver mesas libres para hoy a las 21:00 para 4 personas
--  SELECT * FROM public.fn_mesas_disponibles(CURRENT_DATE, TIME '21:00', 4);
--
--  Ver el salón completo
--  SELECT * FROM public.fn_estado_salon(CURRENT_DATE, TIME '21:00');
--
--  Dashboard de hoy
--  SELECT public.fn_dashboard(CURRENT_DATE);
--
--  Probar la regla fundamental (debe fallar con 23P01)
--  INSERT INTO public.reservas (cliente_id, mesa_id, fecha, hora, personas, estado)
--  SELECT (SELECT min(id) FROM public.clientes), 1, CURRENT_DATE, TIME '19:00', 2, 'confirmada';
--  INSERT INTO public.reservas (cliente_id, mesa_id, fecha, hora, personas, estado)
--  SELECT (SELECT min(id) FROM public.clientes), 1, CURRENT_DATE, TIME '19:30', 2, 'confirmada';
-- ============================================================================
