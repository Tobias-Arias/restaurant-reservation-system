/**
 * Rutas de estadísticas y dashboard. Montadas en /api/estadisticas
 *
 * TODO requiere rol administrador, EXCEPTO /horarios, que es público porque
 * el formulario de reserva del cliente necesita conocer los turnos válidos
 * antes de iniciar sesión.
 */

const { Router } = require('express');
const controller = require('../controllers/estadisticaController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = Router();

// Público: configuración de horarios de atención.
router.get('/horarios', controller.horarios);

// Resto: sólo administradores.
router.use(authMiddleware.autenticar, adminMiddleware.soloAdmin);

router.get('/dashboard', controller.dashboard);
router.get('/reservas', controller.reservas);
router.get('/mesas', controller.mesas);
router.get('/clientes', controller.clientes);
router.get('/ventas', controller.ventas);
router.get('/salon', controller.salon);

module.exports = router;
