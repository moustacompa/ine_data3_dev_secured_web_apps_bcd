'use strict';

/**
 * Module P4 — Dashboards & Partage
 *
 * Intégration dans app.js (après express.json() et avant le gestionnaire
 * d'erreurs global de P1) :
 *
 *   const { mountDashboards } = require('./modules/dashboards');
 *   mountDashboards(app);            // préfixe '/api' par défaut
 */
const express = require('express');
const { authenticate, requireRole } = require('./deps');
const { asyncHandler: h } = require('./errors');
const { analysesCtrl: a, dashboardsCtrl: d, publicCtrl: p, outliersCtrl: o } = require('./controllers');

// ------------------------------- /analyses -----------------------------
const analysesRouter = express.Router();
analysesRouter.use(authenticate);
analysesRouter.get('/', h(a.list));                 // ?scope=mine|shared|accessible|all&q=&datasetId=
analysesRouter.post('/', h(a.create));
analysesRouter.get('/:id', h(a.get));
analysesRouter.put('/:id', h(a.update));
analysesRouter.patch('/:id', h(a.update));
analysesRouter.delete('/:id', h(a.remove));
analysesRouter.post('/:id/run', h(a.run));          // body: { filters?: [...] }
analysesRouter.get('/:id/shares', h(a.listShares));
analysesRouter.post('/:id/shares', h(a.addShare));  // body: { email }
analysesRouter.delete('/:id/shares/:userId', h(a.removeShare));

// ------------------------------ /dashboards ----------------------------
const dashboardsRouter = express.Router();
dashboardsRouter.use(authenticate);
dashboardsRouter.get('/', h(d.list));               // ?scope=mine|shared|all&q=
dashboardsRouter.get('/stats', requireRole('admin'), h(d.stats));
dashboardsRouter.post('/', h(d.create));
dashboardsRouter.get('/:id', h(d.get));
dashboardsRouter.put('/:id', h(d.update));
dashboardsRouter.patch('/:id', h(d.update));
dashboardsRouter.delete('/:id', h(d.remove));
dashboardsRouter.post('/:id/render', h(d.render));  // body: { filters: { [filterId]: valeur } }
dashboardsRouter.get('/:id/filters/:filterId/options', h(d.filterOptions));
dashboardsRouter.post('/:id/public-token', h(d.regenerateToken));
dashboardsRouter.get('/:id/shares', h(d.listShares));
dashboardsRouter.post('/:id/shares', h(d.addShare));
dashboardsRouter.delete('/:id/shares/:userId', h(d.removeShare));

// ------------------------------- /outliers -----------------------------
const outliersRouter = express.Router();
outliersRouter.use(authenticate);
outliersRouter.get('/methods', h(o.methods));
outliersRouter.get('/datasets', h(o.datasets));
outliersRouter.get('/datasets/:datasetId/columns', h(o.columns));
outliersRouter.post('/', h(o.detect));              // body: { datasetId, column, method?, threshold?, filters? }

// ------------------- /public/dashboards (sans authentification) --------
/** Limiteur minimal en mémoire : 120 requêtes / minute / IP. */
function rateLimit({ windowMs = 60_000, max = 120 } = {}) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const key = req.ip;
    const count = (hits.get(key) || 0) + 1;
    hits.set(key, count);
    if (count > max) return res.status(429).json({ error: 'Trop de requêtes, réessayez dans une minute.' });
    return next();
  };
}

const publicRouter = express.Router();
publicRouter.use(rateLimit());
publicRouter.get('/:token', h(p.get));
publicRouter.post('/:token/render', h(p.render));
publicRouter.get('/:token/filters/:filterId/options', h(p.filterOptions));

function mountDashboards(app, prefix = '/api') {
  app.use(`${prefix}/analyses`, analysesRouter);
  app.use(`${prefix}/dashboards`, dashboardsRouter);
  app.use(`${prefix}/outliers`, outliersRouter);
  app.use(`${prefix}/public/dashboards`, publicRouter);
}

module.exports = { mountDashboards, analysesRouter, dashboardsRouter, outliersRouter, publicRouter };
