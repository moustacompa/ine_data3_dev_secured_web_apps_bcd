import express from 'express';
import cors from 'cors';
import { query } from './config/db.js';
import authRouter from './modules/auth/auth.routes.js'

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares de base
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
}));

// Permet à Express de lire le corps des requêtes en JSON (req.body)
app.use(express.json());

// 2. Route de vérification de santé (Heakth Check)
app.get('/api/health', async (_req, res) => {
    try {
        const result = await query('SELECT NOW() as current_time');
        res.json({
            status: 'OK',
            message: 'API opérationnelle et connectée à PostgreSQL !',
            database_time: result.rows[0].current_time,
        });
    } catch (error) {
        console.error('Erreur de connexion à la BDD:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Erreur de connexion à la base de données',
        });
    }
});

// 3. Montage des modules de routes
app.use('/api/auth', authRouter);

// 4. Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur Backend démarré sur http://localhost:${PORT}`);
});