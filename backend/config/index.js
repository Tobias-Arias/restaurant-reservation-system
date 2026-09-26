const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Configuración centralizada de la aplicación.
 *
 * Se lee una única vez al arrancar el servidor y se valida de forma estricta:
 * si falta una variable obligatoria el proceso muere con un mensaje claro en
 * lugar de fallar en la primera petición.
 */

const requeridas = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

const faltantes = requeridas.filter((clave) => !process.env[clave]);
if (faltantes.length > 0) {
  console.error('\n[config] Faltan las siguientes variables de entorno:');
  faltantes.forEach((clave) => console.error(`   - ${clave}`));
  console.error('\n[config] Copia backend/.env.example a backend/.env y completalo.\n');
  process.exit(1);
}

const toInt = (valor, porDefecto) => {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : porDefecto;
};

const lista = (valor, porDefecto) =>
  valor
    ? valor
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : porDefecto;

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  // Orígenes permitidos por CORS (frontend en desarrollo).
  corsOrigins: lista(process.env.CORS_ORIGIN, [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
  ]),

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // Datos del restaurante expuestos en la API pública.
  restaurante: {
    nombre: process.env.RESTAURANTE_NOMBRE || 'Restaurante La Reserva',
    descripcion:
      process.env.RESTAURANTE_DESCRIPCION ||
      'Cocina de autor, producto de temporada y un salón cálido en el corazón de la ciudad.',
    direccion: process.env.RESTAURANTE_DIRECCION || 'Av. Corrientes 1234, Buenos Aires',
    telefono: process.env.RESTAURANTE_TELEFONO || '+54 11 5555 0000',
    email: process.env.RESTAURANTE_EMAIL || 'reservas@larestaurante.com',
  },

  // Límite de intentos de inicio de sesión (protección contra fuerza bruta).
  rateLimit: {
    loginMax: toInt(process.env.RATE_LIMIT_LOGIN_MAX, 20),
    loginVentanaMin: toInt(process.env.RATE_LIMIT_LOGIN_VENTANA_MIN, 15),
  },

  // Máximo de reservas simultáneas admitidas en una misma franja de tiempo.
  limiteReservasPorFranja: toInt(process.env.LIMITE_RESERVAS_POR_FRANJA, 40),
};
