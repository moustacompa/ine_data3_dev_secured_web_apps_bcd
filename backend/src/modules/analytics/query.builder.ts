// =============================================================================
// MODULE P3 - CONSTRUCTEUR DE REQUÊTES SQL D'AGRÉGATION
// =============================================================================
// Les lignes d'un dataset sont stockées en JSONB (dataset_rows.data).
// Règle de sécurité : les VALEURS comme les NOMS DE CHAMPS passent en
// paramètres ($n). Seuls des fragments constants (regex, mots-clés validés
// par liste blanche) sont écrits dans le texte SQL.
//
// Compatibilité P4 : pour une requête au format P4 (sans `rank`), le SQL et
// les paramètres générés sont identiques à ceux de dashboards/queryEngine.js
// (vérifié par tests/p4-compat.test.ts).
// =============================================================================
import { validationError } from './analytics.errors.js';
import {
  AnalyticsQuery, Filter, Metric, QueryResult, ResultRow,
  METRIC_OPS, FILTER_OPS, GRANULARITIES,
} from './analytics.types.js';

export const NUMERIC_RE = '^\\s*-?[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?\\s*$';
export const ISO_DATE_RE = '^\\d{4}-\\d{2}-\\d{2}';
export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 1000;
export const MAX_METRICS = 10;
export const MAX_GROUP_BY = 3;
export const RANK_COLUMN = 'rank';
export const SHARE_COLUMN = 'share_pct';

// Table et colonne JSONB de P2 (mêmes variables d'environnement que P4)
const ROWS_DATA_COL = (() => {
  const v = process.env.P4_ROWS_DATA_COL || 'data';
  if (!/^[a-z_][a-z0-9_]*$/i.test(v)) throw new Error(`Identifiant SQL invalide : ${v}`);
  return v;
})();

// 1. Accumulateur de paramètres positionnels
export class Sql {
  params: unknown[] = [];
  p(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

const isNumericValue = (v: unknown) =>
  typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && new RegExp(NUMERIC_RE).test(v);

function checkField(field: unknown): string {
  if (typeof field !== 'string' || !field.trim() || field.length > 128) {
    throw validationError('Nom de champ invalide.');
  }
  return field;
}

// 2. Expressions sur une clé JSONB
const textExpr = (sql: Sql, field: unknown) => `(r.${ROWS_DATA_COL} ->> ${sql.p(checkField(field))})`;

function numExpr(sql: Sql, field: unknown): string {
  const t = textExpr(sql, field);
  return `(CASE WHEN ${t} ~ '${NUMERIC_RE}' THEN ${t}::numeric END)`;
}

function compareExpr(sql: Sql, field: string, op: 'gt' | 'gte' | 'lt' | 'lte', value: unknown): string {
  const cmp = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[op];
  if (isNumericValue(value)) return `${numExpr(sql, field)} ${cmp} ${sql.p(Number(value))}`;
  return `${textExpr(sql, field)} ${cmp} ${sql.p(String(value))}`;
}

// 3. Clause WHERE : dataset + filtres
export function buildWhere(sql: Sql, datasetId: number, filters: Filter[] = []): string {
  const parts = [`r.dataset_id = ${sql.p(datasetId)}`];
  if (!Array.isArray(filters)) throw validationError('filters doit être un tableau.');
  for (const f of filters) {
    if (!f || !(FILTER_OPS as readonly string[]).includes(f.op)) {
      throw validationError(`Opérateur de filtre invalide : ${f && f.op}`);
    }
    const { field, op, value } = f;
    switch (op) {
      case 'eq': parts.push(`${textExpr(sql, field)} = ${sql.p(String(value))}`); break;
      case 'neq': parts.push(`${textExpr(sql, field)} IS DISTINCT FROM ${sql.p(String(value))}`); break;
      case 'in': {
        if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
          throw validationError('Le filtre "in" attend une liste de 1 à 500 valeurs.');
        }
        parts.push(`${textExpr(sql, field)} = ANY(${sql.p(value.map(String))}::text[])`);
        break;
      }
      case 'gt': case 'gte': case 'lt': case 'lte':
        if (value === undefined || value === null || value === '') throw validationError('Valeur de filtre manquante.');
        parts.push(compareExpr(sql, field, op, value));
        break;
      case 'between':
        if (!Array.isArray(value) || value.length !== 2) throw validationError('Le filtre "between" attend [min, max].');
        parts.push(compareExpr(sql, field, 'gte', value[0]));
        parts.push(compareExpr(sql, field, 'lte', value[1]));
        break;
      case 'contains':
        parts.push(`${textExpr(sql, field)} ILIKE '%' || ${sql.p(String(value))} || '%'`);
        break;
      case 'isnull': parts.push(`NULLIF(${textExpr(sql, field)}, '') IS NULL`); break;
      case 'notnull': parts.push(`NULLIF(${textExpr(sql, field)}, '') IS NOT NULL`); break;
      default: break;
    }
  }
  return parts.join(' AND ');
}

// 4. Expression d'un indicateur (SUM, AVG, MIN, MAX, COUNT, ...)
function metricExpr(sql: Sql, m: Metric): string {
  switch (m.op) {
    case 'count':
      return m.field ? `COUNT(NULLIF(${textExpr(sql, m.field)}, ''))` : 'COUNT(*)';
    case 'count_distinct':
      return `COUNT(DISTINCT NULLIF(${textExpr(sql, checkField(m.field))}, ''))`;
    case 'median':
      return `percentile_cont(0.5) WITHIN GROUP (ORDER BY ${numExpr(sql, m.field)})`;
    default:
      return `${m.op.toUpperCase()}(${numExpr(sql, m.field)})`;
  }
}

/** Nom de la colonne de résultat d'un indicateur (même règle que P4). */
export const metricName = (m: Metric) => m.alias || (m.field ? `${m.op}_${m.field}` : m.op);

interface OutCol { alias: string; name: string; isTime?: boolean }

export interface BuiltQuery {
  text: string;
  params: unknown[];
  groupCols: OutCol[];
  metricCols: OutCol[];
  extraCols: OutCol[];
  limit: number;
}

export interface BuildOptions {
  // Demande une ligne de plus que la limite pour savoir si le résultat est tronqué
  probe?: boolean;
}

// 5. Requête d'agrégation complète
export function buildAggregateQuery(datasetId: number, query: AnalyticsQuery = {}, options: BuildOptions = {}): BuiltQuery {
  const sql = new Sql();
  const metrics: Metric[] = Array.isArray(query.metrics) && query.metrics.length ? query.metrics : [{ op: 'count' }];
  const groupBy = Array.isArray(query.groupBy) ? query.groupBy : [];
  if (metrics.length > MAX_METRICS) throw validationError(`${MAX_METRICS} indicateurs maximum.`);
  if (groupBy.length > MAX_GROUP_BY) throw validationError(`${MAX_GROUP_BY} regroupements maximum.`);

  const selects: string[] = [];
  const groupCols: OutCol[] = [];

  // a. Série temporelle : regroupement par période
  if (query.timeBucket) {
    const { field, granularity = 'month', alias } = query.timeBucket;
    if (!(GRANULARITIES as readonly string[]).includes(granularity)) throw validationError('Granularité temporelle invalide.');
    const t = textExpr(sql, field);
    selects.push(
      `to_char(date_trunc('${granularity}', CASE WHEN ${t} ~ '${ISO_DATE_RE}' THEN ${t}::timestamp END), 'YYYY-MM-DD') AS t0`,
    );
    groupCols.push({ alias: 't0', name: alias || field, isTime: true });
  }

  // b. GROUP BY sur des colonnes catégorielles
  groupBy.forEach((field, i) => {
    selects.push(`${textExpr(sql, field)} AS g${i}`);
    groupCols.push({ alias: `g${i}`, name: field });
  });

  // c. Indicateurs
  const metricCols = metrics.map((m, i) => {
    if (!m || !(METRIC_OPS as readonly string[]).includes(m.op)) throw validationError(`Indicateur invalide : ${m && m.op}`);
    if (m.op !== 'count' && !m.field) throw validationError(`L'indicateur "${m.op}" nécessite un champ.`);
    selects.push(`${metricExpr(sql, m)} AS m${i}`);
    return { alias: `m${i}`, name: metricName(m) };
  });

  const where = buildWhere(sql, datasetId, query.filters);
  const groupClause = groupCols.length ? `GROUP BY ${groupCols.map((_, i) => i + 1).join(', ')}` : '';

  // d. Tri
  let orderClause = '';
  const all = [...groupCols, ...metricCols];
  const orderTarget = query.orderBy && query.orderBy.field ? all.find((c) => c.name === query.orderBy!.field) : undefined;
  const orderDir = String(query.orderBy?.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  if (query.orderBy && query.orderBy.field) {
    if (orderTarget) orderClause = `ORDER BY ${orderTarget.alias} ${orderDir} NULLS LAST`;
  } else if (groupCols.some((c) => c.isTime)) {
    orderClause = 'ORDER BY t0 ASC NULLS LAST';
  } else if (groupCols.length) {
    orderClause = 'ORDER BY m0 DESC NULLS LAST';
  }

  const limit = Math.min(Math.max(parseInt(String(query.limit), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const sqlLimit = options.probe ? limit + 1 : limit;
  const base = `SELECT ${selects.join(', ')} FROM dataset_rows r WHERE ${where} ${groupClause}`;

  // e. [P3] Classement : rang et part du total, calculés sur les groupes agrégés
  const extraCols: OutCol[] = [];
  let text: string;
  if (query.rank) {
    if (!groupCols.length) throw validationError('Le classement nécessite au moins un regroupement (groupBy ou timeBucket).');
    const target = orderTarget && orderTarget.alias.startsWith('m') ? orderTarget : metricCols[0];
    const dir = orderTarget && orderTarget.alias.startsWith('m') ? orderDir : 'DESC';
    extraCols.push({ alias: 'rk', name: RANK_COLUMN }, { alias: 'sh', name: SHARE_COLUMN });
    text = `SELECT q.*, RANK() OVER (ORDER BY q.${target.alias} ${dir} NULLS LAST) AS rk, `
      + `ROUND((100 * q.${target.alias} / NULLIF(SUM(q.${target.alias}) OVER (), 0))::numeric, 2) AS sh `
      + `FROM (${base}) q ORDER BY rk ASC LIMIT ${sqlLimit}`;
  } else {
    text = `${base} ${orderClause} LIMIT ${sqlLimit}`;
  }

  return { text: text.replace(/\s+/g, ' ').trim(), params: sql.params, groupCols, metricCols, extraCols, limit };
}

const toNumber = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const round4 = (n: number | null) => (n === null ? null : Math.round(n * 10000) / 10000);

// 6. Conversion des lignes SQL (alias t0/g0/m0...) vers les noms de colonnes publics
export function mapRows(built: BuiltQuery, rows: Record<string, unknown>[]): QueryResult {
  const { groupCols, metricCols, extraCols } = built;
  return {
    columns: [...groupCols, ...metricCols, ...extraCols].map((c) => c.name),
    rows: rows.map((row) => {
      const out: ResultRow = {};
      groupCols.forEach((c) => { out[c.name] = row[c.alias] as string | null; });
      metricCols.forEach((c) => { out[c.name] = round4(toNumber(row[c.alias])); });
      extraCols.forEach((c) => { out[c.name] = toNumber(row[c.alias]); });
      return out;
    }),
  };
}
