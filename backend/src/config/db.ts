import pg from 'pg';

const { Pool } = pg;

// 1. Création du pool de connexions à PostgreSQL
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// 2. Gestion des erreurs inattendues sur les connexions inactives
pool.on('error', (err) => {
    console.error('Erreur inattendue sur le client PostgreSQL idle:', err);
});

// 3. Helper utilitaire pour exécuter des requêtes SQL sécurisées
export const query = (text: string, params?: unknown[]) => {
    return pool.query(text, params);
}