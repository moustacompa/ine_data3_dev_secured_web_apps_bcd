// Tests de la validation stricte (sans base de données)
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkQueryColumns, parseDatasetId, validateQueryRequest } from '../analytics.validation.js';
import { AnalyticsError } from '../analytics.errors.js';
import { ColumnInfo } from '../analytics.types.js';

const COLUMNS: ColumnInfo[] = [
  { name: 'date', type: 'date', filled: 204 },
  { name: 'montant', type: 'number', filled: 204 },
  { name: 'produit', type: 'text', filled: 204 },
  { name: 'quantite', type: 'number', filled: 204 },
  { name: 'region', type: 'text', filled: 204 },
];

const fieldsOf = (fn: () => unknown): string[] => {
  try { fn(); } catch (e) {
    assert.ok(e instanceof AnalyticsError);
    assert.equal(e.status, 400);
    assert.equal(e.code, 'VALIDATION_ERROR');
    return (e.details || []).map((d) => d.field);
  }
  assert.fail('une erreur de validation était attendue');
};

test('requête valide : structure normalisée conservée', () => {
  const { datasetId, query } = validateQueryRequest({
    datasetId: '1',
    query: { metrics: [{ op: 'avg', field: 'montant', alias: 'panier moyen' }], groupBy: ['region'], orderBy: { field: 'panier moyen', dir: 'asc' }, limit: 10 },
  });
  assert.equal(datasetId, 1);
  assert.doesNotThrow(() => checkQueryColumns(query, COLUMNS));
});

test('rejet des requêtes mal formées', () => {
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: -3, query: {} })), ['datasetId']);
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: 1, query: { metrics: [{ op: 'drop', field: 'x' }] } })), ['query.metrics[0].op']);
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: 1, query: { metrics: [{ op: 'sum' }] } })), ['query.metrics[0].field']);
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: 1, query: { limit: 5000 } })), ['query.limit']);
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: 1, query: { sql: 'SELECT 1' } })), ['query.sql']);
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: 1, query: {}, ownerId: 'x' })), ['ownerId']);
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: 1, query: { filters: [{ field: 'region', op: 'in', value: [] }] } })), ['query.filters[0].value']);
  assert.deepEqual(fieldsOf(() => validateQueryRequest({ datasetId: 1, query: { metrics: [{ op: 'count', alias: "a'; --" }] } })), ['query.metrics[0].alias']);
  assert.throws(() => validateQueryRequest(null), AnalyticsError);
  assert.throws(() => validateQueryRequest([1, 2]), AnalyticsError);
});

test('validation des colonnes contre les métadonnées du dataset', () => {
  const check = (query: object) => fieldsOf(() => checkQueryColumns(query, COLUMNS));
  assert.deepEqual(check({ metrics: [{ op: 'sum', field: 'salaire' }] }), ['query.metrics[0].field']);
  assert.deepEqual(check({ groupBy: ['pays'] }), ['query.groupBy[0]']);
  assert.deepEqual(check({ filters: [{ field: 'pays', op: 'eq', value: 'FR' }] }), ['query.filters[0].field']);
  // SUM/AVG/MIN/MAX/médiane exigent une colonne numérique
  assert.deepEqual(check({ metrics: [{ op: 'avg', field: 'region' }] }), ['query.metrics[0].field']);
  // la série temporelle exige une colonne date
  assert.deepEqual(check({ timeBucket: { field: 'montant' } }), ['query.timeBucket.field']);
  // tri uniquement sur une colonne du résultat
  assert.deepEqual(check({ groupBy: ['region'], orderBy: { field: 'montant' } }), ['query.orderBy.field']);
  // noms de colonnes de résultat en double
  assert.deepEqual(check({ metrics: [{ op: 'sum', field: 'montant', alias: 'x' }, { op: 'max', field: 'montant', alias: 'x' }] }), ['query']);
  // COUNT et COUNT DISTINCT acceptent une colonne texte
  assert.doesNotThrow(() => checkQueryColumns({ metrics: [{ op: 'count_distinct', field: 'produit' }], groupBy: ['region'] }, COLUMNS));
});

test('parseDatasetId accepte uniquement des entiers positifs', () => {
  assert.equal(parseDatasetId(12), 12);
  assert.equal(parseDatasetId('12'), 12);
  for (const bad of ['1; DROP', '1.5', 0, -1, 'abc', null, undefined, 2 ** 40]) assert.equal(parseDatasetId(bad), null);
});
