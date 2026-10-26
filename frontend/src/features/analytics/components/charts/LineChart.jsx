import {
  ResponsiveContainer, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartFrame, ChartTooltip, EmptyChart, SeriesLegend } from './ChartParts';
import { SERIES_COLORS, asArray, formatNumber, formatPeriod, formatTick, labelOf, prepareCartesian } from './chartUtils';

const AXIS = { fontSize: 12, fill: 'var(--an-muted)' };
const DENSE_POINTS = 60;

/** Sans granularité enregistrée (analyses créées avant P3) : on la déduit des dates. */
function inferGranularity(rows, xKey) {
  const values = rows.map((r) => String(r[xKey]));
  if (!values.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return null;
  if (values.every((v) => v.slice(5, 10) === '01-01')) return 'year';
  if (values.every((v) => v.slice(8, 10) === '01')) return 'month';
  return 'day';
}

/**
 * Évolution dans le temps (ex. ventes mensuelles). L'axe X suit l'ordre
 * chronologique ; avec options.seriesBy, une courbe par catégorie.
 */
export default function LineChart({ data = [], x, y, title, options = {} }) {
  if (!data.length || !asArray(y).length) return <EmptyChart />;
  const prepared = prepareCartesian(data, x, y, options);
  const { series, xKey } = prepared;
  const rows = [...prepared.rows].sort((a, b) => String(a[xKey]).localeCompare(String(b[xKey])));
  const granularity = options.granularity || inferGranularity(rows, xKey);
  const fmtX = (v) => (granularity ? formatPeriod(v, granularity) : String(v));
  const xLabel = labelOf(options, x);
  const yLabel = options.seriesBy ? labelOf(options, asArray(y)[0]) : series.length === 1 ? series[0].label : 'Valeur';
  const notes = [];
  if (prepared.hiddenSeries > 0) notes.push(`${prepared.hiddenSeries} série(s) supplémentaire(s) visibles dans le tableau.`);
  if (rows.length > DENSE_POINTS) notes.push(`${rows.length} points : une granularité plus large rendrait la tendance plus lisible.`);
  const note = notes.join(' ');

  return (
    <ChartFrame title={title} showTitle={options.showTitle} label={title || `Évolution de ${yLabel}`}
      legend={<SeriesLegend series={series} colors={SERIES_COLORS} />} note={note}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={rows} margin={{ top: 8, right: 20, bottom: 22, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--an-grid)" />
          <XAxis dataKey={xKey} tickFormatter={fmtX} tick={AXIS} stroke="var(--an-grid)" minTickGap={20} interval="preserveStartEnd"
            label={{ value: xLabel, position: 'insideBottom', offset: -14, ...AXIS }} />
          <YAxis tickFormatter={formatTick} tick={AXIS} stroke="var(--an-grid)" width={60}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' }, ...AXIS }} />
          <Tooltip cursor={{ stroke: 'var(--an-muted)', strokeWidth: 1 }}
            content={<ChartTooltip formatLabel={fmtX} formatItem={(it) => ({ name: it.name, value: formatNumber(it.value) })} />} />
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES_COLORS[i]} strokeWidth={2.25}
              strokeLinecap="round" strokeLinejoin="round" connectNulls isAnimationActive={false}
              dot={rows.length <= 24 ? { r: 3, strokeWidth: 0, fill: SERIES_COLORS[i] } : false}
              activeDot={{ r: 5, stroke: 'var(--an-surface)', strokeWidth: 2, fill: SERIES_COLORS[i] }} />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
