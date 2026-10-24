'use strict';

/**
 * =====================================================================
 *  POINT D'INTÉGRATION UNIQUE AVEC LES AUTRES MEMBRES
 * =====================================================================
 *  Tout ce qui vient de P1 (auth, logs), P2 (datasets) et P3 (requêtes)
 *  passe par ce fichier. Si un module n'existe pas encore, un mock prend
 *  le relais automatiquement (un avertissement s'affiche au démarrage).
 *
 *  À l'intégration, il suffit d'ajuster PATHS et SCHEMA ci-dessous.
 * =====================================================================
 */
const path = require('path');
const { httpError } = require('./errors');
// [FUSION P1/P4] helpers d'adaptation aux conventions de P1 (UUID, format de logActivity)
const { normalizeUserId, toP1ActivityPayload } = require('./p1-compat');

// Chemins relatifs à ce dossier (src/modules/dashboards)
const PATHS = {
  db: '../../config/db',                       // P1 : exporte un Pool pg (ou { pool })
  // [FUSION P1/P4] chemin aligné sur l'arborescence de P1 (README.md §6 : src/middlewares/auth.middleware)
  //   ancien chemin P4 : '../auth/auth.middleware'
  authMiddleware: '../../middlewares/auth.middleware', // P1 : authenticateToken, requireRole
  activityLog: '../admin/activity.service',    // P1 : logActivity({ userId, action, entity, ... })
  analyticsService: '../analytics/analytics.service', // P3 : runQuery(datasetId, query)
};

const identifier = (value, fallback) => {
  const v = value || fallback;
  if (!/^[a-z_][a-z0-9_]*$/i.test(v)) throw new Error(`Identifiant SQL invalide : ${v}`);
  return v;
};

// Noms de colonnes des tables de P2 (surchargeables par variables d'env)
const SCHEMA = {
  datasetOwnerCol: identifier(process.env.P4_DATASET_OWNER_COL, 'user_id'),
  datasetTitleCol: identifier(process.env.P4_DATASET_TITLE_COL, 'title'),
  rowsDataCol: identifier(process.env.P4_ROWS_DATA_COL, 'data'), // JSONB d'une ligne
};

function tryRequire(relPath, label) {
  const full = path.join(__dirname, relPath);
  try {
    return require(full);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && String(err.message).includes(full)) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[dashboards] ${label} introuvable (${relPath}) → mock utilisé.`);
      }
      return null;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------
// Base de données
// ---------------------------------------------------------------------
let pool = null;
function getDb() {
  if (pool) return pool;
  const mod = tryRequire(PATHS.db, 'Pool PostgreSQL');
  if (mod && typeof mod.query === 'function') pool = mod;
  else if (mod && mod.pool && typeof mod.pool.query === 'function') pool = mod.pool;
  else {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// ---------------------------------------------------------------------
// Authentification (P1)
// ---------------------------------------------------------------------
function normalizeUser(user) {
  if (!user) return user;
  // [FUSION P1/P4] P1 utilise des UUID : on garde l'id en chaîne au lieu de Number(...) (qui donnait NaN)
  user.id = normalizeUserId(user.id ?? user.userId ?? user.sub);
  user.role = user.role || 'user';
  return user;
}

function mockAuthenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(httpError(401, 'Authentification requise.'));
  try {
    const jwt = require('jsonwebtoken');
    req.user = normalizeUser(jwt.verify(token, process.env.JWT_SECRET || 'dev-secret'));
    return next();
  } catch {
    return next(httpError(401, 'Jeton invalide ou expiré.'));
  }
}

const mockRequireRole = (...roles) => (req, res, next) =>
  req.user && roles.flat().includes(req.user.role)
    ? next()
    : next(httpError(403, 'Accès réservé.'));

const authMod = tryRequire(PATHS.authMiddleware, "Middleware d'auth (P1)");
// [FUSION P1/P4] ajout de authenticateToken, nom du middleware livré par P1 (README.md §3.1)
const baseAuthenticate = authMod?.authenticateToken || authMod?.authenticate || authMod?.requireAuth
  || authMod?.verifyToken || mockAuthenticate;
const requireRole = authMod?.requireRole || authMod?.authorize || mockRequireRole;

/** Applique le middleware de P1 puis normalise req.user ({ id, role }). */
function authenticate(req, res, next) {
  baseAuthenticate(req, res, (err) => {
    if (err) return next(err);
    if (!req.user) return next(httpError(401, 'Authentification requise.'));
    normalizeUser(req.user);
    return next();
  });
}

// ---------------------------------------------------------------------
// Journal d'activité (P1) — ne fait jamais échouer la requête
// ---------------------------------------------------------------------
const activityMod = tryRequire(PATHS.activityLog, 'logActivity (P1)');
function logActivity(userId, action, details = {}) {
  const fn = activityMod?.logActivity;
  if (typeof fn !== 'function') return;
  Promise.resolve()
    // [FUSION P1/P4] P1 attend un objet unique (README.md §3.3), et non (userId, action, details)
    .then(() => fn(toP1ActivityPayload(userId, action, details)))
    .catch((err) => console.warn('[dashboards] logActivity a échoué :', err.message));
}

// ---------------------------------------------------------------------
// Moteur de requêtes (P3) — repli sur notre implémentation SQL
// ---------------------------------------------------------------------
const engine = require('./queryEngine');
const analyticsMod = tryRequire(PATHS.analyticsService, 'runQuery (P3)');
function runQuery(datasetId, query) {
  if (typeof analyticsMod?.runQuery === 'function') return analyticsMod.runQuery(datasetId, query);
  return engine.runQuery(getDb(), SCHEMA, datasetId, query);
}

// ---------------------------------------------------------------------
// Datasets (P2)
// ---------------------------------------------------------------------
async function canReadDataset(user, datasetId) {
  if (user.role === 'admin') {
    const { rowCount } = await getDb().query('SELECT 1 FROM datasets WHERE id = $1', [datasetId]);
    return rowCount > 0;
  }
  const { rowCount } = await getDb().query(
    `SELECT 1 FROM datasets WHERE id = $1 AND ${SCHEMA.datasetOwnerCol} = $2`,
    [datasetId, user.id],
  );
  return rowCount > 0;
}

async function listReadableDatasets(user) {
  const where = user.role === 'admin' ? '' : `WHERE ${SCHEMA.datasetOwnerCol} = $1`;
  const { rows } = await getDb().query(
    `SELECT id, ${SCHEMA.datasetTitleCol} AS title FROM datasets ${where} ORDER BY id DESC LIMIT 200`,
    user.role === 'admin' ? [] : [user.id],
  );
  return rows;
}

async function findUserByEmail(email) {
  const { rows } = await getDb().query(
    'SELECT id, email FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  return rows[0] || null;
}

module.exports = {
  SCHEMA,
  getDb,
  authenticate,
  requireRole,
  logActivity,
  runQuery,
  canReadDataset,
  listReadableDatasets,
  findUserByEmail,
  // accès direct aux helpers SQL (outliers, options de filtres)
  fetchColumnValues: (datasetId, column, filters, limit) =>
    engine.fetchColumnValues(getDb(), SCHEMA, datasetId, column, filters, limit),
  distinctValues: (datasetId, field, limit) =>
    engine.distinctValues(getDb(), SCHEMA, datasetId, field, limit),
  listColumns: (datasetId) => engine.listColumns(getDb(), SCHEMA, datasetId),
};
