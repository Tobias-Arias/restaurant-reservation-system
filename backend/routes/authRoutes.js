/**
 * Rutas de autenticación.
 * Montadas en /api/auth
 */

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const config = require('../config');

const router = Router();

// Protección contra fuerza bruta en los endpoints de credenciales.
const limitador = rateLimit({
  windowMs: config.rateLimit.loginVentanaMin * 60 * 1000,
  max: config.rateLimit.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos. Esperá unos minutos antes de volver a intentar.',
  },
});

router.post('/register', limitador, authMiddleware.rechazarSiAutenticado, controller.registrar);
router.post('/login', limitador, authMiddleware.rechazarSiAutenticado, controller.login);
router.post('/renovar', limitador, controller.renovar);
router.get('/me', authMiddleware.autenticar, controller.yo);
router.put('/me', authMiddleware.autenticar, controller.actualizarPerfil);
router.post('/logout', authMiddleware.autenticar, controller.logout);

module.exports = router;
