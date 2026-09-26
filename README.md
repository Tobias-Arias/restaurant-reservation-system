# 🍽️ Sistema de Gestión de Reservas de Restaurante

Aplicación web completa para la gestión de reservas de un restaurante, con dos tipos de
usuario (**cliente** y **administrador**).

Construida con exactamente la stack pedida, sin frameworks alternativos:

```
React (Vite)  →  API REST  →  Node.js + Express  →  Supabase  →  PostgreSQL
```

| Capa        | Tecnología                  | Carpeta    |
| ----------- | --------------------------- | ---------- |
| Frontend    | React 18 + React Router 6   | `frontend/` |
| Backend     | Node.js 18+ + Express 4     | `backend/`  |
| Base de datos | Supabase (PostgreSQL 15)  | `database/` |
| Estilos     | CSS propio                  | `frontend/src/styles/` |

**No se usa** Next.js, Angular, Vue, Laravel, Django, Firebase, MongoDB, MySQL, Bootstrap,
Tailwind ni Material UI. Tampoco hay librerías de charts: los gráficos son CSS puro.

---

## 📑 Índice

1. [Requisitos](#1-requisitos)
2. [Cómo crear el proyecto](#2-cómo-crear-el-proyecto)
3. [Cómo crear un proyecto en Supabase](#3-cómo-crear-un-proyecto-en-supabase)
4. [Cómo obtener las variables necesarias](#4-cómo-obtener-las-variables-necesarias)
5. [Ejecutar `schema.sql`](#5-ejecutar-schemasql)
6. [Ejecutar `seed.sql`](#6-ejecutar-seedsql)
7. [Configurar `.env`](#7-configurar-env)
8. [Instalar dependencias](#8-instalar-dependencias)
9. [Ejecutar el backend](#9-ejecutar-el-backend)
10. [Ejecutar el frontend](#10-ejecutar-el-frontend)
11. [URLs utilizadas](#11-urls-utilizadas)
12. [Crear el usuario administrador](#12-crear-el-usuario-administrador)
13. [Cómo probar cada funcionalidad](#13-cómo-probar-cada-funcionalidad)
14. [API REST](#14-api-rest)
15. [Modelo de datos](#15-modelo-de-datos)
16. [La regla fundamental de reservas](#16-la-regla-fundamental-de-reservas)
17. [Horarios](#17-horarios)
18. [Seguridad](#18-seguridad)
19. [Variables de entorno](#19-variables-de-entorno)
20. [Estructura del proyecto](#20-estructura-del-proyecto)
21. [Ejecución desde Visual Studio Code](#21-ejecución-desde-visual-studio-code)
22. [Solución de problemas](#22-solución-de-problemas)

---

## 1. Requisitos

| Herramienta | Versión mínima | Para qué |
| ----------- | -------------- | -------- |
| **Node.js** | 18.0 (LTS) | Motor del backend y build del frontend |
| **npm** | 9.0 | Gestor de paquetes |
| **Cuenta de Supabase** | — | Base de datos PostgreSQL + autenticación |
| **Visual Studio Code** | Cualquiera | Editor recomendado |
| **Navegador moderno** | Chrome / Edge / Firefox / Safari | Frontend |

Verificá tu instalación:

```bash
node --version   # v18.0.0 o superior
npm --version    # 9.0.0 o superior
```

---

## 2. Cómo crear el proyecto

El proyecto ya está generado. Sólo necesitás descargarlo o clonarlo y colocarlo en tu
dispositivo:

```bash
git clone <url-del-repositorio> restaurant-reservation-system
cd restaurant-reservation-system
```

Si no usás Git, copiá la carpeta completa.

A partir de ahora, todas las órdenes se ejecutan **desde la raíz del proyecto**
(`restaurant-reservation-system/`), salvo que se indique lo contrario.

---

## 3. Cómo crear un proyecto en Supabase

1. Entrá en [https://supabase.com](https://supabase.com) y creá una cuenta.
2. Click en **New project**.
3. Completá:
   - **Organization**: la que quieras (o creá una nueva).
   - **Name**: `restaurante-reservas`
   - **Database Password**: una contraseña fuerte. **Anotala**: no se puede recuperar.
   - **Region**: la más cercana a vos (ej. `South America (São Paulo)`).
   - **Plan**: `Free`.
4. Click en **Create new project** y esperá unos minutos a que se provisioned.
5. Cuando termine, abrí **SQL Editor** en el menú lateral: ahí vas a ejecutar los scripts.

> **Importante sobre la autenticación**
> El sistema usa **Supabase Auth** para registro e inicio de sesión.
> En *Authentication → Providers → Email*, asegurate de que la opción
> **"Confirm email"** esté **desactivada** para poder probarlo sin servidor de correo.
> Si la activás, el backend confirma la cuenta automáticamente la primera vez
> (ver `backend/services/authService.js`).

---

## 4. Cómo obtener las variables necesarias

En el panel de Supabase: **Project Settings → API** (en la barra inferior izquierda).

Allí vas a encontrar tres valores que necesitás:

| Valor | Dónde está | Para qué lo usa el proyecto |
| ----- | ---------- | --------------------------- |
| **Project URL** | `API Keys → Project URL` | `SUPABASE_URL` |
| **anon public key** | `API Keys → Publishable key` / `anon` | `SUPABASE_ANON_KEY` |
| **service_role key** | `API Keys → Secret keys` / `service_role` | `SUPABASE_SERVICE_ROLE_KEY` |

Copiá los tres. Las dos claves empiezan por `eyJ...`.

> 🔴 **La `service_role key` es una credencial privilegiada.** Salta las políticas de
> seguridad de la base de datos. Sólo puede vivir en `backend/.env`, que está en
> `.gitignore`. **Nunca la pongas en el frontend ni en un repositorio.**

---

## 5. Ejecutar `schema.sql`

1. En Supabase, abrí **SQL Editor → New query**.
2. Pegá **todo** el contenido de `database/schema.sql`.
3. Click en **Run** (o `Ctrl+Enter`).

Deberías ver `Success. No rows returned`.

**Qué crea el script:**

- Extensiones `pgcrypto` y `btree_gist`.
- 8 tablas con PRIMARY KEY, FOREIGN KEY, índices y restricciones CHECK.
- 3 vistas de lectura (`v_reservas`, `v_platos`, `v_mesas_ocupadas`).
- La **restricción `EXCLUDE`** que garantiza que una mesa no tenga reservas superpuestas.
- 4 triggers de negocio (solapamiento, capacidad, código de reserva).
- 14 funciones SQL de disponibilidad y estadísticas.
- Row Level Security activado en todas las tablas.

El script es **idempotente**: podés ejecutarlo más de una vez sin romper nada.

### Comprobar que se creó bien

```sql
SELECT COUNT(*) AS mesas FROM public.mesas;   -- 0 todavía
SELECT * FROM public.fn_duracion_reserva();    -- 90
```

---

## 6. Ejecutar `seed.sql`

1. En **SQL Editor → New query**, pegá el contenido de `database/seed.sql`.
2. Click en **Run**.

El script inserta datos de prueba y al final muestra un resumen por pantalla:

```
Datos de prueba cargados correctamente
  Mesas ............ 10
  Platos ........... 17
  Categorias ....... 4
  Clientes ......... 8
  Reservas ......... ~70
  Facturacion total  ...
```

Incluye:

- **10 mesas** con las capacidades pedidas (2, 2, 4, 4, 4, 6, 6, 8, 2, 4).
- **4 categorías** (Entradas, Principales, Bebidas, Postres).
- **17 platos** con precios ficticios razonables.
- **8 clientes** de prueba.
- **Reservas de prueba** para los próximos 7 días, respetando la regla de no solapamiento.
- **Pedidos y facturación** de muestra para que el dashboard tenga datos.

---

## 7. Configurar `.env`

### Backend

```bash
cd backend
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

Abrí `backend/.env` y completá:

```dotenv
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3000
```

### Frontend

```bash
cd frontend
cp .env.example .env
```

```dotenv
VITE_API_URL=http://localhost:3000
```

> No hace falta tocar nada más: `.env.example` ya trae los valores por defecto
> razonables para CORS, nombre del restaurante y reglas de negocio.

---

## 8. Instalar dependencias

### Opción A — todo desde la raíz (recomendado)

```bash
npm run install:all
```

Instala el backend y el frontend usando los *workspaces* de npm.

### Opción B — por separado

```bash
# Terminal 1
cd backend
npm install

# Terminal 2
cd frontend
npm install
```

---

## 9. Ejecutar el backend

```bash
cd backend
npm run dev
```

Salida esperada:

```
============================================================
 Restaurante La Reserva · API de reservas
============================================================
   Entorno ....... development
   Puerto ........ 3000
   Reserva ....... 90 minutos por mesa
   Turnos ........ Almuerzo 11:00-15:00 (11:00, 12:30)  |  Cena 18:00-23:00 (18:00, 19:30, 21:00)
   CORS .......... http://localhost:5173, http://127.0.0.1:5173, http://localhost:4173
--------------------------------------------------------
[supabase] conexión OK. Duración de reserva en la BD: 90 minutos.

  API disponible en  http://localhost:3000/api
  Health check en  http://localhost:3000/api/health
```

Comprobación:

```bash
curl http://localhost:3000/api/health
# {"success":true,"data":{...,"baseDeDatos":"conectada",...}}
```

> `npm run dev` usa `nodemon`: reinicia el servidor solo cuando guardás un archivo.
> Para producción usá `npm start`.

---

## 10. Ejecutar el frontend

```bash
cd frontend
npm run dev
```

Abrí **http://localhost:5173**.

---

## 11. URLs utilizadas

| Servicio | URL | Puerto |
| -------- | --- | ------ |
| **Frontend (React)** | http://localhost:5173 | 5173 |
| **Backend (Express)** | http://localhost:3000 | 3000 |
| **API REST** | http://localhost:3000/api | 3000 |
| **Health check** | http://localhost:3000/api/health | 3000 |
| **Supabase SQL Editor** | https://supabase.com/dashboard | — |
| Preview del build (opcional) | http://localhost:4173 | 4173 |

### Rutas del frontend

| Ruta | Página | Acceso |
| ---- | ------ | ------ |
| `/` | Inicio | Público |
| `/menu` | Menú | Público |
| `/reservar` | Reservar mesa | Público |
| `/login` | Iniciar sesión | Público |
| `/registro` | Crear cuenta | Público |
| `/mis-reservas` | Mis reservas | Con sesión |
| `/admin` | Dashboard | Solo admin |
| `/admin/reservas` | Reservas | Solo admin |
| `/admin/mesas` | Mesas | Solo admin |
| `/admin/clientes` | Clientes | Solo admin |
| `/admin/menu` | Menú | Solo admin |
| `/admin/estadisticas` | Estadísticas | Solo admin |
| `*` | 404 | Público |

---

## 12. Crear el usuario administrador

El registro público **siempre** crea cuentas con rol `cliente` (nadie se auto-asigna
privilegios). Para crear el administrador:

1. Registrate desde la app en **http://localhost:5173/registro**
   (por ejemplo con `admin@restaurante.com`).
2. En Supabase → **SQL Editor → New query**, ejecutá `database/promote_admin.sql`
   editando el email:

   ```sql
   UPDATE public.usuarios
      SET rol = 'admin'
    WHERE lower(email) = lower('admin@restaurante.com');
   ```

3. Verificá que se aplicó:

   ```sql
   SELECT id, nombre, email, rol FROM public.usuarios ORDER BY created_at DESC;
   ```

4. Volvé a iniciar sesión en la app. Vas a ver el enlace **"Panel admin"** en la
   navegación, y entrarás a `/admin` automáticamente.

> Para **revertir**: `UPDATE public.usuarios SET rol = 'cliente' WHERE email = '...'`

---

## 13. Cómo probar cada funcionalidad

### Como cliente

| # | Qué probar | Pasos | Resultado esperado |
| - | ---------- | ----- | ------------------ |
| 1 | Ver el menú | `http://localhost:5173/menu` | Platos agrupados por categoría, filtrables. Vienen de `GET /api/platos`. |
| 2 | Filtrar el menú | Click en "Principales" o buscá "pizza" | Sólo se muestran los platos de esa categoría / coincidentes. |
| 3 | Validación del formulario | En `/reservar`, elegí 22:30 como hora | Error: *"El horario seleccionado no es válido"* con la lista de horarios permitidos. |
| 4 | Buscar mesas disponibles | Fecha futura, hora `21:00`, 4 personas, **Buscar mesas** | `GET /api/mesas/disponibles` devuelve sólo mesas con capacidad ≥ 4 libres. |
| 5 | Sin mesas disponibles | Pedí 40 personas | *"No hay mesas disponibles"*. |
| 6 | Crear una reserva | Elegí mesa → completá datos → **Confirmar reserva** | Pantalla de éxito con el número de reserva (`RSV-XXXXXX`). |
| 7 | **Regla fundamental** | Creá una reserva en mesa 4 a las 21:00. Volvé a buscar y reservá **otra mesa** a las 21:00 en la misma fecha y tratá de elegir la mesa 4 | La mesa 4 **no aparece** en la lista. Si forzás el `POST` con otra mesa, el backend responde 409. |
| 8 | Solapamiento con otra hora | Reservá la mesa 4 a las 21:00 e intentá reservarla a las 21:30 | Rechazado: 21:00–22:30 y 21:30–23:00 se superponen. |
| 9 | Reserva como invitado | Hacé una reserva sin iniciar sesión | Funciona, con aviso de que al crear la cuenta con ese email la vas a ver en "Mis reservas". |
| 10 | Registrarse | `http://localhost:5173/registro` | Entra a `/mis-reservas`. |
| 11 | Ver mis reservas | `/mis-reservas` | Lista con número, fecha, hora, mesa, personas, estado y observaciones. |
| 12 | Cancelar reserva | Botón **Cancelar** en una reserva pendiente | Confirmación; la mesa queda liberada. |

### Como administrador

Iniciá sesión con la cuenta promovida en el [paso 12](#12-crear-el-usuario-administrador).

| # | Qué probar | Dónde | Resultado esperado |
| - | ---------- | ----- | ------------------ |
| 13 | Dashboard | `/admin` | 5 tarjetas: reservas de hoy, mesas ocupadas, mesas disponibles, clientes registrados, facturación del día. Todo calculado en SQL. |
| 14 | Cambiar la fecha | Selector de fecha del dashboard | Las métricas se recalculan para ese día. |
| 15 | Filtros de reservas | `/admin/reservas` | Filtrá por fecha, estado y cliente. |
| 16 | Acción Ver | Botón **Ver** | Modal con todos los datos de la reserva. |
| 17 | Acción Editar | Botón **Editar** | Permite cambiar fecha, hora, mesa y personas. **Si la nueva franja se superpone, el backend lo rechaza con un mensaje claro.** |
| 18 | Confirmar / Cancelar / Completar | Acciones de la tabla | Cambian el estado. Las transiciones inválidas se rechazan (ej. completar una cancelada). |
| 19 | Crear mesa | `/admin/mesas` → **Crear mesa** | Se agrega a la grilla. Número duplicado → 409. |
| 20 | Cambiar estado de mesa | Botón **Mantenimiento / Reactivar** | La mesa deja de admitir reservas. |
| 21 | **Proteger el borrado** | Intentá eliminar una mesa con reservas activas | *"No se puede eliminar la mesa: tiene N reserva(s) sin resolver..."* |
| 22 | Estado del salón | Selector "Ver salón a las" | Grilla con cada mesa en verde (libre) o rojo (ocupada) y el horario de la reserva. |
| 23 | Clientes | `/admin/clientes` | Listado con cantidad de reservas. Botón **Historial** abre el detalle. |
| 24 | Editar cliente | `/admin/clientes` | Alta, edición y baja. Con historial, el borrado se bloquea. |
| 25 | Gestionar menú | `/admin/menu` | Crear, editar, activar/desactivar y eliminar platos. Crear y editar categorías. |
| 26 | Borrar plato con pedidos | Intentá borrar un plato que ya fue pedido | Se **desactiva** en lugar de eliminarse, para no romper el histórico. |
| 27 | Estadísticas | `/admin/estadisticas` | Reservas por día, por estado, horarios más demandados, mesas más utilizadas, facturación por mes, plato más solicitado, top 10 platos y clientes frecuentes. |
| 28 | Cambiar período | Botones de rango (7 / 30 / 90 días / 1 año) | Todos los informes se recalculan. |

### Probar la regla fundamental directamente en SQL

`database/queries.sql` incluye la sección **16. Probar la regla fundamental**.
Ejecutala dentro de una transacción: el segundo `INSERT` debe fallar con el error
`23P01 (exclusion_violation)`.

---

## 14. API REST

Todas las respuestas usan una envoltura consistente:

```jsonc
// Éxito
{ "success": true, "data": { }, "meta": { } }

// Error
{ "success": false, "message": "Descripción del error", "detalles": { } }
```

### Autenticación

| Método | Ruta | Acceso | Descripción |
| ------ | ---- | ------ | ----------- |
| `POST` | `/api/auth/register` | Público | Crea la cuenta (rol `cliente`) y devuelve la sesión |
| `POST` | `/api/auth/login` | Público | Inicia sesión |
| `POST` | `/api/auth/renovar` | Público | Renueva la sesión con el `refreshToken` |
| `GET` | `/api/auth/me` | Autenticado | Perfil del usuario autenticado |
| `PUT` | `/api/auth/me` | Autenticado | Actualiza el nombre |
| `POST` | `/api/auth/logout` | Autenticado | Cierra la sesión |

### Clientes

| Método | Ruta | Acceso |
| ------ | ---- | ------ |
| `GET` | `/api/clientes` | Admin |
| `GET` | `/api/clientes/:id` | Admin |
| `POST` | `/api/clientes` | Admin |
| `PUT` | `/api/clientes/:id` | Admin |
| `DELETE` | `/api/clientes/:id` | Admin |
| `GET` | `/api/clientes/:id/reservas` | Admin |

### Mesas

| Método | Ruta | Acceso |
| ------ | ---- | ------ |
| `GET` | `/api/mesas` | Público |
| `GET` | `/api/mesas/:id` | Público |
| `GET` | `/api/mesas/disponibles?fecha=&hora=&personas=` | Público |
| `GET` | `/api/mesas/estado-salon?fecha=&hora=` | Público |
| `POST` | `/api/mesas` | Admin |
| `PUT` | `/api/mesas/:id` | Admin |
| `DELETE` | `/api/mesas/:id` | Admin |

### Reservas

| Método | Ruta | Acceso |
| ------ | ---- | ------ |
| `GET` | `/api/reservas` | Autenticado (cliente: sólo las suyas) |
| `GET` | `/api/reservas/:id` | Autenticado (dueño o admin) |
| `GET` | `/api/reservas/mias` | Autenticado |
| `GET` | `/api/reservas/hoy` | Autenticado |
| `GET` | `/api/reservas/codigo/:codigo` | Autenticado |
| `POST` | `/api/reservas` | Público (reserva de invitado) |
| `PUT` | `/api/reservas/:id` | Dueño o admin |
| `DELETE` | `/api/reservas/:id` | Dueño o admin |
| `PUT` | `/api/reservas/:id/confirmar` | Admin |
| `PUT` | `/api/reservas/:id/cancelar` | Dueño o admin |
| `PUT` | `/api/reservas/:id/completar` | Admin |

### Platos y categorías

| Método | Ruta | Acceso |
| ------ | ---- | ------ |
| `GET` | `/api/platos` | Público |
| `GET` | `/api/platos/:id` | Público |
| `POST` | `/api/platos` | Admin |
| `PUT` | `/api/platos/:id` | Admin |
| `DELETE` | `/api/platos/:id` | Admin |
| `GET` | `/api/categorias` | Público |
| `GET` | `/api/categorias/:id` | Público |
| `POST` | `/api/categorias` | Admin |
| `PUT` | `/api/categorias/:id` | Admin |
| `DELETE` | `/api/categorias/:id` | Admin |

### Estadísticas

| Método | Ruta | Acceso | Descripción |
| ------ | ---- | ------ | ----------- |
| `GET` | `/api/estadisticas/horarios` | Público | Turnos y horarios válidos |
| `GET` | `/api/estadisticas/dashboard` | Admin | Métricas del día |
| `GET` | `/api/estadisticas/reservas` | Admin | Reservas por día, mes, estado y hora |
| `GET` | `/api/estadisticas/mesas` | Admin | Mesas más utilizadas |
| `GET` | `/api/estadisticas/clientes` | Admin | Clientes atendidos y top |
| `GET` | `/api/estadisticas/ventas` | Admin | Facturación y platos más vendidos |
| `GET` | `/api/estadisticas/salon` | Admin | Estado del salón |

---

## 15. Modelo de datos

```
        ┌──────────────┐        ┌──────────────┐
        │    usuarios  │1──────n│   clientes   │
        │  (Auth)      │        │              │
        │ id, rol      │        │ usuario_id   │
        └──────────────┘        └──────┬───────┘
                                      │1
                                      │
                                      │n
                               ┌──────┴───────┐        ┌──────────────┐
                               │   reservas   │───────1│    mesas     │
                               │  codigo      │        │ numero (único)│
                               │ fecha, hora  │        └──────────────┘
                               │ estado       │
                               └──────┬───────┘
                                      │1
                                      │n
                               ┌──────┴───────┐
                               │    pedidos   │
                               │    total     │
                               └──────┬───────┘
                                      │1
                                      │n
                               ┌──────┴───────────────┐        ┌──────────────┐
                               │    detalle_pedido    │───────n│    platos   │
                               │ cantidad, subtotal   │        │ precio ≥ 0   │
                               └──────────────────────┘        └──────┬───────┘
                                                                      │n
                                                               ┌──────┴───────┐
                                                               │  categorias  │
                                                               └──────────────┘
```

### Tablas

| Tabla | Campos | Restricciones clave |
| ----- | ------ | ------------------- |
| `usuarios` | `id`, `nombre`, `email`, `password_hash`, `rol`, `created_at` | `email` único, `rol ∈ (admin, cliente)`, FK a `auth.users` |
| `clientes` | `id`, `usuario_id`, `nombre`, `apellido`, `email`, `telefono`, `created_at` | `email` único, formato de email y teléfono |
| `mesas` | `id`, `numero`, `capacidad`, `ubicacion`, `estado`, `created_at` | `numero` único, `capacidad > 0`, `estado ∈ (disponible, mantenimiento)` |
| `reservas` | `id`, `codigo`, `cliente_id`, `mesa_id`, `fecha`, `hora`, `personas`, `estado`, `observaciones`, `created_at` | `personas > 0`, `EXCLUDE` de no solapamiento, 3 triggers |
| `categorias` | `id`, `nombre`, `descripcion` | `nombre` único |
| `platos` | `id`, `categoria_id`, `nombre`, `descripcion`, `precio`, `imagen_url`, `disponible`, `created_at` | `precio >= 0`, único por categoría |
| `pedidos` | `id`, `reserva_id`, `cliente_id`, `estado`, `total`, `created_at` | `total >= 0` |
| `detalle_pedido` | `id`, `pedido_id`, `plato_id`, `cantidad`, `precio_unitario`, `subtotal` | `cantidad > 0`, `subtotal = cantidad × precio_unitario` |

> ℹ️ **`usuarios.password_hash`**
> La columna existe porque forma parte del modelo solicitado, pero **permanece
> siempre en `NULL`**. Las credenciales las gestiona Supabase Auth, que almacena
> hashes bcrypt. El backend nunca escribe contraseñas. En ningún punto del sistema
> hay contraseñas en texto plano.

---

## 16. La regla fundamental de reservas

> **Una mesa no puede tener dos reservas superpuestas.**

Cada reserva ocupa su mesa durante **90 minutos** (`fn_duracion_reserva()`).
Dos reservas se solapan si sus intervalos `[inicio, fin)` se intersecan.

Ejemplo: mesa 4, 15/09/2026, 21:00 → ocupa de 21:00 a 22:30.
Una reserva a las 21:30 **no** es posible (se superpone).
Una reserva a las 22:30 **sí** es posible (empieza justo al terminar).

### Tres capas de protección

| # | Capa | Mecanismo | Archivo |
| - | ---- | --------- | ------- |
| 1 | **Frontend** | Al buscar, pide sólo las mesas libres | `pages/Reservar.jsx` |
| 2 | **Backend** | `fn_mesas_disponibles()` y `fn_reservas_conflictantes()` antes de leer y de escribir | `services/mesaService.js`, `services/reservaService.js` |
| 3 | **Base de datos** | `EXCLUDE USING gist` + trigger | `database/schema.sql` |

```sql
-- Capa 3: garantía a nivel de motor. Ningún INSERT puede saltarla.
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_franja_no_superpuesta
  EXCLUDE USING gist (
    mesa_id           WITH =,
    fecha             WITH =,
    tsrange(franja_inicio, franja_fin, '[)') WITH &&
  )
  WHERE (estado IN ('pendiente', 'confirmada'));
```

Además, la base de datos valida **capacidad**, **formato de fecha/hora** y genera el
**código de reserva** automáticamente mediante triggers.

> La regla **no se confía en el frontend**: si alguien invoca el `POST /api/reservas`
> directamente con `curl` e intenta duplicar una franja, el backend devuelve:
> ```json
> { "success": false,
>   "message": "La mesa seleccionada ya fue reservada para ese horario. Elegí otra mesa u otro horario." }
> ```

---

## 17. Horarios

| Turno | Horario | Inicios de reserva válidos |
| ----- | ------- | -------------------------- |
| Almuerzo | 11:00 – 15:00 | `11:00`, `12:30` |
| Cena | 18:00 – 23:00 | `18:00`, `19:30`, `21:00` |

Se atiende **todos los días** (lunes a domingo).

La grilla se genera automáticamente: desde la apertura del turno, en pasos de
`duracionMinutos`, incluyendo sólo los horarios cuya reserva termina antes o justo
al cierre. Por eso `13:30` no aparece en el almuerzo (13:30 + 90 = 15:30 > 15:00).

### Cambiar la configuración

Todo está en **`backend/config/horarios.js`**:

```js
const HORARIOS = {
  duracionMinutos: 90,
  diasAtencion: [0, 1, 2, 3, 4, 5, 6],
  turnos: [
    { nombre: 'Almuerzo', inicio: '11:00', fin: '15:00' },
    { nombre: 'Cena',     inicio: '18:00', fin: '23:00' },
  ],
  anticipacionMaximaDias: 90,
};
```

> Si además querés cambiar la duración, actualizá **también** la función
> `fn_duracion_reserva()` en `database/schema.sql`. Al arrancar, el backend **compara
> ambos valores y se niega a iniciar si no coinciden** — es una salvaguarda para que la
> regla de no solapamiento no difiera entre la API y el motor de base de datos.

El frontend **no duplica** esta configuración: la pide a `GET /api/estadisticas/horarios`
al cargar el formulario de reserva, con un valor de respaldo por si la API falla.

---

## 18. Seguridad

| Medida | Dónde |
| ------ | ----- |
| Contraseñas gestionadas por Supabase Auth (bcrypt) | `services/authService.js` |
| El frontend **nunca** habla con Supabase | `services/api.js` |
| Claves sólo en el backend (`.env` en `.gitignore`) | `backend/.env.example` |
| Token JWT verificado contra Supabase en cada petición | `middleware/authMiddleware.js` |
| ROL leído de la base de datos, nunca del token del cliente | `middleware/authMiddleware.js` |
| Rutas administrativas bloqueadas en el **backend** | `middleware/adminMiddleware.js` |
| Un cliente no puede tocar reservas de otro cliente | `services/reservaService.js` |
| Validación de **todas** las entradas en el servidor | `utils/validators.js` |
| Restricciones `CHECK`, `FOREIGN KEY` y `EXCLUDE` | `database/schema.sql` |
| CORS con lista blanca de orígenes | `app.js` |
| `helmet` (cabeceras de seguridad) | `app.js` |
| Límite de intentos en login y registro | `routes/authRoutes.js` |
| Límite de 100 kB en el cuerpo de las peticiones | `app.js` |
| Row Level Security activo: las tablas son inaccesibles sin la API | `database/schema.sql` |
| Errores internos registrados en el servidor, nunca enviados al cliente | `middleware/errorMiddleware.js` |
| Consultas parametrizadas vía `supabase-js` (no hay SQL concatenado) | `database/supabase.js` |

### RLS y por qué el frontend no necesita la `anon key`

Todas las tablas tienen `ROW LEVEL SECURITY` habilitado **y ninguna política pública**.
Eso significa que `anon` y `authenticated` no pueden leer ni escribir nada
directamente. Únicamente la `service_role`, que se usa sólo en el backend, ignora RLS
por diseño. Resultado: **ni siquiera filtrando la clave anónima se puede saltarse la
API REST.**

### Valores de entorno: dónde va cada clave

| Variable | ¿Va en el frontend? | Motivo |
| -------- | ------------------- | ------ |
| `SUPABASE_URL` | ❌ No | Sólo el backend la necesita |
| `SUPABASE_ANON_KEY` | ❌ No | Se usa internamente para Supabase Auth. El frontend no llama a Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **Nunca** | Privilegios totales sobre la base de datos |
| `VITE_API_URL` | ✅ Sí | Es la URL pública del backend |

> 🔴 Cualquier variable con prefijo `VITE_` se compila dentro del bundle de JavaScript
> y es **visible para cualquiera**. Jamás pongas una clave sensible ahí.

---

## 19. Variables de entorno

### `backend/.env`

| Variable | Obligatoria | Por defecto | Descripción |
| -------- | ----------- | ----------- | ----------- |
| `SUPABASE_URL` | ✅ | — | Project URL |
| `SUPABASE_ANON_KEY` | ✅ | — | Clave pública (uso interno para Auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Clave de servicio (**secreta**) |
| `PORT` | | `3000` | Puerto de la API |
| `NODE_ENV` | | `development` | `development` / `production` |
| `CORS_ORIGIN` | | `localhost:5173,127.0.0.1:5173,localhost:4173` | Orígenes permitidos |
| `RESTAURANTE_NOMBRE` | | `Restaurante La Reserva` | Nombre del restaurante |
| `RESTAURANTE_DIRECCION` | | `Av. Corrientes 1234, Buenos Aires` | Dirección |
| `RESTAURANTE_TELEFONO` | | `+54 11 5555 0000` | Teléfono |
| `RESTAURANTE_EMAIL` | | `reservas@larestaurante.com` | Email de contacto |
| `RESERVA_DURACION_MIN` | | `90` | Duración de la reserva (debe coincidir con SQL) |
| `RESERVA_ANTICIPACION_MAX_DIAS` | | `90` | Días máximos de anticipación |
| `LIMITE_RESERVAS_POR_FRANJA` | | `40` | Tope de reservas por fecha y hora |
| `RATE_LIMIT_LOGIN_MAX` | | `20` | Intentos de login por ventana |
| `RATE_LIMIT_LOGIN_VENTANA_MIN` | | `15` | Tamaño de la ventana, en minutos |

### `frontend/.env`

| Variable | Obligatoria | Por defecto | Descripción |
| -------- | ----------- | ----------- | ----------- |
| `VITE_API_URL` | | `http://localhost:3000` | URL base de la API REST |

---

## 20. Estructura del proyecto

```
restaurant-reservation-system/
│
├── .vscode/                     Configuración de VS Code
│   ├── extensions.json
│   ├── launch.json              F5: depurar backend y frontend
│   ├── settings.json
│   └── tasks.json               Ctrl+Shift+B: iniciar todo
│
├── .gitignore
├── package.json                 Workspaces: `npm run dev` levanta todo
├── README.md
│
├── database/
│   ├── schema.sql               Tablas, FK, CHECK, índices, triggers, vistas, funciones
│   ├── seed.sql                 Datos de prueba
│   ├── queries.sql              16 consultas SQL documentadas
│   └── promote_admin.sql        Convierte un usuario en administrador
│
├── backend/
│   ├── app.js                   Configuración de Express (CORS, helmet, JSON, rutas)
│   ├── server.js                Arranque y comprobaciones de dependencias
│   ├── package.json
│   ├── .env.example
│   │
│   ├── config/
│   │   ├── index.js             Configuración y validación de variables de entorno
│   │   └── horarios.js          ⭐ Turnos, duración de reserva, grilla de horarios
│   │
│   ├── controllers/             Traducen HTTP ↔ servicio
│   │   ├── authController.js
│   │   ├── clienteController.js
│   │   ├── mesaController.js
│   │   ├── reservaController.js
│   │   ├── platoController.js
│   │   ├── categoriaController.js
│   │   └── estadisticaController.js
│   │
│   ├── routes/
│   │   ├── index.js             Montaje de todos los módulos + /api/health
│   │   ├── authRoutes.js
│   │   ├── clienteRoutes.js
│   │   ├── mesaRoutes.js
│   │   ├── reservaRoutes.js
│   │   ├── platoRoutes.js
│   │   ├── categoriaRoutes.js
│   │   └── estadisticaRoutes.js
│   │
│   ├── services/                ⭐ Toda la lógica de negocio y el acceso a datos
│   │   ├── authService.js
│   │   ├── reservaService.js
│   │   ├── mesaService.js
│   │   ├── clienteService.js
│   │   ├── platoService.js
│   │   └── estadisticaService.js
│   │
│   ├── database/
│   │   └── supabase.js          ⭐ ÚNICO punto de conexión con Supabase
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js    Verifica token + carga el rol
│   │   ├── adminMiddleware.js   Autorización administrativa
│   │   ├── notFoundMiddleware.js
│   │   └── errorMiddleware.js   Política de mensajes de error
│   │
│   └── utils/
│       ├── HttpError.js         Errores con código HTTP
│       ├── asyncHandler.js      Wrap de handlers async
│       ├── respuestas.js        Envoltura { success, data }
│       ├── validators.js        ⭐ Validación de entradas (espejo del frontend)
│       └── consistencia.js      Verificación de coherencia Node.js ↔ SQL
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── .env.example
    │
    └── src/
        ├── main.jsx              Punto de entrada
        ├── App.jsx               Enrutador
        │
        ├── context/
        │   └── AuthContext.jsx   Sesión, login, logout, roles
        │
        ├── services/
        │   └── api.js            ⭐ Cliente HTTP: token, errores, reintento
        │
        ├── utils/
        │   ├── validation.js      Validaciones del frontend
        │   ├── format.js          Fechas, precios, estados
        │   └── horarios.js        Horarios obtenidos del backend
        │
        ├── components/            Componentes reutilizables
        │   ├── Navbar.jsx
        │   ├── Footer.jsx
        │   ├── AdminLayout.jsx
        │   ├── ProtectedRoute.jsx
        │   ├── Button.jsx
        │   ├── Input.jsx          (+ `Select`)
        │   ├── Card.jsx
        │   ├── Table.jsx
        │   ├── Modal.jsx          (+ `ModalAcciones`)
        │   ├── MesaCard.jsx
        │   ├── ReservaCard.jsx
        │   ├── PlatoCard.jsx
        │   ├── StatCard.jsx
        │   ├── StatusBadge.jsx
        │   ├── Loading.jsx
        │   ├── ErrorMessage.jsx
        │   ├── SuccessMessage.jsx
        │   └── EmptyState.jsx
        │
        ├── pages/                 13 páginas
        │   ├── Home.jsx
        │   ├── Menu.jsx
        │   ├── Reservar.jsx
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── MisReservas.jsx
        │   ├── AdminDashboard.jsx
        │   ├── AdminReservas.jsx
        │   ├── AdminMesas.jsx
        │   ├── AdminClientes.jsx
        │   ├── AdminMenu.jsx
        │   ├── AdminEstadisticas.jsx
        │   └── NotFound.jsx
        │
        └── styles/                CSS propio, sin frameworks
            ├── global.css         Design system, botones, formularios, tablas, modales
            ├── navbar.css
            ├── menu.css
            ├── reservas.css
            └── admin.css
```

### Arquitectura

```
┌──────────────────────────────┐
│  React (Vite)  :5173         │   No habla NUNCA con la base de datos
│  - pages / components        │
│  - services/api.js           │──┐
└──────────────────────────────┘  │
                                │  HTTP  +  JSON
                                │  Authorization: Bearer <JWT>
┌──────────────────────────────▼─┐
│  Node.js + Express  :3000      │   Valida · autoriza · calcula
│  routes → controllers →       │
│  services (lógica de negocio) │
│         │                     │
│         │  @supabase/supabase-js
└─────────┼─────────────────────┘
          │  SERVICE ROLE (secreto, sólo backend)
┌─────────▼─────────────────────┐
│  Supabase · PostgreSQL 15     │   CHECK · FK · EXCLUDE · triggers
│  8 tablas · 3 vistas · 14 fn  │
└───────────────────────────────┘
```

**Reglas de la arquitectura**

1. Ningún componente React hace consultas SQL.
2. `backend/database/supabase.js` es el **único** archivo que crea clientes de Supabase.
3. Los controladores no contienen lógica de negocio.
4. Los servicios no conocen `req` ni `res`.
5. Ninguna variable de entorno del backend llega al navegador.

---

## 21. Ejecución desde Visual Studio Code

La carpeta `.vscode/` ya está configurada.

### Opción 1 — Un solo comando

`Ctrl+Shift+B` (o **Terminal → Ejecutar tarea de compilación**)
→ tarea **"Dev: iniciar backend y frontend"**.

### Opción 2 — Depuración con puntos de corte

1. Abrí la pestaña **Ejecutar y depurar** (`Ctrl+Shift+D`).
2. Elegí una configuración:
   - **Sistema completo (API + web)** — levanta backend y frontend con debugger.
   - **API Express (backend)** — sólo la API.
   - **App React (frontend)** — sólo el frontend.
3. `F5`.

### Opción 3 — terminals separados

`Ctrl+` `` ` `` abre el terminal integrado. Usá dos:

```bash
# Terminal 1
cd backend && npm run dev
```

```bash
# Terminal 2
cd frontend && npm run dev
```

> El botón **Run ▶️** de VS Code detecta `package.json` y ofrece ejecutar y depurar
> cada `script` del `package.json` sin configurar nada.

---

## 22. Solución de problemas

<details>
<summary><strong>"Faltan las siguientes variables de entorno"</strong></summary>

Copiá `backend/.env.example` a `backend/.env` y completá las tres claves de Supabase
(paso 7). Sin ellas el backend se detiene a propósito, en lugar de fallar en la
primera petición.
</details>

<details>
<summary><strong>"No se pudo conectar con Supabase"</strong></summary>

- Verificá `SUPABASE_URL` (tiene que empezar por `https://` y terminar en `.supabase.co`).
- Verificá que las claves no tengan comillas ni espacios.
- Comprobá que ejecutaste `database/schema.sql` (si no, falla la función `fn_duracion_reserva`).
</details>

<details>
<summary><strong>"La base de datos no está preparada. Ejecutá database/schema.sql"</strong></summary>

Faltan las tablas o las funciones. Abrí Supabase → SQL Editor y ejecutá
`database/schema.sql`, después `database/seed.sql`.
</details>

<details>
<summary><strong>"No hay mesas disponibles" en todas las fechas</strong></summary>

Probá con menos personas. Además, el seed genera reservas para los próximos 7 días:
con 10 mesas y ~11 reservas diarias, algunos horarios quedan agotados. Reservá con
más anticipación o agregá mesas desde `/admin/mesas`.
</details>

<details>
<summary><strong>Error de CORS en la consola del navegador</strong></summary>

El puerto del frontend no está en la lista blanca. Verificá que el frontend corra en
`5173` o `4173`, o agregá tu origen a `CORS_ORIGIN` en `backend/.env` y reiniciá.
</details>

<details>
<summary><strong>El login dice "Email o contraseña incorrectos" pero la cuenta existe</strong></summary>

- En Supabase → *Authentication → Providers → Email*, verificá que **"Confirm email"**
  esté desactivado.
- Verificá que la fila exista en `public.usuarios`:
  `SELECT email, rol FROM public.usuarios;`
- Si la cuenta quedó huérfana, borrala en Supabase → *Authentication → Users* y
  registrate de nuevo.
</details>

<details>
<summary><strong>El administrador no puede acceder a /admin</strong></summary>

1. Confirmá que ejecutaste `database/promote_admin.sql` con el email correcto.
2. Verificá: `SELECT email, rol FROM public.usuarios WHERE rol = 'admin';`
3. **Cerrá sesión y volvé a entrar**: el rol se lee del token al iniciar sesión.
</details>

<details>
<summary><strong>"Configuración incoherente: la reserva dura X minutos..."</strong></summary>

`RESERVA_DURACION_MIN` en `backend/.env` no coincide con `fn_duracion_reserva()` en
`database/schema.sql`. Ajustá uno de los dos (el script avisa al arrancar para evitar
que la regla de no solapamiento difiera entre la API y el motor).
</details>

<details>
<summary><strong>El backend no reinicia al guardar un archivo</strong></summary>

`npm run dev` usa `nodemon`. Si no detecta cambios, reiniciá manualmente con `Ctrl+C`
y volvé a ejecutar el comando.
</details>

<details>
<summary><strong>Las imágenes de los platos no cargan</strong></summary>

Es normal: `seed.sql` usa rutas de ejemplo (`/img/platos/pizza.jpg`). Si no existe el
archivo, la tarjeta muestra la inicial del plato. Para usar imágenes reales, cambiá
`imagen_url` por URLs públicas, por ejemplo:
```sql
UPDATE public.platos SET imagen_url = 'https://images.unsplash.com/photo-xxxx?w=800' WHERE nombre = 'Pizza';
```
</details>

---

## 🎓 Créditos y notas finales

Proyecto educativo de **bases de datos y desarrollo web**, pensado para demostrar:

- Diseño relacional normalizado con claves primarias, foráneas, `CHECK` y vistas.
- Una regla de negocio crítica garantizada **hasta por el motor de la base de datos**
  (`EXCLUDE USING gist`), no sólo por la aplicación.
- Separación de responsabilidades en capas: rutas → controladores → servicios → datos.
- Validación en las tres capas (frontend, backend y base de datos).
- Autenticación y autorización con Supabase Auth + verificación de rol en el backend.
- Cálculo de métricas en SQL (`COUNT`, `SUM`, `AVG`, `GROUP BY`, `HAVING`, `JOIN`,
  subconsultas, `FILTER`, `LATERAL`) en lugar de en el navegador.
- CSS propio y responsive, sin frameworks de estilos.

### Consultas SQL documentadas

`database/queries.sql` contiene 16 consultas anotadas, entre ellas:

1. Obtener reservas de un día
2. Obtener mesas disponibles (con `OVERLAPS`)
3. Obtener reservas de un cliente
4. Cantidad de reservas por día
5. Mesas más utilizadas
6. Cantidad de clientes atendidos
7. Facturación total
8. Facturación por mes
9. Plato más vendido
10. Cantidad de reservas por estado
11. Clientes con mayor cantidad de reservas
12. Horarios con mayor cantidad de reservas
13. Tasa de conversión
14. Mesas nunca reservadas (`LEFT JOIN ... IS NULL`)
15. Verificación de que no existan reservas superpuestas
16. Prueba de la regla fundamental

---

<div align="center">

**Hecho con React · Node.js · Express · Supabase**

</div>
