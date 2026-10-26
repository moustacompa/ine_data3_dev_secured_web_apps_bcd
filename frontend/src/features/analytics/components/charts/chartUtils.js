/**
 * Utilitaires communs aux graphiques P3.
 *
 * Contrat de props de tous les graphiques (identique à P4) :
 *   { data: Array<object>, x: string, y: string | string[], title?: string, options?: object }
 *
 * options (toutes facultatives, enregistrées dans analyses.config.chart.options) :
 *   labels      { [colonne]: libellé lisible }   ex. { sum_montant: 'Somme de montant' }
 *   granularity 'day' | 'week' | 'month' | 'quarter' | 'year'  (axe temporel)
 *   seriesBy    colonne dont chaque valeur devient une série (une seule mesure)
 *   xFields     colonnes concaténées pour former l'étiquette de l'axe X
 *   bins        nombre de classes de l'histogramme
 *   showTitle   affiche le titre au-dessus du graphique (page Analyse)
 */

export const MAX_SERIES = 8;
export const SERIES_COLORS = Array.from({ length: MAX_SERIES }, (_, i) => `var(--an-series-${i + 1})`);

export const asArray = (y) => (Array.isArray(y) ? y : [y]).filter(Boolean);

/** Les montants arrivent en nombre, les regroupements en texte : conversion tolérante. */
export function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const numberFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatNumber(v) {
  const n = toNumber(v);
  return n === null ? '—' : numberFmt.format(n);
}

/** Graduations d'axe : compactes à partir de 1 000 (0, 1 k, 2 k…). */
export function formatTick(v) {
  const n = toNumber(v);
  if (n === null) return '';
  return Math.abs(n) >= 1000 ? compactFmt.format(n) : numberFmt.format(n);
}

/** Valeur de cellule : nombre formaté, texte tel quel, vide → tiret. */
export function formatValue(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return numberFmt.format(v);
  return String(v);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
const MONTH_FMT = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Étiquette d'une période renvoyée par timeBucket (début de période 'YYYY-MM-DD'). */
export function formatPeriod(v, granularity) {
  if (typeof v !== 'string' || !ISO_DAY.test(v)) return formatValue(v);
  const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return v;
  switch (granularity) {
    case 'year': return String(d.getUTCFullYear());
    case 'quarter': return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    case 'month': return MONTH_FMT.format(d);
    case 'week': return `Sem. du ${DAY_FMT.format(d)}`;
    default: return DAY_FMT.format(d);
  }
}

export const labelOf = (options, key) => options?.labels?.[key] || key;

/**
 * Prépare les lignes d'un graphique cartésien.
 * - xFields : plusieurs colonnes de regroupement → une étiquette « A · B »
 * - seriesBy : pivot, chaque valeur de la colonne devient une série
 * Retourne { rows, xKey, series: [{ key, label }], hiddenSeries }.
 */
export function prepareCartesian(data, x, y, options = {}) {
  const xFields = options.xFields?.length ? options.xFields : [x];
  const xKey = '__x';
  const keyOf = (r) => xFields.map((f) => (r[f] === null || r[f] === undefined ? '(vide)' : r[f])).join(' · ');
  const measures = asArray(y);

  if (options.seriesBy && measures.length) {
    const measure = measures[0];
    const totals = new Map();
    data.forEach((r) => {
      const s = r[options.seriesBy] ?? '(vide)';
      totals.set(String(s), (totals.get(String(s)) || 0) + Math.abs(toNumber(r[measure]) || 0));
    });
    // Les séries les plus importantes d'abord ; au-delà de 8 elles restent dans le tableau
    const ordered = [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a));
    const kept = ordered.slice(0, MAX_SERIES).sort((a, b) => a.localeCompare(b, 'fr'));
    const byX = new Map();
    data.forEach((r) => {
      const s = String(r[options.seriesBy] ?? '(vide)');
      if (!kept.includes(s)) return;
      const k = keyOf(r);
      if (!byX.has(k)) byX.set(k, { [xKey]: k });
      byX.get(k)[`s:${s}`] = toNumber(r[measure]);
    });
    return {
      rows: [...byX.values()],
      xKey,
      series: kept.map((s) => ({ key: `s:${s}`, label: s })),
      hiddenSeries: ordered.length - kept.length,
    };
  }

  const kept = measures.slice(0, MAX_SERIES);
  return {
    rows: data.map((r) => {
      const row = { [xKey]: keyOf(r) };
      kept.forEach((m) => { row[m] = toNumber(r[m]); });
      return row;
    }),
    xKey,
    series: kept.map((m) => ({ key: m, label: labelOf(options, m) })),
    hiddenSeries: measures.length - kept.length,
  };
}
