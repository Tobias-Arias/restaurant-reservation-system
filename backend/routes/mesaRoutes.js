/**
 * Rutas de mesas. Montadas en /api/mesas
 *
 * Público      : GET / , GET /:id , GET /disponibles , GET /estado-salon
 * Administrador: POST / , PUT /:id , DELETE /:id
 *
 * `/disponibles` y `/estado-salon` se declaran antes que `/:id` para que
 * Express no los tome por un identificador.
 */

const { Router } = require('express');
const controller = require('../controllers/mesaController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = Router();

router.get('/disponibles', controller.disponibles);
router.get('/estado-salon', controller.estadoSalon);
router.get('/', controller.listar);
router.get('/:id', controller.obtener);

router.post('/', authMiddleware.autenticar, adminMiddleware.soloAdmin, controller.crear);
router.put('/:id', authMiddleware.autenticar, adminMiddleware.soloAdmin, controller.actualizar);
router.delete('/:id', authMiddleware.autenticar, adminMiddleware.soloAdmin, controller.eliminar);

module.exports = router;
