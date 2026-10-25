import express from 'express';
import cors from 'cors';
import { query } from './config/db.js';
import authRouter from './modules/auth/auth.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
// Module P4 (Dashboards & Partage)
import dashboardsPkg from './modules/dashboards/index.js';

const { mountDashboards } = dashboardsPkg;

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares de base
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
}));

// Permet à Express de lire le corps des requêtes en JSON (req.body)
app.use(express.json());

// 2. Route de vérification de santé (Health Check)
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
app.use('/api/admin', adminRouter);

// Montage du module P4 (Dashboards & Analyses)
if (typeof mountDashboards === 'function') {
    mountDashboards(app, '/api');
}

// 4. Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur Backend démarré sur http://localhost:${PORT}`);
});
