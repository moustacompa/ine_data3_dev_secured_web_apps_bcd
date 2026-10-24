'use strict';

// Lancer : node --test src/modules/dashboards/tests/
const test = require('node:test');
const assert = require('node:assert/strict');

const { detectOutliers, quantile } = require('../outliers');
const { buildAggregateQuery, buildWhere, Sql } = require('../queryEngine');
const { resolveAccess, canEdit } = require('../access');
const { toQueryFilters, validateDashboard, validateAnalysis } = require('../validate');

const SCHEMA = { rowsDataCol: 'data' };
const pts = (values) => values.map((value, i) => ({ rowId: i + 1, value }));

// ------------------------------ Outliers -------------------------------
test('quantile : interpolation linéaire', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2);
});

test('IQR : détecte une valeur extrême haute', () => {
  const r = detectOutliers(pts([10, 12, 11, 13, 12, 11, 10, 95]), { method: 'iqr' });
  assert.equal(r.outlierCount, 1);
  assert.equal(r.outliers[0].value, 95);
  assert.equal(r.outliers[0].side, 'high');
  assert.equal(r.outliers[0].rowId, 8);
  assert.ok(r.bounds.upper < 95);
  // l'extrême est compté à part et n'écrase pas l'histogramme
  assert.equal(r.overflow.high, 1);
  assert.equal(r.overflow.highMax, 95);
  assert.ok(r.bins[r.bins.length - 1].x1 < 95);
  assert.equal(r.bins.reduce((s, b) => s + b.count, 0) + r.overflow.high + r.overflow.low, r.n);
});

test('IQR : rien à signaler sur une série régulière', () => {
  const r = detectOutliers(pts([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  assert.equal(r.outlierCount, 0);
  assert.equal(r.bins.reduce((s, b) => s + b.count, 0), 10);
});

test('Z-score : seuil personnalisé', () => {
  const values = [...Array(50).fill(100), 130, 70];
  const strict = detectOutliers(pts(values), { method: 'zscore', threshold: 2 });
  const lax = detectOutliers(pts(values), { method: 'zscore', threshold: 10 });
  assert.equal(strict.outlierCount, 2);
  assert.equal(lax.outlierCount, 0);
});

test('MAD : robuste quand plusieurs extrêmes gonflent l’écart-type', () => {
  const values = [20, 21, 19, 22, 20, 21, 500, 520];
  const z = detectOutliers(pts(values), { method: 'zscore' });
  const mad = detectOutliers(pts(values), { method: 'mad' });
  assert.equal(z.outlierCount, 0); // masquage : la moyenne est tirée vers le haut
  assert.equal(mad.outlierCount, 2);
});

test('moins de 4 valeurs : avertissement, pas de calcul', () => {
  const r = detectOutliers(pts([1, 2, 3]));
  assert.equal(r.outlierCount, 0);
  assert.match(r.warning, /4 valeurs/);
});

test('valeurs non numériques ignorées', () => {
  const r = detectOutliers([{ rowId: 1, value: NaN }, ...pts([1, 2, 3, 4, 5])]);
  assert.equal(r.n, 5);
});

// ---------------------------- Moteur SQL --------------------------------
test('agrégation : champs et valeurs passent en paramètres', () => {
  const q = buildAggregateQuery(SCHEMA, 7, {
    metrics: [{ op: 'sum', field: "montant'; DROP TABLE users;--", alias: 'total' }],
    groupBy: ['region'],
    filters: [{ field: 'annee', op: 'eq', value: '2024' }],
    orderBy: { field: 'total', dir: 'desc' },
    limit: 10,
  });
  assert.ok(!q.text.includes('DROP TABLE'));
  assert.ok(q.params.includes("montant'; DROP TABLE users;--"));
  assert.ok(q.params.includes(7));
  assert.match(q.text, /GROUP BY 1/);
  assert.match(q.text, /ORDER BY m0 DESC/);
  assert.match(q.text, /LIMIT 10$/);
});

test('série temporelle : date_trunc avec granularité contrôlée', () => {
  const q = buildAggregateQuery(SCHEMA, 1, {
    metrics: [{ op: 'count' }],
    timeBucket: { field: 'date', granularity: 'month' },
  });
  assert.match(q.text, /date_trunc\('month'/);
  assert.match(q.text, /ORDER BY t0 ASC/);
  assert.throws(() => buildAggregateQuery(SCHEMA, 1, { timeBucket: { field: 'date', granularity: "month'); --" } }));
});

test('limite plafonnée à 1000', () => {
  assert.match(buildAggregateQuery(SCHEMA, 1, { limit: 999999 }).text, /LIMIT 1000$/);
});

test('filtres : opérateur inconnu refusé', () => {
  assert.throws(() => buildWhere(new Sql(), SCHEMA, 1, [{ field: 'x', op: 'OR 1=1' }]), /Opérateur/);
});

test('filtres : comparaison numérique ou textuelle selon la valeur', () => {
  const sql = new Sql();
  const w = buildWhere(sql, SCHEMA, 1, [
    { field: 'prix', op: 'gte', value: 10 },
    { field: 'date', op: 'lte', value: '2024-12-31' },
  ]);
  assert.match(w, /::numeric END\) >= \$3/);
  assert.match(w, /\) <= \$5/);
});

// ------------------------------ Droits ----------------------------------
test('droits : matrice de visibilité', () => {
  const owner = { id: 1, role: 'user' };
  const admin = { id: 9, role: 'admin' };
  const other = { id: 2, role: 'user' };
  const priv = { owner_id: 1, visibility: 'private', shared_with_me: false };
  const sharedNotMe = { owner_id: 1, visibility: 'shared', shared_with_me: false };
  const sharedMe = { owner_id: 1, visibility: 'shared', shared_with_me: true };
  const privButShared = { owner_id: 1, visibility: 'private', shared_with_me: true };
  const pub = { owner_id: 1, visibility: 'public', shared_with_me: false };

  assert.equal(resolveAccess(priv, owner), 'owner');
  assert.equal(resolveAccess(priv, admin), 'admin');
  assert.equal(resolveAccess(priv, other), null);
  assert.equal(resolveAccess(sharedNotMe, other), null);
  assert.equal(resolveAccess(sharedMe, other), 'viewer');
  assert.equal(resolveAccess(privButShared, other), null, 'repasser en privé coupe les partages');
  assert.equal(resolveAccess(pub, other), 'viewer');
  assert.ok(canEdit('owner') && canEdit('admin') && !canEdit('viewer'));
});

// --------------------------- Filtres globaux ----------------------------
test('filtres globaux → filtres de requête', () => {
  const defs = [
    { id: 'r', field: 'region', type: 'select' },
    { id: 'p', field: 'prix', type: 'range' },
    { id: 'd', field: 'date', type: 'date-range', datasetIds: [5] },
  ];
  const values = { r: ['Nord', 'Sud'], p: { min: '10', max: '' }, d: { from: '2024-01-01', to: '2024-06-30' } };
  assert.deepEqual(toQueryFilters(defs, values, 3), [
    { field: 'region', op: 'in', value: ['Nord', 'Sud'] },
    { field: 'prix', op: 'gte', value: 10 },
  ]);
  const onDataset5 = toQueryFilters(defs, values, 5);
  assert.equal(onDataset5.length, 4);
  assert.deepEqual(onDataset5[3], { field: 'date', op: 'lte', value: '2024-06-30T23:59:59.999' });
  assert.deepEqual(toQueryFilters(defs, { r: [] }, 3), []);
});

// ------------------------------ Validation ------------------------------
test('validation dashboard : widgets bornés et ids générés', () => {
  const v = validateDashboard({
    title: '  Ventes  ',
    layout: [{ type: 'analysis', analysisId: 3, w: 9, h: -5 }, { type: 'outliers', datasetId: 2, column: 'prix', method: 'mad' }],
    visibility: 'public',
  });
  assert.equal(v.title, 'Ventes');
  assert.equal(v.layout[0].w, 4);
  assert.equal(v.layout[0].h, 1);
  assert.ok(v.layout[0].id);
  assert.equal(v.layout[1].method, 'mad');
});

test('validation : erreurs détaillées', () => {
  assert.throws(
    () => validateDashboard({ layout: [{ type: 'video' }], visibility: 'everyone' }),
    (err) => err.status === 400 && err.details.some((e) => e.field === 'title') && err.details.some((e) => e.field === 'visibility'),
  );
  assert.throws(
    () => validateAnalysis({ title: 'x', datasetId: 1, config: { query: { metrics: [{ op: 'sum' }] } } }),
    (err) => err.details[0].field === 'config.query.metrics[0].field',
  );
});
