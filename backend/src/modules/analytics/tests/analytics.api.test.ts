// Tests d'intégration HTTP de /api/analytics (base de démo requise)
// Les résultats sont comparés à un calcul SQL direct, indépendant du moteur.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import analyticsRouter from '../analytics.routes.js';
import { loadDemoContext, pool, SKIP_REASON } from './db.helper.js';

const ctx = await loadDemoContext();
const skip = ctx ? false : SKIP_REASON;
let server: Server;
let baseUrl = '';

const tokenFor = (who: 'alice' | 'bob' | 'admin') => {
  const u = ctx!.users[who];
  return jwt.sign({ id: u.id, email: `${who}@example.com`, role: u.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '5m' });
};

async function call(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() as any };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRouter);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('authentification JWT obligatoire', { skip }, async () => {
  const r = await call('POST', '/query', { body: { datasetId: ctx!.datasetId, query: {} } });
  assert.equal(r.status, 401);
  assert.equal(r.json.success, false);
  const bad = await call('GET', '/datasets', { token: 'jeton.invalide' });
  assert.equal(bad.status, 401);
});

test('SUM, AVG, MIN, MAX et COUNT exacts sur le dataset de démo', { skip }, async () => {
  const { rows: [expected] } = await pool.query(
    `SELECT SUM((data->>'montant')::numeric) s, AVG((data->>'montant')::numeric) a,
            MIN((data->>'montant')::numeric) mi, MAX((data->>'montant')::numeric) ma, COUNT(*) c
       FROM dataset_rows WHERE dataset_id = $1`, [ctx!.datasetId],
  );
  const r = await call('POST', '/query', {
    token: tokenFor('alice'),
    body: {
      datasetId: ctx!.datasetId,
      query: { metrics: [
        { op: 'sum', field: 'montant', alias: 'somme' }, { op: 'avg', field: 'montant', alias: 'moyenne' },
        { op: 'min', field: 'montant', alias: 'minimum' }, { op: 'max', field: 'montant', alias: 'maximum' },
        { op: 'count', alias: 'lignes' },
      ] },
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.success, true);
  const row = r.json.data.rows[0];
  assert.equal(row.somme, Number(expected.s));
  assert.equal(row.moyenne, Math.round(Number(expected.a) * 10000) / 10000);
  assert.equal(row.minimum, Number(expected.mi));
  assert.equal(row.maximum, Number(expected.ma));
  assert.equal(row.lignes, Number(expected.c));
  assert.deepEqual(r.json.data.columns, ['somme', 'moyenne', 'minimum', 'maximum', 'lignes']);
  assert.equal(r.json.data.meta.truncated, false);
});

test('GROUP BY région + classement', { skip }, async () => {
  const { rows: expected } = await pool.query(
    `SELECT data->>'region' region, SUM((data->>'montant')::numeric) ca
       FROM dataset_rows WHERE dataset_id = $1 GROUP BY 1 ORDER BY 2 DESC`, [ctx!.datasetId],
  );
  const r = await call('POST', '/query', {
    token: tokenFor('alice'),
    body: { datasetId: ctx!.datasetId, query: { metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }], groupBy: ['region'], rank: true } },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.data.rows.map((x: any) => [x.region, x.ca, x.rank]), expected.map((e, i) => [e.region, Number(e.ca), i + 1]));
  const totalShare = r.json.data.rows.reduce((s: number, x: any) => s + x.share_pct, 0);
  assert.ok(Math.abs(totalShare - 100) < 0.05);
});

test('série temporelle mensuelle triée chronologiquement', { skip }, async () => {
  const r = await call('POST', '/query', {
    token: tokenFor('alice'),
    body: { datasetId: ctx!.datasetId, query: { metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }], timeBucket: { field: 'date', granularity: 'month', alias: 'mois' } } },
  });
  assert.equal(r.status, 200);
  const months = r.json.data.rows.map((x: any) => x.mois);
  assert.deepEqual(months, [...months].sort());
  assert.match(months[0], /^\d{4}-\d{2}-01$/);
});

test('troncature signalée quand le résultat dépasse la limite', { skip }, async () => {
  const r = await call('POST', '/query', {
    token: tokenFor('alice'),
    body: { datasetId: ctx!.datasetId, query: { groupBy: ['date'], limit: 5 } },
  });
  assert.equal(r.json.data.rows.length, 5);
  assert.equal(r.json.data.meta.truncated, true);
});

test('accès refusé au dataset privé d\'un autre utilisateur (404, aucune donnée)', { skip }, async () => {
  const bob = tokenFor('bob');
  const q = await call('POST', '/query', { token: bob, body: { datasetId: ctx!.datasetId, query: { metrics: [{ op: 'sum', field: 'montant' }] } } });
  assert.equal(q.status, 404);
  assert.deepEqual(q.json, { success: false, error: { code: 'DATASET_NOT_FOUND', message: 'Dataset introuvable ou accès non autorisé.' } });
  const cols = await call('GET', `/datasets/${ctx!.datasetId}/columns`, { token: bob });
  assert.equal(cols.status, 404);
  const list = await call('GET', '/datasets', { token: bob });
  assert.ok(!list.json.data.some((d: any) => d.id === ctx!.datasetId));
  // même réponse qu'un dataset inexistant : on ne révèle pas son existence
  const missing = await call('POST', '/query', { token: bob, body: { datasetId: 999999, query: {} } });
  assert.deepEqual(missing.json, q.json);
});

test('l\'administrateur peut analyser tous les datasets', { skip }, async () => {
  const r = await call('POST', '/query', { token: tokenFor('admin'), body: { datasetId: ctx!.datasetId, query: {} } });
  assert.equal(r.status, 200);
});

test('colonnes et types détectés', { skip }, async () => {
  const r = await call('GET', `/datasets/${ctx!.datasetId}/columns`, { token: tokenFor('alice') });
  assert.equal(r.status, 200);
  const types = Object.fromEntries(r.json.data.columns.map((c: any) => [c.name, c.type]));
  assert.deepEqual(types, { date: 'date', montant: 'number', produit: 'text', quantite: 'number', region: 'text' });
  assert.equal(r.json.data.dataset.rowCount, 204);
});

test('requêtes incorrectes rejetées au format d\'erreur de P1', { skip }, async () => {
  const token = tokenFor('alice');
  const unknownColumn = await call('POST', '/query', { token, body: { datasetId: ctx!.datasetId, query: { metrics: [{ op: 'sum', field: 'salaire' }] } } });
  assert.equal(unknownColumn.status, 400);
  assert.equal(unknownColumn.json.error.code, 'VALIDATION_ERROR');
  assert.equal(unknownColumn.json.error.details[0].field, 'query.metrics[0].field');

  const textAvg = await call('POST', '/query', { token, body: { datasetId: ctx!.datasetId, query: { metrics: [{ op: 'avg', field: 'region' }] } } });
  assert.equal(textAvg.status, 400);

  const badOp = await call('POST', '/query', { token, body: { datasetId: ctx!.datasetId, query: { metrics: [{ op: 'delete' }] } } });
  assert.equal(badOp.status, 400);

  const badId = await call('GET', '/datasets/1%20OR%201=1/columns', { token });
  assert.equal(badId.status, 400);
});

test('chaque analyse est tracée dans activity_logs (P1)', { skip }, async () => {
  const before = await pool.query("SELECT COUNT(*)::int n FROM activity_logs WHERE action = 'ANALYTICS_QUERY'");
  await call('POST', '/query', { token: tokenFor('alice'), body: { datasetId: ctx!.datasetId, query: {} } });
  // logActivity est lancé sans être attendu : on laisse l'insertion se terminer
  await new Promise((r) => setTimeout(r, 300));
  const afterCount = await pool.query("SELECT COUNT(*)::int n FROM activity_logs WHERE action = 'ANALYTICS_QUERY'");
  assert.equal(afterCount.rows[0].n, before.rows[0].n + 1);
});
