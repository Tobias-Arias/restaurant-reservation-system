/**
 * Rutas de reservas. Montadas en /api/reservas
 *
 * Público    : POST /            (reserva como invitado)
 * Autenticado: GET / , GET /:id , PUT /:id , DELETE /:id , PUT /:id/cancelar
 * Admin      : todas, incluidas las transiciones de estado y /hoy
 *
 * La comprobación de propiedad (un cliente no toca reservas de otro) la hace
 * reservaService, que es quien sabe quién es el dueño de cada reserva.
 */

const { Router } = require('express');
const controller = require('../controllers/reservaController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = Router();

// Rutas literales: deben declararse antes que `/:id`.
router.get('/mias', authMiddleware.autenticar, controller.mias);
router.get('/hoy', authMiddleware.autenticar, controller.hoy);
router.get('/codigo/:codigo', authMiddleware.autenticar, controller.porCodigo);

// Cualquier usuario autenticado ve su propia reserva (o cualquier otra si es admin).
router.get('/', authMiddleware.autenticar, controller.listar);
router.get('/:id', authMiddleware.autenticar, controller.obtener);
router.put('/:id', authMiddleware.autenticar, controller.actualizar);
router.delete('/:id', authMiddleware.autenticar, controller.eliminar);

// Crear reserva: permitido sin sesión (reserva de invitado).
router.post('/', authMiddleware.autenticarOpcional, controller.crear);

// Transiciones de estado.
router.put('/:id/confirmar', authMiddleware.autenticar, controller.confirmar);
router.put('/:id/cancelar', authMiddleware.autenticar, controller.cancelar);
router.put('/:id/completar', authMiddleware.autenticar, adminMiddleware.soloAdmin, controller.completar);

module.exports = router;
