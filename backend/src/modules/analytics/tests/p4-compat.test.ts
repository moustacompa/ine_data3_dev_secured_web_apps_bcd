// Compatibilité avec le module P4 : runQuery de P3 doit remplacer
// dashboards/queryEngine.js sans changer ni le SQL, ni les résultats.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildAggregateQuery } from '../query.builder.js';
import { runQuery } from '../analytics.service.js';
import { AnalyticsQuery } from '../analytics.types.js';
import { loadDemoContext, pool, SKIP_REASON } from './db.helper.js';

const require = createRequire(import.meta.url);
const p4Engine = require('../../dashboards/queryEngine.js');
const P4_SCHEMA = { datasetOwnerCol: 'user_id', datasetTitleCol: 'title', rowsDataCol: 'data' };

// Les 4 analyses du seed P4 + toutes les variantes du contrat (opérations, filtres, tri, limite)
const QUERIES: AnalyticsQuery[] = [
  { metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }], groupBy: ['region'], orderBy: { field: 'ca', dir: 'desc' } },
  { metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }], timeBucket: { field: 'date', granularity: 'month', alias: 'mois' } },
  { metrics: [{ op: 'count', alias: 'ventes' }], groupBy: ['produit'] },
  { metrics: [{ op: 'sum', field: 'montant', alias: 'total' }] },
  {},
  {
    metrics: [
      { op: 'avg', field: 'montant' }, { op: 'min', field: 'montant' }, { op: 'max', field: 'quantite' },
      { op: 'count', field: 'produit' }, { op: 'count_distinct', field: 'produit' }, { op: 'median', field: 'montant' },
    ],
    groupBy: ['region', 'produit'],
    orderBy: { field: 'region', dir: 'asc' },
    limit: 7,
  },
  { metrics: [{ op: 'sum', field: 'quantite' }], timeBucket: { field: 'date', granularity: 'week' }, limit: 5 },
  {
    metrics: [{ op: 'sum', field: 'montant' }],
    groupBy: ['produit'],
    filters: [
      { field: 'region', op: 'in', value: ['Nord', 'Sud'] },
      { field: 'montant', op: 'between', value: [50, 500] },
      { field: 'date', op: 'gte', value: '2026-02-01' },
      { field: 'date', op: 'lte', value: '2026-08-31T23:59:59.999' },
      { field: 'produit', op: 'neq', value: 'Clavier' },
      { field: 'produit', op: 'contains', value: 'ran' },
      { field: 'quantite', op: 'gt', value: '1' },
      { field: 'quantite', op: 'lt', value: 9 },
      { field: 'region', op: 'notnull' },
      { field: 'inexistante', op: 'isnull' },
      { field: 'region', op: 'eq', value: 'Nord' },
    ],
  },
  // colonne absente du dataset : résultat vide, pas d'erreur (filtres globaux des dashboards)
  { metrics: [{ op: 'sum', field: 'montant' }], filters: [{ field: 'pays', op: 'eq', value: 'FR' }] },
];

test('SQL et paramètres identiques au moteur P4 pour tout le contrat de requête', () => {
  for (const q of QUERIES) {
    const p3 = buildAggregateQuery(42, q);
    const p4 = p4Engine.buildAggregateQuery(P4_SCHEMA, 42, q);
    assert.equal(p3.text, p4.text, `SQL différent pour ${JSON.stringify(q)}`);
    assert.deepEqual(p3.params, p4.params);
  }
});

test('mêmes requêtes refusées que le moteur P4 (statut 400)', () => {
  const bad = [
    { metrics: [{ op: 'drop', field: 'x' }] },
    { metrics: [{ op: 'avg' }] },
    { timeBucket: { field: 'date', granularity: 'hour' } },
    { filters: [{ field: 'x', op: 'regex', value: '.*' }] },
    { filters: [{ field: 'x', op: 'in', value: [] }] },
    { filters: [{ field: 'x', op: 'between', value: [1] }] },
    { groupBy: ['a', 'b', 'c', 'd'] },
  ];
  for (const q of bad) {
    assert.throws(() => p4Engine.buildAggregateQuery(P4_SCHEMA, 1, q), (e: { status: number }) => e.status === 400);
    assert.throws(() => buildAggregateQuery(1, q as never), (e: { status: number }) => e.status === 400);
  }
});

test('runQuery est exporté pour P4 avec la signature (datasetId, query)', () => {
  assert.equal(typeof runQuery, 'function');
  assert.equal(runQuery!.length, 1); // query a une valeur par défaut
});

const ctx = await loadDemoContext();
after(() => pool.end());

test('résultats identiques à ceux du moteur P4 sur le dataset de démo', { skip: ctx ? false : SKIP_REASON }, async () => {
  for (const q of QUERIES) {
    const expected = await p4Engine.runQuery(pool, P4_SCHEMA, ctx!.datasetId, q);
    const actual = await runQuery!(ctx!.datasetId, q);
    assert.deepEqual(actual, expected, `résultat différent pour ${JSON.stringify(q)}`);
  }
});

test('les 4 analyses enregistrées par P4 donnent le même résultat', { skip: ctx ? false : SKIP_REASON }, async () => {
  const { rows } = await pool.query('SELECT id, dataset_id, config FROM analyses ORDER BY id');
  assert.ok(rows.length >= 4);
  for (const a of rows) {
    const expected = await p4Engine.runQuery(pool, P4_SCHEMA, a.dataset_id, a.config.query);
    assert.deepEqual(await runQuery!(a.dataset_id, a.config.query), expected, `analyse ${a.id}`);
  }
});
