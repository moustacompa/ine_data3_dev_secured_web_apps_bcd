import {
  ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartFrame, ChartTooltip, EmptyChart, SeriesLegend } from './ChartParts';
import { SERIES_COLORS, asArray, formatNumber, formatPeriod, formatTick, labelOf, prepareCartesian } from './chartUtils';

export const DEFAULT_MAX_CATEGORIES = 20;
const MAX_TIME_BARS = 60;
const ROW_HEIGHT = 28;
const AXIS = { fontSize: 12, fill: 'var(--an-muted)' };
const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/**
 * Comparaison entre catégories (ex. chiffre d'affaires par région).
 * Barres verticales ; horizontales au-delà de 8 catégories ou pour des
 * libellés longs, pour qu'ils restent lisibles.
 *
 * Catégories nombreuses (options.maxCategories, 20 par défaut) : seules les N
 * premières lignes du résultat sont tracées, dans l'ordre renvoyé par l'API
 * (valeurs décroissantes par défaut), et la règle est indiquée sous le
 * graphique. options.categoryMode = 'all' les trace toutes avec défilement.
 * Axe temporel (options.granularity) : ordre chronologique, jamais tronqué.
 */
export default function BarChart({ data = [], x, y, title, options = {} }) {
  if (!data.length || !asArray(y).length) return <EmptyChart />;
  const prepared = prepareCartesian(data, x, y, options);
  const { series, xKey } = prepared;
  const timeAxis = !!options.granularity;
  const showAll = options.categoryMode === 'all' && !timeAxis;
  const max = options.maxCategories || DEFAULT_MAX_CATEGORIES;
  const total = prepared.rows.length;
  const rows = timeAxis || showAll ? prepared.rows : prepared.rows.slice(0, max);

  const fmtX = (v) => (timeAxis ? String(v).replace(ISO_PREFIX, (d) => formatPeriod(d, options.granularity)) : String(v));
  const longLabels = rows.some((r) => fmtX(r[xKey]).length > 14);
  const horizontal = !timeAxis && (rows.length > 8 || longLabels);
  const xLabel = (options.xFields?.length ? options.xFields : [x]).map((f) => labelOf(options, f)).join(' · ');
  const yLabel = options.seriesBy ? labelOf(options, asArray(y)[0]) : series.length === 1 ? series[0].label : 'Valeur';

  const notes = [];
  if (rows.length < total) {
    notes.push(`Affichage limité aux ${rows.length} premières catégories sur ${total}, dans l'ordre du résultat. Toutes figurent dans le tableau.`);
  }
  if (timeAxis && total > MAX_TIME_BARS) notes.push(`${total} périodes : choisissez une granularité plus large pour un graphique plus lisible.`);
  if (prepared.hiddenSeries > 0) notes.push(`${prepared.hiddenSeries} série(s) supplémentaire(s) visibles dans le tableau.`);

  const tooltip = (
    <Tooltip cursor={{ fill: 'var(--an-cursor)' }}
      content={<ChartTooltip formatLabel={fmtX} formatItem={(it) => ({ name: it.name, value: formatNumber(it.value) })} />} />
  );
  const labelWidth = Math.min(180, 16 + 7 * Math.max(...rows.map((r) => fmtX(r[xKey]).length)));

  const chart = horizontal ? (
    <RBarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 22, left: 4 }} barGap={2} barCategoryGap="22%">
      <CartesianGrid horizontal={false} stroke="var(--an-grid)" />
      <XAxis type="number" tickFormatter={formatTick} tick={AXIS} stroke="var(--an-grid)"
        label={{ value: yLabel, position: 'insideBottom', offset: -14, ...AXIS }} />
      <YAxis type="category" dataKey={xKey} width={labelWidth} tickFormatter={fmtX}
        tick={AXIS} stroke="var(--an-grid)" interval={0} />
      {tooltip}
      {series.map((s, i) => (
        <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES_COLORS[i]} maxBarSize={22}
          radius={[0, 4, 4, 0]} isAnimationActive={false} />
      ))}
    </RBarChart>
  ) : (
    <RBarChart data={rows} margin={{ top: 8, right: 8, bottom: 22, left: 8 }} barGap={2} barCategoryGap="22%">
      <CartesianGrid vertical={false} stroke="var(--an-grid)" />
      <XAxis dataKey={xKey} tickFormatter={fmtX} tick={AXIS} stroke="var(--an-grid)"
        interval={timeAxis ? 'preserveStartEnd' : 0} minTickGap={12}
        label={{ value: xLabel, position: 'insideBottom', offset: -14, ...AXIS }} />
      <YAxis tickFormatter={formatTick} tick={AXIS} stroke="var(--an-grid)" width={60}
        label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' }, ...AXIS }} />
      {tooltip}
      {series.map((s, i) => (
        <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES_COLORS[i]} maxBarSize={48}
          radius={[4, 4, 0, 0]} isAnimationActive={false} />
      ))}
    </RBarChart>
  );

  return (
    <ChartFrame title={title} showTitle={options.showTitle} label={title || `${yLabel} par ${xLabel}`}
      legend={<SeriesLegend series={series} colors={SERIES_COLORS} />} note={notes.join(' ')}>
      {showAll && horizontal ? (
        // Toutes les catégories : hauteur proportionnelle, défilement interne
        <div className="an-chart-scroll" tabIndex={0} aria-label="Graphique défilant : toutes les catégories">
          <div style={{ height: Math.max(rows.length * ROW_HEIGHT + 48, 240) }}>
            <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
