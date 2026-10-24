import { Router } from 'express';
import { listUsers, changeRole, changeStatus, getStats, listLogs } from './admin.controller.js';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// Sécurité maximale : Toutes les routes de ce module exigent d'être connecté ET d'avoir le rôle 'admin'
router.use(authenticateToken, requireRole('admin'));

// Endpoints
router.get('/users', listUsers);
router.patch('/users/:id/role', changeRole);
router.patch('/users/:id/status', changeStatus);
router.get('/stats', getStats);
router.get('/logs', listLogs);

export default router;