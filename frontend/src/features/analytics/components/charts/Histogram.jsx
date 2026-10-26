import {
  ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartFrame, ChartTooltip, EmptyChart } from './ChartParts';
import { SERIES_COLORS, asArray, formatNumber, formatTick, labelOf, toNumber } from './chartUtils';

const AXIS = { fontSize: 12, fill: 'var(--an-muted)' };
export const MAX_BINS = 50;

/**
 * Distribution d'une variable numérique en classes d'égale amplitude.
 *
 * Données attendues : une ligne par valeur distincte avec son effectif,
 * obtenue par l'API sans rien inventer :
 *   POST /api/analytics/query { groupBy: [colonne], metrics: [{ op: 'count' }] }
 *   → [{ montant: '123.4', count: 2 }, …]   (x = colonne, y = ['count'])
 * Sans y, chaque ligne compte pour une observation (valeurs brutes).
 * Les effectifs des classes sont donc des sommes d'effectifs réels.
 *
 * Classes : [min ; min + h[, …, [max - h ; max] (dernière classe fermée),
 * nombre par défaut selon la règle de Sturges : ⌈log2(n) + 1⌉.
 */
export function computeHistogram(data, x, y, binsOption) {
  const freqKey = asArray(y)[0];
  const points = [];
  let ignored = 0;
  data.forEach((r) => {
    const v = toNumber(r[x]);
    const f = freqKey ? toNumber(r[freqKey]) : 1;
    if (v === null || f === null || f <= 0) { ignored += freqKey ? (toNumber(r[freqKey]) || 0) : 1; return; }
    points.push([v, f]);
  });
  const n = points.reduce((s, [, f]) => s + f, 0);
  if (!n) return { bins: [], n: 0, ignored };

  const min = Math.min(...points.map(([v]) => v));
  const max = Math.max(...points.map(([v]) => v));
  const requested = Number.isInteger(binsOption) && binsOption > 0 ? binsOption : Math.ceil(Math.log2(n) + 1);
  const count = min === max ? 1 : Math.min(requested, MAX_BINS);
  const width = min === max ? 1 : (max - min) / count;

  const bins = Array.from({ length: count }, (_, i) => ({
    start: min + i * width,
    end: i === count - 1 ? max : min + (i + 1) * width,
    count: 0,
    last: i === count - 1,
  }));
  points.forEach(([v, f]) => {
    const i = min === max ? 0 : Math.min(Math.floor((v - min) / width), count - 1);
    bins[i].count += f;
  });
  bins.forEach((b) => {
    b.label = `${formatNumber(b.start)} – ${formatNumber(b.end)}`;
    b.range = `[${formatNumber(b.start)} ; ${formatNumber(b.end)}${b.last ? ']' : '['}`;
    b.share = (100 * b.count) / n;
  });
  return { bins, n, min, max, width, ignored };
}

export default function Histogram({ data = [], x, y, title, options = {} }) {
  const { bins, n, ignored } = computeHistogram(data, x, y, options.bins);
  if (!bins.length) return <EmptyChart message="Aucune valeur numérique à répartir." />;
  const xLabel = labelOf(options, x);
  const notes = [`${formatNumber(n)} observations réparties en ${bins.length} classes d'égale amplitude.`];
  if (ignored) notes.push(`${formatNumber(ignored)} valeur(s) vide(s) ou non numérique(s) ignorée(s).`);
  if (options.truncated) notes.push('Distribution partielle : trop de valeurs distinctes pour une seule requête.');

  return (
    <ChartFrame title={title} showTitle={options.showTitle} label={title || `Distribution de ${xLabel}`} note={notes.join(' ')}>
      <ResponsiveContainer width="100%" height="100%">
        {/* Classes contiguës : seul un espace de 2 px les sépare (pas un diagramme en barres) */}
        <RBarChart data={bins} margin={{ top: 8, right: 8, bottom: 22, left: 8 }} barCategoryGap={1}>
          <CartesianGrid vertical={false} stroke="var(--an-grid)" />
          <XAxis dataKey="label" tick={AXIS} stroke="var(--an-grid)" minTickGap={8}
            label={{ value: xLabel, position: 'insideBottom', offset: -14, ...AXIS }} />
          <YAxis allowDecimals={false} tickFormatter={formatTick} tick={AXIS} stroke="var(--an-grid)" width={48}
            label={{ value: 'Effectif', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' }, ...AXIS }} />
          <Tooltip cursor={{ fill: 'var(--an-cursor)' }} content={(
            <ChartTooltip
              formatLabel={(_, payload) => `${xLabel} ∈ ${payload[0]?.payload.range}`}
              formatItem={(it) => ({
                name: 'Effectif',
                value: `${formatNumber(it.value)} (${it.payload.share.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %)`,
              })} />
          )} />
          <Bar dataKey="count" name="Effectif" fill={SERIES_COLORS[0]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </RBarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
