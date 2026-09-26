/**
 * Rutas de clientes. TODAS requieren rol administrador.
 * Montadas en /api/clientes
 */

const { Router } = require('express');
const controller = require('../controllers/clienteController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = Router();

// `router.use` aplica el middleware a todas las rutas de este archivo.
router.use(authMiddleware.autenticar);
router.use(adminMiddleware.soloAdmin);

router.get('/', controller.listar);
router.post('/', controller.crear);
router.get('/:id', controller.obtener);
router.get('/:id/reservas', controller.reservas);
router.put('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
