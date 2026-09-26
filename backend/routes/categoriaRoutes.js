/**
 * Rutas de categorías del menú. Montadas en /api/categorias
 * Público: GET / y GET /:id  ·  Administrador: el resto
 */

const { Router } = require('express');
const controller = require('../controllers/categoriaController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtener);

router.post('/', authMiddleware.autenticar, adminMiddleware.soloAdmin, controller.crear);
router.put('/:id', authMiddleware.autenticar, adminMiddleware.soloAdmin, controller.actualizar);
router.delete('/:id', authMiddleware.autenticar, adminMiddleware.soloAdmin, controller.eliminar);

module.exports = router;
