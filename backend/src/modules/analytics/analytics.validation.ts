// =============================================================================
// MODULE P3 - VALIDATION STRICTE DES REQUÊTES D'ANALYSE
// =============================================================================
// Deux étapes :
//   1. validateQueryRequest : structure, types, listes blanches, bornes
//      (avant tout accès à la base) ;
//   2. checkQueryColumns : chaque champ référencé doit exister dans le
//      dataset, avec un type compatible avec l'opération demandée.
// Les clés inconnues sont refusées.
// =============================================================================
import { ErrorDetail, validationError } from './analytics.errors.js';
import { MAX_GROUP_BY, MAX_LIMIT, MAX_METRICS, RANK_COLUMN, SHARE_COLUMN, metricName } from './query.builder.js';
import {
  AnalyticsQuery, ColumnInfo, Filter, Metric, TimeBucket,
  METRIC_OPS, FILTER_OPS, GRANULARITIES, MetricOp, FilterOp, Granularity,
} from './analytics.types.js';

const MAX_FILTERS = 20;
const MAX_IN_VALUES = 500;
const MAX_VALUE_LENGTH = 500;
const MAX_DATASET_ID = 2147483647; // datasets.id est un SERIAL (table provisoire de P2)
const ALIAS_RE = /^[\p{L}\p{N}_ -]{1,64}$/u;
const NUMERIC_OPS: MetricOp[] = ['sum', 'avg', 'min', 'max', 'median'];

const QUERY_KEYS = ['metrics', 'groupBy', 'timeBucket', 'filters', 'orderBy', 'limit', 'rank'];

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const isFieldName = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 128;

const isScalar = (v: unknown) =>
  (typeof v === 'string' && v.length <= MAX_VALUE_LENGTH)
  || (typeof v === 'number' && Number.isFinite(v))
  || typeof v === 'boolean';

class Checker {
  errors: ErrorDetail[] = [];
  fail(field: string, message: string) { this.errors.push({ field, message }); }
  unknownKeys(obj: Record<string, unknown>, allowed: string[], prefix: string) {
    Object.keys(obj).filter((k) => !allowed.includes(k)).forEach((k) => this.fail(`${prefix}${k}`, 'Champ non autorisé.'));
  }
  done() {
    if (this.errors.length) throw validationError('Requête d\'analyse invalide.', this.errors);
  }
}

// 1. Identifiant de dataset (corps de requête ou paramètre d'URL)
export function parseDatasetId(raw: unknown): number | null {
  const n = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
  return Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_DATASET_ID ? (n as number) : null;
}

function checkMetrics(c: Checker, raw: unknown): Metric[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > MAX_METRICS) {
    c.fail('query.metrics', `Liste de ${MAX_METRICS} indicateurs maximum.`);
    return undefined;
  }
  return raw.map((m, i) => {
    const p = `query.metrics[${i}]`;
    if (!isPlainObject(m)) { c.fail(p, 'Indicateur invalide.'); return { op: 'count' as MetricOp }; }
    c.unknownKeys(m, ['op', 'field', 'alias'], `${p}.`);
    const out: Metric = { op: m.op as MetricOp };
    if (!(METRIC_OPS as readonly unknown[]).includes(m.op)) c.fail(`${p}.op`, `Valeurs possibles : ${METRIC_OPS.join(', ')}.`);
    if (m.field !== undefined) {
      if (!isFieldName(m.field)) c.fail(`${p}.field`, 'Nom de colonne invalide.');
      else out.field = m.field;
    } else if (m.op !== 'count') c.fail(`${p}.field`, 'Colonne obligatoire pour cet indicateur.');
    if (m.alias !== undefined) {
      if (typeof m.alias !== 'string' || !ALIAS_RE.test(m.alias)) c.fail(`${p}.alias`, 'Alias invalide (64 caractères alphanumériques maximum).');
      else out.alias = m.alias;
    }
    return out;
  });
}

function checkGroupBy(c: Checker, raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > MAX_GROUP_BY || raw.some((g) => !isFieldName(g))) {
    c.fail('query.groupBy', `Liste de ${MAX_GROUP_BY} colonnes maximum.`);
    return undefined;
  }
  if (new Set(raw).size !== raw.length) c.fail('query.groupBy', 'Colonne en double.');
  return raw as string[];
}

function checkTimeBucket(c: Checker, raw: unknown): TimeBucket | null | undefined {
  if (raw === undefined || raw === null) return raw as null | undefined;
  if (!isPlainObject(raw)) { c.fail('query.timeBucket', 'Doit être un objet { field, granularity }.'); return undefined; }
  c.unknownKeys(raw, ['field', 'granularity', 'alias'], 'query.timeBucket.');
  const out: TimeBucket = { field: raw.field as string };
  if (!isFieldName(raw.field)) c.fail('query.timeBucket.field', 'Colonne date obligatoire.');
  if (raw.granularity !== undefined) {
    if (!(GRANULARITIES as readonly unknown[]).includes(raw.granularity)) c.fail('query.timeBucket.granularity', `Valeurs possibles : ${GRANULARITIES.join(', ')}.`);
    else out.granularity = raw.granularity as Granularity;
  }
  if (raw.alias !== undefined) {
    if (typeof raw.alias !== 'string' || !ALIAS_RE.test(raw.alias)) c.fail('query.timeBucket.alias', 'Alias invalide.');
    else out.alias = raw.alias;
  }
  return out;
}

function checkFilterValue(c: Checker, p: string, op: FilterOp, value: unknown) {
  switch (op) {
    case 'isnull': case 'notnull':
      return;
    case 'in':
      if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IN_VALUES || !value.every(isScalar)) {
        c.fail(`${p}.value`, `Liste de 1 à ${MAX_IN_VALUES} valeurs attendue.`);
      }
      return;
    case 'between':
      if (!Array.isArray(value) || value.length !== 2 || !value.every((v) => isScalar(v) && v !== '')) {
        c.fail(`${p}.value`, 'Intervalle [min, max] attendu.');
      }
      return;
    case 'gt': case 'gte': case 'lt': case 'lte':
      if (!isScalar(value) || value === '') c.fail(`${p}.value`, 'Valeur obligatoire.');
      return;
    default:
      if (!isScalar(value)) c.fail(`${p}.value`, 'Valeur simple attendue (texte, nombre ou booléen).');
  }
}

function checkFilters(c: Checker, raw: unknown): Filter[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > MAX_FILTERS) {
    c.fail('query.filters', `Liste de ${MAX_FILTERS} filtres maximum.`);
    return undefined;
  }
  return raw.map((f, i) => {
    const p = `query.filters[${i}]`;
    if (!isPlainObject(f)) { c.fail(p, 'Filtre invalide.'); return { field: '', op: 'eq' as FilterOp }; }
    c.unknownKeys(f, ['field', 'op', 'value'], `${p}.`);
    if (!isFieldName(f.field)) c.fail(`${p}.field`, 'Nom de colonne invalide.');
    if (!(FILTER_OPS as readonly unknown[]).includes(f.op)) c.fail(`${p}.op`, `Valeurs possibles : ${FILTER_OPS.join(', ')}.`);
    else checkFilterValue(c, p, f.op as FilterOp, f.value);
    const out: Filter = { field: f.field as string, op: f.op as FilterOp };
    if (f.value !== undefined) out.value = f.value;
    return out;
  });
}

// 2. Validation structurelle de POST /api/analytics/query
export function validateQueryRequest(body: unknown): { datasetId: number; query: AnalyticsQuery } {
  const c = new Checker();
  if (!isPlainObject(body)) throw validationError('Corps de requête invalide.');
  c.unknownKeys(body, ['datasetId', 'query'], '');

  const datasetId = parseDatasetId(body.datasetId);
  if (datasetId === null) c.fail('datasetId', 'Identifiant de dataset invalide.');

  const raw = body.query;
  const query: AnalyticsQuery = {};
  if (!isPlainObject(raw)) {
    c.fail('query', 'Doit être un objet { metrics, groupBy, timeBucket, filters, orderBy, limit }.');
  } else {
    c.unknownKeys(raw, QUERY_KEYS, 'query.');
    const metrics = checkMetrics(c, raw.metrics);
    if (metrics) query.metrics = metrics;
    const groupBy = checkGroupBy(c, raw.groupBy);
    if (groupBy) query.groupBy = groupBy;
    const timeBucket = checkTimeBucket(c, raw.timeBucket);
    if (timeBucket) query.timeBucket = timeBucket;
    const filters = checkFilters(c, raw.filters);
    if (filters) query.filters = filters;

    if (raw.orderBy !== undefined && raw.orderBy !== null) {
      const o = raw.orderBy;
      if (!isPlainObject(o) || !isFieldName(o.field)) c.fail('query.orderBy', 'Doit être un objet { field, dir }.');
      else {
        c.unknownKeys(o, ['field', 'dir'], 'query.orderBy.');
        if (o.dir !== undefined && o.dir !== 'asc' && o.dir !== 'desc') c.fail('query.orderBy.dir', 'Valeurs possibles : asc, desc.');
        query.orderBy = { field: o.field as string, ...(o.dir ? { dir: o.dir as 'asc' | 'desc' } : {}) };
      }
    }
    if (raw.limit !== undefined) {
      if (!Number.isInteger(raw.limit) || (raw.limit as number) < 1 || (raw.limit as number) > MAX_LIMIT) {
        c.fail('query.limit', `Entier entre 1 et ${MAX_LIMIT}.`);
      } else query.limit = raw.limit as number;
    }
    if (raw.rank !== undefined) {
      if (typeof raw.rank !== 'boolean') c.fail('query.rank', 'Doit être un booléen.');
      else query.rank = raw.rank;
    }
  }
  c.done();
  return { datasetId: datasetId as number, query };
}

// 3. Contrôle des colonnes contre les métadonnées du dataset
export function checkQueryColumns(query: AnalyticsQuery, columns: ColumnInfo[]): void {
  const c = new Checker();
  const types = new Map(columns.map((col) => [col.name, col.type]));
  const exists = (field: string, path: string) => {
    if (!types.has(field)) { c.fail(path, `Colonne inconnue dans ce dataset : ${field}.`); return false; }
    return true;
  };

  (query.metrics || []).forEach((m, i) => {
    if (!m.field) return;
    if (exists(m.field, `query.metrics[${i}].field`) && NUMERIC_OPS.includes(m.op) && types.get(m.field) !== 'number') {
      c.fail(`query.metrics[${i}].field`, `L'opération ${m.op} nécessite une colonne numérique (${m.field} est de type ${types.get(m.field)}).`);
    }
  });
  (query.groupBy || []).forEach((g, i) => exists(g, `query.groupBy[${i}]`));
  if (query.timeBucket && exists(query.timeBucket.field, 'query.timeBucket.field') && types.get(query.timeBucket.field) !== 'date') {
    c.fail('query.timeBucket.field', `La série temporelle nécessite une colonne date (${query.timeBucket.field} est de type ${types.get(query.timeBucket.field)}).`);
  }
  (query.filters || []).forEach((f, i) => exists(f.field, `query.filters[${i}].field`));

  // Noms des colonnes du résultat : ils doivent être uniques (clés des lignes JSON)
  const groupNames = [
    ...(query.timeBucket ? [query.timeBucket.alias || query.timeBucket.field] : []),
    ...(query.groupBy || []),
  ];
  const metrics = query.metrics && query.metrics.length ? query.metrics : [{ op: 'count' as MetricOp }];
  const names = [...groupNames, ...metrics.map(metricName), ...(query.rank ? [RANK_COLUMN, SHARE_COLUMN] : [])];
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) c.fail('query', `Nom de colonne de résultat en double : ${dup} (utilisez un alias).`);

  if (query.orderBy && !names.includes(query.orderBy.field)) {
    c.fail('query.orderBy.field', `Tri possible uniquement sur une colonne du résultat : ${names.join(', ')}.`);
  }
  if (query.rank && !groupNames.length) {
    c.fail('query.rank', 'Le classement nécessite au moins un regroupement (groupBy ou timeBucket).');
  }
  c.done();
}
