'use strict';

/**
 * Détection des valeurs aberrantes — fonctionnalité avancée de P4.
 *
 * Trois méthodes :
 *  - iqr    : hors de [Q1 - k·IQR ; Q3 + k·IQR]                (k = 1.5 par défaut)
 *  - zscore : |x - moyenne| / écart-type > seuil               (seuil = 3)
 *  - mad    : z-score modifié 0.6745·|x - médiane| / MAD > seuil (seuil = 3.5,
 *             Iglewicz & Hoaglin), robuste quand les extrêmes faussent la moyenne.
 *
 * Entrée : [{ rowId, value }]. Fonctions pures, testées dans tests/.
 */

const METHODS = {
  iqr: { defaultThreshold: 1.5, label: 'Écart interquartile (IQR)' },
  zscore: { defaultThreshold: 3, label: 'Z-score' },
  mad: { defaultThreshold: 3.5, label: 'Z-score modifié (MAD)' },
};

const MIN_POINTS = 4;

/** Quantile par interpolation linéaire (méthode 7, comme Excel/NumPy). */
function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function describe(sorted) {
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[n - 1],
    mean,
    std: Math.sqrt(variance),
  };
}

/**
 * Histogramme en `binCount` classes sur une plage resserrée autour des bornes
 * normales : quelques extrêmes (ex. 9800 pour des montants de 100) ne doivent
 * pas écraser toute la distribution. Les valeurs hors plage sont comptées à
 * part dans `overflow` (low / high) avec leur valeur extrême.
 */
function histogram(sorted, isOutlier, bounds, binCount = 20) {
  if (!sorted.length) return { bins: [], overflow: null };
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  let lo = min;
  let hi = max;
  if (bounds && Number.isFinite(bounds.lower) && Number.isFinite(bounds.upper) && bounds.upper > bounds.lower) {
    const margin = (bounds.upper - bounds.lower) * 0.5;
    lo = Math.max(min, bounds.lower - margin);
    hi = Math.min(max, bounds.upper + margin);
  }
  const overflow = { low: 0, lowMin: null, high: 0, highMax: null };
  if (lo === hi) {
    const inside = sorted.filter((v) => v === lo);
    for (const v of sorted) {
      if (v < lo) { overflow.low += 1; overflow.lowMin = overflow.lowMin ?? v; }
      if (v > hi) { overflow.high += 1; overflow.highMax = v; }
    }
    return { bins: [{ x0: lo, x1: hi, count: inside.length, outliers: inside.filter(isOutlier).length }], overflow };
  }
  const width = (hi - lo) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ x0: lo + i * width, x1: lo + (i + 1) * width, count: 0, outliers: 0 }));
  for (const v of sorted) {
    if (v < lo) { overflow.low += 1; if (overflow.lowMin === null) overflow.lowMin = v; continue; }
    if (v > hi) { overflow.high += 1; overflow.highMax = v; continue; }
    const idx = Math.min(Math.floor((v - lo) / width), binCount - 1);
    bins[idx].count += 1;
    if (isOutlier(v)) bins[idx].outliers += 1;
  }
  return { bins, overflow };
}

const round = (v, d = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : v);

/**
 * @param {{rowId:any, value:number}[]} points
 * @param {{method?:'iqr'|'zscore'|'mad', threshold?:number, maxReturned?:number, bins?:number}} options
 */
function detectOutliers(points, options = {}) {
  const method = METHODS[options.method] ? options.method : 'iqr';
  const threshold = Number(options.threshold) > 0 ? Number(options.threshold) : METHODS[method].defaultThreshold;
  const maxReturned = options.maxReturned ?? 200;

  const clean = points.filter((p) => p && Number.isFinite(p.value));
  const values = clean.map((p) => p.value);
  const sorted = [...values].sort((a, b) => a - b);

  const base = { method, methodLabel: METHODS[method].label, threshold, n: clean.length };
  if (clean.length < MIN_POINTS) {
    return {
      ...base, outlierCount: 0, outlierRate: 0, stats: null, bounds: null, outliers: [], bins: [],
      warning: `Au moins ${MIN_POINTS} valeurs numériques sont nécessaires.`,
    };
  }

  const stats = describe(sorted);
  let score; // valeur → score signé
  let bounds;
  let warning = null;

  if (method === 'iqr') {
    const iqr = stats.q3 - stats.q1;
    bounds = { lower: stats.q1 - threshold * iqr, upper: stats.q3 + threshold * iqr };
    stats.iqr = iqr;
    score = (v) => {
      if (v < bounds.lower) return iqr ? -(bounds.lower - v) / iqr : -Infinity;
      if (v > bounds.upper) return iqr ? (v - bounds.upper) / iqr : Infinity;
      return 0;
    };
  } else if (method === 'zscore') {
    bounds = { lower: stats.mean - threshold * stats.std, upper: stats.mean + threshold * stats.std };
    score = (v) => (stats.std ? (v - stats.mean) / stats.std : 0);
    if (!stats.std) warning = 'Écart-type nul : toutes les valeurs sont identiques.';
  } else {
    const deviations = sorted.map((v) => Math.abs(v - stats.median)).sort((a, b) => a - b);
    const mad = quantile(deviations, 0.5);
    stats.mad = mad;
    bounds = mad
      ? { lower: stats.median - (threshold * mad) / 0.6745, upper: stats.median + (threshold * mad) / 0.6745 }
      : { lower: stats.median, upper: stats.median };
    score = (v) => (mad ? (0.6745 * (v - stats.median)) / mad : 0);
    if (!mad) warning = 'MAD nul (plus de la moitié des valeurs sont identiques) : utilisez la méthode IQR.';
  }

  const isOutlier = method === 'iqr'
    ? (v) => v < bounds.lower || v > bounds.upper
    : (v) => Math.abs(score(v)) > threshold;

  const outliers = clean
    .filter((p) => isOutlier(p.value))
    .map((p) => ({ rowId: p.rowId, value: p.value, score: round(score(p.value), 3), side: p.value < stats.median ? 'low' : 'high' }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const roundedStats = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, round(v)]));

  return {
    ...base,
    outlierCount: outliers.length,
    outlierRate: round(outliers.length / clean.length, 4),
    stats: roundedStats,
    bounds: { lower: round(bounds.lower), upper: round(bounds.upper) },
    outliers: outliers.slice(0, maxReturned),
    truncated: outliers.length > maxReturned,
    ...(() => {
      const h = histogram(sorted, isOutlier, bounds, options.bins || 20);
      return { bins: h.bins.map((b) => ({ ...b, x0: round(b.x0), x1: round(b.x1) })), overflow: h.overflow };
    })(),
    warning,
  };
}

module.exports = { detectOutliers, quantile, METHODS, MIN_POINTS };
