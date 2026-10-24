'use strict';

const crypto = require('crypto');
const { httpError } = require('./errors');
const { METRIC_OPS, FILTER_OPS, GRANULARITIES } = require('./queryEngine');
const { METHODS } = require('./outliers');

const CHART_TYPES = ['bar', 'line', 'pie', 'kpi', 'histogram', 'table'];
const FILTER_TYPES = ['select', 'range', 'date-range'];
const MAX_WIDGETS = 24;
const MAX_GLOBAL_FILTERS = 10;

class Checker {
  constructor() { this.errors = []; }
  fail(field, message) { this.errors.push({ field, message }); }
  done() {
    if (this.errors.length) throw httpError(400, 'Données invalides.', this.errors);
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPosInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Ressource introuvable.');
  return id;
}

function text(c, body, key, { required = false, max = 150 } = {}) {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (required) c.fail(key, 'Champ obligatoire.');
    return v === '' ? null : v;
  }
  if (typeof v !== 'string') { c.fail(key, 'Doit être une chaîne.'); return undefined; }
  const t = v.trim();
  if (required && !t) c.fail(key, 'Champ obligatoire.');
  if (t.length > max) c.fail(key, `${max} caractères maximum.`);
  return t;
}

function checkQuery(c, q, prefix) {
  if (!isPlainObject(q)) { c.fail(prefix, 'Doit être un objet.'); return; }
  if (q.metrics !== undefined) {
    if (!Array.isArray(q.metrics) || q.metrics.length > 10) c.fail(`${prefix}.metrics`, 'Liste de 10 indicateurs maximum.');
    else q.metrics.forEach((m, i) => {
      if (!isPlainObject(m) || !METRIC_OPS.includes(m.op)) c.fail(`${prefix}.metrics[${i}].op`, `Valeurs possibles : ${METRIC_OPS.join(', ')}.`);
      else if (m.op !== 'count' && (typeof m.field !== 'string' || !m.field)) c.fail(`${prefix}.metrics[${i}].field`, 'Champ obligatoire.');
    });
  }
  if (q.groupBy !== undefined && (!Array.isArray(q.groupBy) || q.groupBy.length > 3 || q.groupBy.some((g) => typeof g !== 'string' || !g))) {
    c.fail(`${prefix}.groupBy`, 'Liste de 3 champs maximum.');
  }
  if (q.timeBucket !== undefined && q.timeBucket !== null) {
    if (!isPlainObject(q.timeBucket) || typeof q.timeBucket.field !== 'string') c.fail(`${prefix}.timeBucket.field`, 'Champ date obligatoire.');
    else if (q.timeBucket.granularity && !GRANULARITIES.includes(q.timeBucket.granularity)) c.fail(`${prefix}.timeBucket.granularity`, `Valeurs possibles : ${GRANULARITIES.join(', ')}.`);
  }
  if (q.filters !== undefined) {
    if (!Array.isArray(q.filters) || q.filters.length > 20) c.fail(`${prefix}.filters`, 'Liste de 20 filtres maximum.');
    else q.filters.forEach((f, i) => {
      if (!isPlainObject(f) || typeof f.field !== 'string' || !FILTER_OPS.includes(f.op)) {
        c.fail(`${prefix}.filters[${i}]`, `Filtre invalide (opérateurs : ${FILTER_OPS.join(', ')}).`);
      }
    });
  }
}

/** Valide une analyse. partial=true pour une mise à jour (PUT/PATCH). */
function validateAnalysis(body, { partial = false } = {}) {
  if (!isPlainObject(body)) throw httpError(400, 'Corps de requête invalide.');
  const c = new Checker();
  const out = {};

  const title = text(c, body, 'title', { required: !partial });
  if (title !== undefined) out.title = title;
  const description = text(c, body, 'description', { max: 2000 });
  if (description !== undefined) out.description = description;

  if (body.datasetId !== undefined || !partial) {
    if (!isPosInt(body.datasetId)) c.fail('datasetId', 'Identifiant de dataset invalide.');
    else out.datasetId = Number(body.datasetId);
  }

  if (body.config !== undefined || !partial) {
    const config = body.config;
    if (!isPlainObject(config)) c.fail('config', 'Doit être un objet { query, chart }.');
    else {
      checkQuery(c, config.query ?? {}, 'config.query');
      if (config.chart !== undefined) {
        if (!isPlainObject(config.chart) || !CHART_TYPES.includes(config.chart.type)) {
          c.fail('config.chart.type', `Valeurs possibles : ${CHART_TYPES.join(', ')}.`);
        }
      }
      if (JSON.stringify(config).length > 20000) c.fail('config', 'Configuration trop volumineuse.');
      out.config = { query: config.query ?? {}, chart: config.chart ?? { type: 'table' } };
    }
  }

  if (body.visibility !== undefined) {
    if (!['private', 'shared'].includes(body.visibility)) c.fail('visibility', 'Valeurs possibles : private, shared.');
    else out.visibility = body.visibility;
  }
  c.done();
  return out;
}

function validateWidget(c, w, i, ids) {
  const p = `layout[${i}]`;
  if (!isPlainObject(w)) { c.fail(p, 'Widget invalide.'); return null; }
  const id = typeof w.id === 'string' && /^[\w-]{1,40}$/.test(w.id) ? w.id : crypto.randomUUID().slice(0, 8);
  if (ids.has(id)) c.fail(`${p}.id`, 'Identifiant de widget en double.');
  ids.add(id);

  const out = {
    id,
    type: w.type,
    w: Math.min(Math.max(parseInt(w.w, 10) || 2, 1), 4),
    h: Math.min(Math.max(parseInt(w.h, 10) || 2, 1), 3),
  };
  if (typeof w.title === 'string' && w.title.trim()) out.title = w.title.trim().slice(0, 120);

  if (w.type === 'analysis') {
    if (!isPosInt(w.analysisId)) c.fail(`${p}.analysisId`, "Identifiant d'analyse invalide.");
    out.analysisId = Number(w.analysisId);
  } else if (w.type === 'outliers') {
    if (!isPosInt(w.datasetId)) c.fail(`${p}.datasetId`, 'Identifiant de dataset invalide.');
    if (typeof w.column !== 'string' || !w.column || w.column.length > 128) c.fail(`${p}.column`, 'Colonne obligatoire.');
    out.datasetId = Number(w.datasetId);
    out.column = w.column;
    out.method = METHODS[w.method] ? w.method : 'iqr';
    if (w.threshold !== undefined && w.threshold !== null && w.threshold !== '') {
      const t = Number(w.threshold);
      if (!(t > 0 && t <= 20)) c.fail(`${p}.threshold`, 'Seuil entre 0 et 20.');
      else out.threshold = t;
    }
  } else {
    c.fail(`${p}.type`, 'Valeurs possibles : analysis, outliers.');
  }
  return out;
}

function validateGlobalFilter(c, f, i, ids) {
  const p = `globalFilters[${i}]`;
  if (!isPlainObject(f)) { c.fail(p, 'Filtre invalide.'); return null; }
  const id = typeof f.id === 'string' && /^[\w-]{1,40}$/.test(f.id) ? f.id : crypto.randomUUID().slice(0, 8);
  if (ids.has(id)) c.fail(`${p}.id`, 'Identifiant de filtre en double.');
  ids.add(id);
  if (typeof f.field !== 'string' || !f.field || f.field.length > 128) c.fail(`${p}.field`, 'Champ obligatoire.');
  if (!FILTER_TYPES.includes(f.type)) c.fail(`${p}.type`, `Valeurs possibles : ${FILTER_TYPES.join(', ')}.`);
  const out = { id, field: f.field, type: f.type, label: (typeof f.label === 'string' && f.label.trim()) ? f.label.trim().slice(0, 60) : f.field };
  if (Array.isArray(f.datasetIds) && f.datasetIds.length) {
    if (f.datasetIds.some((d) => !isPosInt(d))) c.fail(`${p}.datasetIds`, 'Identifiants de datasets invalides.');
    else out.datasetIds = [...new Set(f.datasetIds.map(Number))];
  }
  return out;
}

function validateDashboard(body, { partial = false } = {}) {
  if (!isPlainObject(body)) throw httpError(400, 'Corps de requête invalide.');
  const c = new Checker();
  const out = {};

  const title = text(c, body, 'title', { required: !partial });
  if (title !== undefined) out.title = title;
  const description = text(c, body, 'description', { max: 2000 });
  if (description !== undefined) out.description = description;

  if (body.layout !== undefined) {
    if (!Array.isArray(body.layout) || body.layout.length > MAX_WIDGETS) c.fail('layout', `Liste de ${MAX_WIDGETS} widgets maximum.`);
    else {
      const ids = new Set();
      out.layout = body.layout.map((w, i) => validateWidget(c, w, i, ids));
    }
  }
  if (body.globalFilters !== undefined) {
    if (!Array.isArray(body.globalFilters) || body.globalFilters.length > MAX_GLOBAL_FILTERS) {
      c.fail('globalFilters', `Liste de ${MAX_GLOBAL_FILTERS} filtres maximum.`);
    } else {
      const ids = new Set();
      out.globalFilters = body.globalFilters.map((f, i) => validateGlobalFilter(c, f, i, ids));
    }
  }
  if (body.visibility !== undefined) {
    if (!['private', 'shared', 'public'].includes(body.visibility)) c.fail('visibility', 'Valeurs possibles : private, shared, public.');
    else out.visibility = body.visibility;
  }
  c.done();
  return out;
}

/**
 * Convertit les valeurs saisies dans la barre de filtres globaux en filtres
 * de requête, pour un dataset donné. Les valeurs inconnues sont ignorées.
 *   select     → { op: 'in', value: [...] }
 *   range      → gte / lte (nombres)
 *   date-range → gte / lte (dates ISO AAAA-MM-JJ)
 */
function toQueryFilters(globalFilters, values, datasetId) {
  if (!isPlainObject(values)) return [];
  const out = [];
  for (const f of globalFilters || []) {
    if (f.datasetIds && f.datasetIds.length && !f.datasetIds.includes(Number(datasetId))) continue;
    const v = values[f.id];
    if (v === undefined || v === null || v === '') continue;

    if (f.type === 'select') {
      const list = (Array.isArray(v) ? v : [v]).filter((x) => x !== null && x !== '').map(String).slice(0, 100);
      if (list.length) out.push({ field: f.field, op: 'in', value: list });
    } else if (f.type === 'range' && isPlainObject(v)) {
      if (v.min !== undefined && v.min !== '' && Number.isFinite(Number(v.min))) out.push({ field: f.field, op: 'gte', value: Number(v.min) });
      if (v.max !== undefined && v.max !== '' && Number.isFinite(Number(v.max))) out.push({ field: f.field, op: 'lte', value: Number(v.max) });
    } else if (f.type === 'date-range' && isPlainObject(v)) {
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      if (iso.test(v.from)) out.push({ field: f.field, op: 'gte', value: v.from });
      if (iso.test(v.to)) out.push({ field: f.field, op: 'lte', value: `${v.to}T23:59:59.999` });
    }
  }
  return out;
}

function validateShareTarget(body) {
  if (!isPlainObject(body)) throw httpError(400, 'Corps de requête invalide.');
  if (typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return { email: body.email.trim() };
  }
  throw httpError(400, 'Adresse e-mail invalide.', [{ field: 'email', message: 'Adresse e-mail invalide.' }]);
}

function validateOutlierRequest(body) {
  const c = new Checker();
  if (!isPlainObject(body)) throw httpError(400, 'Corps de requête invalide.');
  if (!isPosInt(body.datasetId)) c.fail('datasetId', 'Identifiant de dataset invalide.');
  if (typeof body.column !== 'string' || !body.column) c.fail('column', 'Colonne obligatoire.');
  if (body.method !== undefined && !METHODS[body.method]) c.fail('method', `Valeurs possibles : ${Object.keys(METHODS).join(', ')}.`);
  if (body.threshold !== undefined && !(Number(body.threshold) > 0 && Number(body.threshold) <= 20)) c.fail('threshold', 'Seuil entre 0 et 20.');
  if (body.filters !== undefined && !Array.isArray(body.filters)) c.fail('filters', 'Doit être un tableau.');
  c.done();
  return {
    datasetId: Number(body.datasetId),
    column: body.column,
    method: body.method || 'iqr',
    threshold: body.threshold !== undefined ? Number(body.threshold) : undefined,
    filters: body.filters || [],
  };
}

module.exports = {
  CHART_TYPES, FILTER_TYPES,
  parseId, validateAnalysis, validateDashboard, toQueryFilters, validateShareTarget, validateOutlierRequest,
};
