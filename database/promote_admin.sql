-- ============================================================================
--  database/promote_admin.sql
--
--  Convierte una cuenta registrada en la aplicación (Rol = cliente) en una
--  cuenta de ADMINISTRADOR.
--
--  PROCEDIMIENTO
--    1. Registrate desde la app en  http://localhost:5173/registro
--    2. Ejecuta este archivo en Supabase > SQL Editor, cambiando el email.
--
--  Alternativa: insertar un administrador desde cero (necesita que el
--  usuario ya exista en auth.users, por eso se recomienda el UPDATE).
-- ============================================================================

UPDATE public.usuarios
   SET rol = 'admin'
 WHERE lower(email) = lower('admin@restaurante.com');   -- <-- CAMBIA ESTE EMAIL

-- ---------------------------------------------------------------------------
--  COMPROBACIÓN
-- ---------------------------------------------------------------------------
SELECT id, nombre, email, rol, created_at
  FROM public.usuarios
 ORDER BY created_at DESC;

-- ---------------------------------------------------------------------------
--  DESHACER (volver a cliente)
-- ---------------------------------------------------------------------------
-- UPDATE public.usuarios SET rol = 'cliente' WHERE email = 'admin@restaurante.com';
