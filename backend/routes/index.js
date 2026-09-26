/**
 * Router raíz de la API.
 *
 * Centraliza el montaje de todos los módulos y expone /api/health, que sirve
 * para comprobar que el backend está vivo y que la conexión con Supabase
 * funciona (sin exponer ninguna credencial).
 */

const { Router } = require('express');
const db = require('../database/supabase');
const config = require('../config');
const authRoutes = require('./authRoutes');
const clienteRoutes = require('./clienteRoutes');
const mesaRoutes = require('./mesaRoutes');
const reservaRoutes = require('./reservaRoutes');
const platoRoutes = require('./platoRoutes');
const categoriaRoutes = require('./categoriaRoutes');
const estadisticaRoutes = require('./estadisticaRoutes');

const router = Router();

const inicio = Date.now();

/** GET /api/health */
router.get('/health', async (_req, res) => {
  let baseDeDatos = 'desconocida';
  try {
    const { error } = await db.admin.from('mesas').select('id').limit(1);
    baseDeDatos = error ? 'sin_conexion' : 'conectada';
  } catch {
    baseDeDatos = 'sin_conexion';
  }

  res.json({
    success: true,
    data: {
      servicio: config.restaurante.nombre,
      entorno: config.env,
      uptimeSegundos: Math.round((Date.now() - inicio) / 1000),
      baseDeDatos,
      servidor: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/clientes', clienteRoutes);
router.use('/mesas', mesaRoutes);
router.use('/reservas', reservaRoutes);
router.use('/platos', platoRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/estadisticas', estadisticaRoutes);

module.exports = router;
