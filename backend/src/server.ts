import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { query } from './config/db.js';
import authRouter from './modules/auth/auth.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
// Module P2 (Import & Exploration des datasets)
import datasetsRouter from './modules/datasets/datasets.routes.js';
// Module P3 (Analyse & Visualisation)
import analyticsRouter from './modules/analytics/analytics.routes.js';
// Module P4 (Dashboards & Partage)
import dashboardsPkg from './modules/dashboards/index.js';

const { mountDashboards } = dashboardsPkg;

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares de base
const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
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
app.use('/api/datasets', datasetsRouter);
app.use('/api/analytics', analyticsRouter);

// Montage du module P4 (Dashboards & Analyses)
if (typeof mountDashboards === 'function') {
    mountDashboards(app, '/api');
}

// Gestionnaire d'erreurs global : le module P4 transmet ses erreurs à Express avec
// err.status, err.message et err.details (dashboards/errors.js). Sans lui, Express
// répondrait par une page HTML contenant la pile d'appels.
app.use((err: { status?: number; statusCode?: number; message?: string; details?: unknown }, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    return res.status(status).json({
        error: status >= 500 ? 'Erreur interne du serveur.' : err.message,
        ...(err.details ? { details: err.details } : {}),
    });
});

// 4. Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur Backend démarré sur http://localhost:${PORT}`);
});
