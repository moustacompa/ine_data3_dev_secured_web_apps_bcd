'use strict';

/**
 * Moteur de requêtes sur dataset_rows (lignes stockées en JSONB).
 *
 * Sert de repli tant que P3 n'expose pas runQuery(datasetId, query), et
 * fournit les helpers utilisés par les dashboards (valeurs d'une colonne,
 * valeurs distinctes pour les filtres, liste des colonnes).
 *
 * Toutes les valeurs ET les noms de champs passent en paramètres ($n) :
 * aucune donnée utilisateur n'est concaténée dans le SQL.
 *
 * Format de requête (contrat partagé avec P3) :
 * {
 *   metrics:    [{ op: 'sum'|'avg'|'min'|'max'|'count'|'count_distinct'|'median', field?, alias? }],
 *   groupBy:    ['region'],
 *   timeBucket: { field: 'date', granularity: 'day'|'week'|'month'|'quarter'|'year', alias? },
 *   filters:    [{ field, op: 'eq'|'neq'|'in'|'gt'|'gte'|'lt'|'lte'|'between'|'contains'|'isnull'|'notnull', value }],
 *   orderBy:    { field: 'total', dir: 'asc'|'desc' },
 *   limit:      100
 * }
 * Résultat : { columns: [...], rows: [{...}] }
 */
const { httpError } = require('./errors');

const METRIC_OPS = ['sum', 'avg', 'min', 'max', 'count', 'count_distinct', 'median'];
const FILTER_OPS = ['eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'isnull', 'notnull'];
const GRANULARITIES = ['day', 'week', 'month', 'quarter', 'year'];
const NUMERIC_RE = '^\\s*-?[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?\\s*$';
const ISO_DATE_RE = '^\\d{4}-\\d{2}-\\d{2}';
const MAX_LIMIT = 1000;

class Sql {
  constructor() { this.params = []; }
  p(value) { this.params.push(value); return `$${this.params.length}`; }
}

const isNumericValue = (v) =>
  typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && new RegExp(NUMERIC_RE).test(v);

function checkField(field, label = 'champ') {
  if (typeof field !== 'string' || !field.trim() || field.length > 128) {
    throw httpError(400, `Nom de ${label} invalide.`);
  }
  return field;
}

const textExpr = (sql, schema, field) => `(r.${schema.rowsDataCol} ->> ${sql.p(checkField(field))})`;

function numExpr(sql, schema, field) {
  const t = textExpr(sql, schema, field);
  return `(CASE WHEN ${t} ~ '${NUMERIC_RE}' THEN ${t}::numeric END)`;
}

function compareExpr(sql, schema, field, op, value) {
  const cmp = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[op];
  if (isNumericValue(value)) return `${numExpr(sql, schema, field)} ${cmp} ${sql.p(Number(value))}`;
  return `${textExpr(sql, schema, field)} ${cmp} ${sql.p(String(value))}`;
}

/** Construit la clause WHERE (dataset + filtres). */
function buildWhere(sql, schema, datasetId, filters = []) {
  const parts = [`r.dataset_id = ${sql.p(datasetId)}`];
  if (!Array.isArray(filters)) throw httpError(400, 'filters doit être un tableau.');
  for (const f of filters) {
    if (!f || !FILTER_OPS.includes(f.op)) throw httpError(400, `Opérateur de filtre invalide : ${f && f.op}`);
    const { field, op, value } = f;
    switch (op) {
      case 'eq': parts.push(`${textExpr(sql, schema, field)} = ${sql.p(String(value))}`); break;
      case 'neq': parts.push(`${textExpr(sql, schema, field)} IS DISTINCT FROM ${sql.p(String(value))}`); break;
      case 'in': {
        if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
          throw httpError(400, 'Le filtre "in" attend une liste de 1 à 500 valeurs.');
        }
        parts.push(`${textExpr(sql, schema, field)} = ANY(${sql.p(value.map(String))}::text[])`);
        break;
      }
      case 'gt': case 'gte': case 'lt': case 'lte':
        if (value === undefined || value === null || value === '') throw httpError(400, 'Valeur de filtre manquante.');
        parts.push(compareExpr(sql, schema, field, op, value));
        break;
      case 'between':
        if (!Array.isArray(value) || value.length !== 2) throw httpError(400, 'Le filtre "between" attend [min, max].');
        parts.push(compareExpr(sql, schema, field, 'gte', value[0]));
        parts.push(compareExpr(sql, schema, field, 'lte', value[1]));
        break;
      case 'contains':
        parts.push(`${textExpr(sql, schema, field)} ILIKE '%' || ${sql.p(String(value))} || '%'`);
        break;
      case 'isnull': parts.push(`NULLIF(${textExpr(sql, schema, field)}, '') IS NULL`); break;
      case 'notnull': parts.push(`NULLIF(${textExpr(sql, schema, field)}, '') IS NOT NULL`); break;
      default: break;
    }
  }
  return parts.join(' AND ');
}

function metricExpr(sql, schema, m) {
  switch (m.op) {
    case 'count':
      return m.field ? `COUNT(NULLIF(${textExpr(sql, schema, m.field)}, ''))` : 'COUNT(*)';
    case 'count_distinct':
      return `COUNT(DISTINCT NULLIF(${textExpr(sql, schema, checkField(m.field))}, ''))`;
    case 'median':
      return `percentile_cont(0.5) WITHIN GROUP (ORDER BY ${numExpr(sql, schema, m.field)})`;
    default:
      return `${m.op.toUpperCase()}(${numExpr(sql, schema, m.field)})`;
  }
}

/** Construit la requête SQL d'agrégation. Exportée pour les tests. */
function buildAggregateQuery(schema, datasetId, query = {}) {
  const sql = new Sql();
  const metrics = Array.isArray(query.metrics) && query.metrics.length ? query.metrics : [{ op: 'count' }];
  const groupBy = Array.isArray(query.groupBy) ? query.groupBy : [];
  if (metrics.length > 10) throw httpError(400, '10 indicateurs maximum.');
  if (groupBy.length > 3) throw httpError(400, '3 regroupements maximum.');

  const selects = [];
  const groupCols = []; // { alias, name }

  if (query.timeBucket) {
    const { field, granularity = 'month', alias } = query.timeBucket;
    if (!GRANULARITIES.includes(granularity)) throw httpError(400, 'Granularité temporelle invalide.');
    const t = textExpr(sql, schema, field);
    selects.push(
      `to_char(date_trunc('${granularity}', CASE WHEN ${t} ~ '${ISO_DATE_RE}' THEN ${t}::timestamp END), 'YYYY-MM-DD') AS t0`,
    );
    groupCols.push({ alias: 't0', name: alias || field, isTime: true });
  }
  groupBy.forEach((field, i) => {
    selects.push(`${textExpr(sql, schema, field)} AS g${i}`);
    groupCols.push({ alias: `g${i}`, name: field });
  });

  const metricCols = metrics.map((m, i) => {
    if (!m || !METRIC_OPS.includes(m.op)) throw httpError(400, `Indicateur invalide : ${m && m.op}`);
    if (m.op !== 'count' && !m.field) throw httpError(400, `L'indicateur "${m.op}" nécessite un champ.`);
    selects.push(`${metricExpr(sql, schema, m)} AS m${i}`);
    return { alias: `m${i}`, name: m.alias || (m.field ? `${m.op}_${m.field}` : m.op) };
  });

  const where = buildWhere(sql, schema, datasetId, query.filters);
  const groupClause = groupCols.length ? `GROUP BY ${groupCols.map((_, i) => i + 1).join(', ')}` : '';

  let orderClause = '';
  const all = [...groupCols, ...metricCols];
  if (query.orderBy && query.orderBy.field) {
    const target = all.find((c) => c.name === query.orderBy.field);
    const dir = String(query.orderBy.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    if (target) orderClause = `ORDER BY ${target.alias} ${dir} NULLS LAST`;
  } else if (groupCols.some((c) => c.isTime)) {
    orderClause = 'ORDER BY t0 ASC NULLS LAST';
  } else if (groupCols.length) {
    orderClause = 'ORDER BY m0 DESC NULLS LAST';
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 500, 1), MAX_LIMIT);
  const text = `SELECT ${selects.join(', ')} FROM dataset_rows r WHERE ${where} ${groupClause} ${orderClause} LIMIT ${limit}`
    .replace(/\s+/g, ' ').trim();
  return { text, params: sql.params, groupCols, metricCols };
}

const toNumber = (v) => (v === null || v === undefined ? null : Number(v));

async function runQuery(db, schema, datasetId, query) {
  const { text, params, groupCols, metricCols } = buildAggregateQuery(schema, datasetId, query);
  const { rows } = await db.query(text, params);
  return {
    columns: [...groupCols.map((c) => c.name), ...metricCols.map((c) => c.name)],
    rows: rows.map((row) => {
      const out = {};
      groupCols.forEach((c) => { out[c.name] = row[c.alias]; });
      metricCols.forEach((c) => {
        const n = toNumber(row[c.alias]);
        out[c.name] = n === null ? null : Math.round(n * 10000) / 10000;
      });
      return out;
    }),
  };
}

async function fetchColumnValues(db, schema, datasetId, column, filters = [], limit = 100000) {
  const sql = new Sql();
  const num = numExpr(sql, schema, column);
  const where = buildWhere(sql, schema, datasetId, filters);
  const { rows } = await db.query(
    `SELECT r.id AS row_id, ${num} AS v FROM dataset_rows r WHERE ${where} AND ${num} IS NOT NULL LIMIT ${Math.min(limit, 200000)}`,
    sql.params,
  );
  return rows.map((r) => ({ rowId: r.row_id, value: Number(r.v) }));
}

async function distinctValues(db, schema, datasetId, field, limit = 200) {
  const sql = new Sql();
  const t = textExpr(sql, schema, field);
  const where = buildWhere(sql, schema, datasetId, []);
  const { rows } = await db.query(
    `SELECT DISTINCT ${t} AS v FROM dataset_rows r WHERE ${where} AND NULLIF(${t}, '') IS NOT NULL ORDER BY 1 LIMIT ${Math.min(limit, 500)}`,
    sql.params,
  );
  return rows.map((r) => r.v);
}

/** Colonnes d'un dataset déduites d'un échantillon de 500 lignes. */
async function listColumns(db, schema, datasetId) {
  const { rows } = await db.query(
    `SELECT kv.key AS name,
            COUNT(*)::int AS filled,
            COUNT(*) FILTER (WHERE kv.value ~ '${NUMERIC_RE}')::int AS numeric,
            COUNT(*) FILTER (WHERE kv.value ~ '${ISO_DATE_RE}')::int AS dates
       FROM (SELECT ${schema.rowsDataCol} AS data FROM dataset_rows WHERE dataset_id = $1 LIMIT 500) s,
            LATERAL jsonb_each_text(s.data) kv
      WHERE NULLIF(kv.value, '') IS NOT NULL
      GROUP BY kv.key
      ORDER BY kv.key`,
    [datasetId],
  );
  return rows.map((r) => ({
    name: r.name,
    type: r.numeric / r.filled >= 0.9 ? 'number' : r.dates / r.filled >= 0.9 ? 'date' : 'text',
  }));
}

module.exports = {
  METRIC_OPS, FILTER_OPS, GRANULARITIES,
  buildWhere, buildAggregateQuery, runQuery, fetchColumnValues, distinctValues, listColumns, Sql,
};
