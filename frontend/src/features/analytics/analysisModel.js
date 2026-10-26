/**
 * Modèle de la page Analyse : formulaire ↔ requête de l'API ↔ analyses.config (P4).
 *
 * analyses.config (format P4, validé par dashboards/validate.js) :
 *   { query: <requête POST /api/analytics/query>, chart: { type, x, y: string[], options } }
 * La requête enregistrée est exactement celle qui a été exécutée.
 */

export const OP_LABELS = {
  sum: 'Somme',
  avg: 'Moyenne',
  min: 'Minimum',
  max: 'Maximum',
  median: 'Médiane',
  count: 'Nombre',
  count_distinct: 'Valeurs distinctes',
};
// Opérations qui exigent une colonne numérique (même liste que le backend)
export const NUMERIC_OPS = ['sum', 'avg', 'min', 'max', 'median'];

export const FILTER_LABELS = {
  eq: 'est égal à',
  neq: 'est différent de',
  in: 'fait partie de',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'entre',
  contains: 'contient',
  isnull: 'est vide',
  notnull: "n'est pas vide",
};
export const NO_VALUE_OPS = ['isnull', 'notnull'];

export const GRANULARITY_LABELS = { day: 'Jour', week: 'Semaine', month: 'Mois', quarter: 'Trimestre', year: 'Année' };

export const CHART_TYPES = [
  { type: 'bar', label: 'Barres', hint: 'Comparer des catégories entre elles' },
  { type: 'line', label: 'Courbe', hint: 'Suivre une évolution dans le temps' },
  { type: 'pie', label: 'Secteurs', hint: 'Répartir un total entre quelques catégories' },
  { type: 'histogram', label: 'Histogramme', hint: "Distribution d'une variable numérique" },
  { type: 'kpi', label: 'KPI', hint: 'Indicateur agrégé, sans regroupement' },
  { type: 'table', label: 'Tableau', hint: 'Toutes les lignes du résultat' },
];

// Lisibilité des graphiques
export const PIE_MAX_CATEGORIES = 12;
export const HIGH_CARDINALITY = 25; // au-delà, un regroupement devient difficile à lire
export const IDEAL_TIME_POINTS = 36;
export const MAX_TIME_POINTS = 60;
// Barres : catégories tracées (le tableau garde toujours toutes les lignes)
export const CATEGORY_VIEWS = [
  { id: 'top10', label: 'Top 10', maxCategories: 10 },
  { id: 'top20', label: 'Top 20', maxCategories: 20 },
  { id: 'all', label: 'Toutes (défilement)', categoryMode: 'all' },
];

const RANK_COLUMN = 'rank';
const SHARE_COLUMN = 'share_pct';

/** Nom de la colonne de résultat d'un indicateur (même règle que le backend). */
export const metricName = (m) => m.alias || (m.field ? `${m.op}_${m.field}` : m.op);

export function metricLabel(m) {
  if (m.alias) return m.alias;
  if (m.op === 'count' && !m.field) return 'Nombre de lignes';
  if (m.op === 'count') return `Nombre de valeurs de ${m.field}`;
  return `${OP_LABELS[m.op] || m.op} de ${m.field}`;
}

let nextId = 1;
const newFilterId = () => `f${nextId++}`;

export const emptyForm = () => ({
  mode: 'aggregate', // 'aggregate' | 'distribution'
  metrics: [],
  groupBy: [],
  timeField: '',
  timeAlias: '', // conservé à l'ouverture d'une analyse existante
  granularity: 'month',
  filters: [],
  orderField: '',
  orderDir: 'desc',
  limit: '',
  rank: false,
  distField: '',
  bins: '',
});

export const newFilter = (field = '') => ({ id: newFilterId(), field, op: 'eq', value: '', value2: '' });

// --------------------------------------------------------------- Filtres
function castValue(raw, type) {
  const v = String(raw ?? '').trim();
  if (type === 'number' && v !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}

/** Filtres du formulaire → filtres de l'API (les lignes incomplètes sont ignorées). */
export function buildFilters(filters, types) {
  return filters
    .filter((f) => f.field && f.op)
    .map((f) => {
      const type = types[f.field];
      if (NO_VALUE_OPS.includes(f.op)) return { field: f.field, op: f.op };
      if (f.op === 'in') {
        const values = String(f.value).split(';').map((v) => castValue(v, type)).filter((v) => v !== '');
        return values.length ? { field: f.field, op: 'in', value: values } : null;
      }
      if (f.op === 'between') {
        const a = castValue(f.value, type);
        const b = castValue(f.value2, type);
        return a !== '' && b !== '' ? { field: f.field, op: 'between', value: [a, b] } : null;
      }
      const value = castValue(f.value, type);
      return value !== '' ? { field: f.field, op: f.op, value } : null;
    })
    .filter(Boolean);
}

/** Filtres de l'API → lignes du formulaire (ouverture d'une analyse). */
function filtersToForm(filters = []) {
  return filters.map((f) => {
    const row = newFilter(f.field);
    row.op = f.op;
    if (f.op === 'in' && Array.isArray(f.value)) row.value = f.value.join(' ; ');
    else if (f.op === 'between' && Array.isArray(f.value)) { [row.value, row.value2] = f.value.map(String); }
    else if (f.value !== undefined) row.value = String(f.value);
    return row;
  });
}

// --------------------------------------------------------------- Requête
/** Formulaire → requête POST /api/analytics/query. */
export function buildQuery(form, columns, limits) {
  const types = Object.fromEntries(columns.map((c) => [c.name, c.type]));
  const filters = buildFilters(form.filters, types);

  if (form.mode === 'distribution') {
    // Effectif de chaque valeur distincte : les classes sont calculées côté client
    // à partir de ces effectifs réels (voir charts/Histogram.jsx).
    return {
      groupBy: [form.distField],
      metrics: [{ op: 'count' }],
      ...(filters.length ? { filters } : {}),
      limit: limits?.maxRows || 1000,
    };
  }

  const query = { metrics: form.metrics.length ? form.metrics : [{ op: 'count' }] };
  if (form.groupBy.length) query.groupBy = form.groupBy;
  if (form.timeField) {
    query.timeBucket = { field: form.timeField, granularity: form.granularity, ...(form.timeAlias ? { alias: form.timeAlias } : {}) };
  }
  if (filters.length) query.filters = filters;
  if (form.orderField) query.orderBy = { field: form.orderField, dir: form.orderDir };
  const limit = parseInt(form.limit, 10);
  if (Number.isInteger(limit) && limit > 0) query.limit = limit;
  if (form.rank) query.rank = true;
  return query;
}

/** Colonnes attendues dans le résultat (pour le tri et les graphiques). */
export function resultShape(query) {
  const timeCol = query.timeBucket ? (query.timeBucket.alias || query.timeBucket.field) : null;
  const groupCols = [...(timeCol ? [timeCol] : []), ...(query.groupBy || [])];
  const metrics = query.metrics?.length ? query.metrics : [{ op: 'count' }];
  const metricCols = metrics.map(metricName);
  const extraCols = query.rank ? [RANK_COLUMN, SHARE_COLUMN] : [];
  return { timeCol, groupCols, metrics, metricCols, extraCols, all: [...groupCols, ...metricCols, ...extraCols] };
}

/** Problèmes bloquants avant exécution (le backend revalide tout). */
export function formErrors(form, limits) {
  const errors = [];
  if (form.mode === 'distribution') {
    if (!form.distField) errors.push('Choisissez la colonne numérique dont vous voulez la distribution.');
    return errors;
  }
  if (form.metrics.length > (limits?.maxMetrics || 10)) errors.push(`${limits?.maxMetrics || 10} indicateurs maximum.`);
  if (form.groupBy.length > (limits?.maxGroupBy || 3)) errors.push(`${limits?.maxGroupBy || 3} regroupements maximum.`);
  if (form.timeField && form.groupBy.includes(form.timeField)) errors.push('La colonne de la série temporelle ne peut pas aussi servir de regroupement.');
  if (form.rank && !form.groupBy.length && !form.timeField) errors.push('Le classement nécessite au moins un regroupement.');
  return errors;
}

// --------------------------------------------------------------- Graphiques
const ADDITIVE_OPS = ['sum', 'count'];

/**
 * Graphiques compatibles avec un résultat : { [type]: { ok, reason } }.
 * Les raisons sont affichées sur les choix désactivés.
 */
export function chartCompatibility(query, result, measure) {
  const shape = resultShape(query);
  const distribution = query.groupBy?.length === 1 && !query.timeBucket && shape.metrics.length === 1
    && shape.metrics[0].op === 'count' && !shape.metrics[0].field;
  const rows = result?.rows?.length || 0;
  const metric = shape.metrics[shape.metricCols.indexOf(measure)] || shape.metrics[0];
  const groupCount = shape.groupCols.length;
  const out = {};
  const set = (type, ok, reason) => { out[type] = { ok, reason: ok ? '' : reason }; };

  set('table', true);
  set('kpi', groupCount === 0 && rows === 1, 'Le KPI affiche un résultat sans regroupement (une seule ligne).');
  set('bar', groupCount > 0 && rows > 0,
    groupCount === 0 ? 'Résultat global sans regroupement : utilisez le KPI, ou ajoutez un regroupement pour comparer des catégories.'
      : 'Aucune catégorie à comparer.');
  set('line', !!shape.timeCol && rows > 1,
    shape.timeCol ? 'Une seule période : choisissez une granularité plus fine pour voir une évolution.'
      : "La courbe montre une évolution : activez l'analyse temporelle (colonne date).");
  const negative = result?.rows?.some((r) => Number(r[measure]) < 0);
  const pieShape = groupCount === 1 && !shape.timeCol && ADDITIVE_OPS.includes(metric.op) && !negative && rows > 0;
  set('pie', pieShape && rows <= PIE_MAX_CATEGORIES,
    pieShape
      ? `Trop de catégories (${rows}) pour des secteurs lisibles : ${PIE_MAX_CATEGORIES} maximum. Utilisez les barres ou un Top 10.`
      : "Les secteurs montrent la part d'un total : un seul regroupement et une somme ou un comptage positifs.");
  set('histogram', distribution && rows > 0, 'Choisissez « Distribution » dans le type d\'analyse pour obtenir un histogramme.');
  return out;
}

/** Libellés lisibles des colonnes du résultat (enregistrés avec le graphique). */
export function columnLabels(query) {
  const shape = resultShape(query);
  const labels = {};
  shape.metrics.forEach((m) => { labels[metricName(m)] = metricLabel(m); });
  if (shape.timeCol) labels[shape.timeCol] = `${query.timeBucket.field} (${(GRANULARITY_LABELS[query.timeBucket.granularity || 'month'] || '').toLowerCase()})`;
  if (query.rank) { labels[RANK_COLUMN] = 'Rang'; labels[SHARE_COLUMN] = 'Part du total (%)'; }
  return labels;
}

/**
 * Configuration du graphique enregistrée dans analyses.config.chart.
 * measures : colonnes d'indicateurs affichées (au moins une).
 */
export function buildChart(type, query, measures, extra = {}) {
  const shape = resultShape(query);
  const y = measures.length ? measures : shape.metricCols.slice(0, 1);
  const options = { labels: columnLabels(query) };
  if (shape.timeCol) options.granularity = query.timeBucket.granularity || 'month';

  if (type === 'histogram') {
    return { type, x: query.groupBy[0], y: [shape.metricCols[0]], options: { ...options, ...(extra.bins ? { bins: extra.bins } : {}) } };
  }
  if (type === 'kpi' || type === 'table') return { type, ...(shape.groupCols[0] ? { x: shape.groupCols[0] } : {}), y, options };
  // Barres : nombre de catégories affichées (Top N) ou toutes, avec défilement
  if (type === 'bar' && extra.maxCategories) options.maxCategories = extra.maxCategories;
  if (type === 'bar' && extra.categoryMode === 'all') options.categoryMode = 'all';

  // Plusieurs regroupements : le dernier devient la série, les autres l'axe X
  if ((type === 'bar' || type === 'line') && shape.groupCols.length > 1) {
    const [x, ...rest] = shape.groupCols;
    const seriesBy = rest.at(-1);
    const xFields = [x, ...rest.slice(0, -1)];
    return { type, x, y: y.slice(0, 1), options: { ...options, seriesBy, ...(xFields.length > 1 ? { xFields } : {}) } };
  }
  return { type, x: shape.groupCols[0], y: type === 'pie' ? y.slice(0, 1) : y, options };
}

/** Type proposé après une exécution. */
export function suggestChart(compat) {
  return ['histogram', 'line', 'bar', 'kpi', 'table'].find((t) => compat[t]?.ok) || 'table';
}

// --------------------------------------------------------------- Ouverture
/** analyses.config → formulaire + choix du graphique. */
export function formFromConfig(config = {}) {
  const query = config.query || {};
  const chart = config.chart || { type: 'table' };
  const form = emptyForm();
  form.filters = filtersToForm(query.filters);

  if (chart.type === 'histogram' && query.groupBy?.length === 1) {
    form.mode = 'distribution';
    form.distField = query.groupBy[0];
    form.bins = chart.options?.bins ? String(chart.options.bins) : '';
    return { form, chart };
  }
  form.metrics = (query.metrics || []).map((m) => ({ op: m.op, ...(m.field ? { field: m.field } : {}), ...(m.alias ? { alias: m.alias } : {}) }));
  form.groupBy = query.groupBy || [];
  form.timeField = query.timeBucket?.field || '';
  form.timeAlias = query.timeBucket?.alias || '';
  form.granularity = query.timeBucket?.granularity || 'month';
  form.orderField = query.orderBy?.field || '';
  form.orderDir = query.orderBy?.dir || 'desc';
  form.limit = query.limit ? String(query.limit) : '';
  form.rank = !!query.rank;
  return { form, chart };
}

// --------------------------------------------------- Sélection des opérations
/*
 * Le formulaire garde la liste exacte des indicateurs (form.metrics), comme
 * l'API. L'interface la présente comme « opérations × colonnes mesurées » :
 * cocher Somme et Moyenne puis montant et quantite calcule les 4 combinaisons.
 */
export const OP_INFO = {
  sum: { sql: 'SUM', hint: 'Total des valeurs' },
  avg: { sql: 'AVG', hint: 'Valeur moyenne' },
  min: { sql: 'MIN', hint: 'Plus petite valeur' },
  max: { sql: 'MAX', hint: 'Plus grande valeur' },
  median: { sql: 'MEDIAN', hint: 'Valeur centrale' },
};
const uniq = (list) => [...new Set(list)];
export const isNumericMetric = (m) => NUMERIC_OPS.includes(m.op) && !!m.field;
export const isRowCount = (m) => m.op === 'count' && !m.field;
export const sameMetric = (a, b) => a.op === b.op && (a.field || '') === (b.field || '');

export function metricSelection(metrics) {
  const numeric = metrics.filter(isNumericMetric);
  return {
    ops: uniq(numeric.map((m) => m.op)),
    fields: uniq(numeric.map((m) => m.field)),
    countRows: metrics.some(isRowCount),
  };
}

/** Nombre d'indicateurs ajoutés en activant une opération ou une colonne. */
export function addedByToggle(metrics, { op, field }) {
  const sel = metricSelection(metrics);
  if (op) return sel.ops.includes(op) ? 0 : Math.max(sel.fields.length, 1);
  return sel.fields.includes(field) ? 0 : Math.max(sel.ops.length, 1);
}

export function toggleOperation(metrics, op, fallbackField) {
  const sel = metricSelection(metrics);
  if (sel.ops.includes(op)) return metrics.filter((m) => !(isNumericMetric(m) && m.op === op));
  const fields = sel.fields.length ? sel.fields : [fallbackField].filter(Boolean);
  return [...metrics, ...fields.map((field) => ({ op, field }))];
}

export function toggleMeasureField(metrics, field) {
  const sel = metricSelection(metrics);
  if (sel.fields.includes(field)) return metrics.filter((m) => !(isNumericMetric(m) && m.field === field));
  const ops = sel.ops.length ? sel.ops : ['sum'];
  return [...metrics, ...ops.map((op) => ({ op, field }))];
}

// ------------------------------------------------------ Profil des colonnes
/**
 * Requêtes de profil, calculées par le backend sur les données réelles :
 * nombre de valeurs distinctes de chaque colonne (lots de 10 indicateurs).
 */
export function cardinalityQueries(columns, maxMetrics = 10) {
  const out = [];
  for (let i = 0; i < columns.length; i += maxMetrics) {
    out.push({ metrics: columns.slice(i, i + maxMetrics).map((c) => ({ op: 'count_distinct', field: c.name })) });
  }
  return out;
}
export const cardinalityOf = (row, name) => row?.[metricName({ op: 'count_distinct', field: name })];

/** Une ligne par jour présent dans la colonne date : étendue et densité de la période. */
export const timeProfileQuery = (field, maxRows = 1000) => ({
  timeBucket: { field, granularity: 'day' }, metrics: [{ op: 'count' }], limit: maxRows,
});

const DAY_MS = 86400000;
/** Nombre de points du graphique pour chaque granularité, d'après les jours présents. */
export function estimateTimePoints(rows, field) {
  const days = rows.map((r) => r[field]).filter((v) => typeof v === 'string')
    .map((v) => Date.parse(`${v.slice(0, 10)}T00:00:00Z`)).filter(Number.isFinite);
  if (!days.length) return null;
  const count = (keyOf) => new Set(days.map((t) => keyOf(new Date(t)))).size;
  return {
    day: days.length,
    // semaines ISO : lundi de la semaine
    week: count((d) => d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS),
    month: count((d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`),
    quarter: count((d) => `${d.getUTCFullYear()}-${Math.floor(d.getUTCMonth() / 3)}`),
    year: count((d) => d.getUTCFullYear()),
  };
}

/** Granularité la plus fine restant lisible (36 points au plus). */
export function suggestGranularity(points, available = Object.keys(GRANULARITY_LABELS)) {
  if (!points) return null;
  const order = ['day', 'week', 'month', 'quarter', 'year'].filter((g) => available.includes(g));
  return order.find((g) => points[g] <= IDEAL_TIME_POINTS) || order.at(-1);
}

// ------------------------------------------------------------ Tri et limite
export const LIMIT_PRESETS = [
  { id: 'all', label: 'Tout' },
  { id: '5', label: 'Top 5' },
  { id: '10', label: 'Top 10' },
  { id: 'custom', label: 'Personnalisé' },
];
export function limitPreset(limit) {
  if (limit === '' || limit === undefined || limit === null) return 'all';
  return ['5', '10'].includes(String(limit)) ? String(limit) : 'custom';
}
