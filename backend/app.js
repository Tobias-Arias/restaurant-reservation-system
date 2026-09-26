/**
 * Configuración de la aplicación Express.
 *
 * Separado de server.js a propósito: app.js construye y exporta la app
 * (testeable sin abrir un puerto) y server.js se ocupa de escuchar.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const rutas = require('./routes');
const HttpError = require('./utils/HttpError');
const { rutaNoEncontrada } = require('./middleware/notFoundMiddleware');
const { manejadorErrores } = require('./middleware/errorMiddleware');

const app = express();

// ----------------------------------------------------------------------------
// 1. Cabeceras de seguridad
//    helmet activa por defecto cabeceras como X-Content-Type-Options, CSP,
//    X-Frame-Options, etc. Se desactiva `contentSecurityPolicy` porque el
//    backend sólo sirve JSON y la política por defecto puede interferir con
//    los clientes.
// ----------------------------------------------------------------------------
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// ----------------------------------------------------------------------------
// 2. CORS: sólo los orígenes declarados en CORS_ORIGIN pueden llamar a la API.
// ----------------------------------------------------------------------------
app.use(
  cors({
    origin(origin, callback) {
      // Peticiones sin Origin (curl, Postman, health checks) se permiten.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, 'Este origen no tiene permiso para acceder a la API.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 86_400,
  })
);

// ----------------------------------------------------------------------------
// 3. Límite de tamaño del cuerpo: las reservas no necesitan payloads grandes.
// ----------------------------------------------------------------------------
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ----------------------------------------------------------------------------
// 4. Registro de peticiones (silencioso en producción).
// ----------------------------------------------------------------------------
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// ----------------------------------------------------------------------------
// 5. Raíz con información del servicio.
// ----------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      nombre: config.restaurante.nombre,
      descripcion: config.restaurante.descripcion,
      direccion: config.restaurante.direccion,
      telefono: config.restaurante.telefono,
      documentacion: '/api/health',
    },
  });
});

// ----------------------------------------------------------------------------
// 6. API REST
// ----------------------------------------------------------------------------
app.use('/api', rutas);

// ----------------------------------------------------------------------------
// 7. 404 y manejador de errores (SIEMPRE al final).
// ----------------------------------------------------------------------------
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
