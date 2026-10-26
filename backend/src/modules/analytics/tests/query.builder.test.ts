// Tests unitaires du constructeur SQL (sans base de données)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAggregateQuery, mapRows } from '../query.builder.js';
import { AnalyticsError } from '../analytics.errors.js';

const DS = 7;

test('SUM, AVG, MIN et MAX produisent les agrégats SQL attendus sur la colonne numérique', () => {
  const built = buildAggregateQuery(DS, {
    metrics: [
      { op: 'sum', field: 'montant' }, { op: 'avg', field: 'montant' },
      { op: 'min', field: 'montant' }, { op: 'max', field: 'montant' },
    ],
  });
  for (const fn of ['SUM', 'AVG', 'MIN', 'MAX']) assert.match(built.text, new RegExp(`${fn}\\(\\(CASE WHEN`));
  assert.deepEqual(built.metricCols.map((c) => c.name), ['sum_montant', 'avg_montant', 'min_montant', 'max_montant']);
  assert.equal(built.params.at(-1), DS, 'le dataset est filtré par paramètre');
  assert.doesNotMatch(built.text, /GROUP BY/);
});

test('GROUP BY : une colonne par regroupement, tri par défaut sur le premier indicateur', () => {
  const built = buildAggregateQuery(DS, { metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }], groupBy: ['region', 'produit'] });
  assert.match(built.text, /GROUP BY 1, 2/);
  assert.match(built.text, /ORDER BY m0 DESC NULLS LAST/);
  assert.deepEqual(built.groupCols.map((c) => c.name), ['region', 'produit']);
});

test('série temporelle : date_trunc sur la granularité et tri chronologique', () => {
  const built = buildAggregateQuery(DS, { timeBucket: { field: 'date', granularity: 'quarter', alias: 'trimestre' } });
  assert.match(built.text, /date_trunc\('quarter'/);
  assert.match(built.text, /ORDER BY t0 ASC/);
  assert.equal(built.groupCols[0].name, 'trimestre');
});

test('classement : RANK() et part du total, limite appliquée au classement', () => {
  const built = buildAggregateQuery(DS, {
    metrics: [{ op: 'sum', field: 'montant', alias: 'ca' }], groupBy: ['region'], rank: true, limit: 3,
  });
  assert.match(built.text, /RANK\(\) OVER \(ORDER BY q\.m0 DESC NULLS LAST\) AS rk/);
  assert.match(built.text, /ORDER BY rk ASC LIMIT 3$/);
  const out = mapRows(built, [{ g0: 'Nord', m0: '15292.85', rk: '1', sh: '33.80' }]);
  assert.deepEqual(out.columns, ['region', 'ca', 'rank', 'share_pct']);
  assert.deepEqual(out.rows[0], { region: 'Nord', ca: 15292.85, rank: 1, share_pct: 33.8 });
});

test('noms de champs et valeurs passent en paramètres, jamais dans le texte SQL', () => {
  const evil = "x'); DROP TABLE users; --";
  const built = buildAggregateQuery(DS, {
    metrics: [{ op: 'sum', field: evil }], groupBy: [evil], filters: [{ field: evil, op: 'eq', value: evil }],
  });
  assert.ok(!built.text.includes('DROP TABLE'));
  assert.ok(built.params.includes(evil));
});

test('la limite est bornée à 1000 lignes et le mode probe demande une ligne de plus', () => {
  assert.match(buildAggregateQuery(DS, { limit: 99999 }).text, /LIMIT 1000$/);
  assert.match(buildAggregateQuery(DS, { limit: 10 }, { probe: true }).text, /LIMIT 11$/);
});

test('opérations inconnues rejetées avec une erreur 400', () => {
  const bad: unknown[] = [
    { metrics: [{ op: 'drop', field: 'montant' }] },
    { metrics: [{ op: 'sum' }] },
    { timeBucket: { field: 'date', granularity: 'century' } },
    { filters: [{ field: 'region', op: 'like', value: 'x' }] },
    { groupBy: ['region'], filters: 'region=Nord' },
    { rank: true },
  ];
  for (const q of bad) {
    assert.throws(() => buildAggregateQuery(DS, q as never), (e: unknown) => e instanceof AnalyticsError && e.status === 400);
  }
});
