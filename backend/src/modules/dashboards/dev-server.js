'use strict';

/**
 * Serveur de développement autonome (avant intégration avec P1).
 *
 *   DATABASE_URL=postgres://... JWT_SECRET=dev-secret node src/modules/dashboards/dev-server.js
 *   node src/modules/dashboards/dev-server.js --token 1 user   → affiche un JWT de test
 *
 * En production, NE PAS utiliser ce fichier : le module est monté par app.js.
 */
const express = require('express');
const { mountDashboards } = require('./index');
const { fallbackErrorHandler } = require('./errors');

const args = process.argv.slice(2);
if (args[0] === '--token') {
  const jwt = require('jsonwebtoken');
  const [, id = '1', role = 'user'] = args;
  // [FUSION P1/P4] id gardé tel quel : c'est un UUID de la table users de P1 (ex. --token <uuid> admin)
  console.log(jwt.sign({ id, role },process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' }));
  process.exit(0);
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});
mountDashboards(app);
app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }));
app.use(fallbackErrorHandler);

const port = Number(process.env.PORT) || 4004;
app.listen(port, () => console.log(`[dashboards] dev server sur http://localhost:${port}/api`));
