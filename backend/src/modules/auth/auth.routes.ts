import { Router } from "express";
import { register, login, getMe } from "./auth.controller.js";
import { authenticateToken } from "../../middlewares/auth.middleware.js"

const router = Router();

// Routes publiques
router.post('/register', register);
router.post('/login', login);

// Route sécurisée : nécessite un jeton valide
router.get('/me', authenticateToken, getMe);

export default router;