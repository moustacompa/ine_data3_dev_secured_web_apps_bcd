import { ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Tooltip } from 'recharts';
import { ChartFrame, ChartTooltip, EmptyChart } from './ChartParts';
import { MAX_SERIES, SERIES_COLORS, asArray, formatNumber, labelOf, toNumber } from './chartUtils';

const OTHER = 'Autres';

/**
 * Répartition d'un total entre catégories (ex. ventes par produit).
 * Seules les valeurs positives ont un sens comme parts : les autres sont
 * signalées. Au-delà de 8 parts, les plus petites sont regroupées dans « Autres ».
 */
export default function PieChart({ data = [], x, y, title, options = {} }) {
  const key = asArray(y)[0];
  if (!data.length || !key) return <EmptyChart />;

  const parts = data
    .map((r) => ({ name: r[x] === null || r[x] === undefined ? '(vide)' : String(r[x]), value: toNumber(r[key]) }))
    .filter((p) => p.value !== null);
  const positives = parts.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  const ignored = parts.length - positives.length;
  if (!positives.length) return <EmptyChart message="Aucune valeur positive à répartir." />;

  let slices = positives;
  if (positives.length > MAX_SERIES) {
    const rest = positives.slice(MAX_SERIES - 1);
    slices = [...positives.slice(0, MAX_SERIES - 1), { name: OTHER, value: rest.reduce((s, p) => s + p.value, 0), count: rest.length }];
  }
  const total = slices.reduce((s, p) => s + p.value, 0);
  const pct = (v) => `${((100 * v) / total).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  const notes = [];
  if (ignored) notes.push(`${ignored} catégorie(s) nulle(s) ou négative(s) non représentée(s).`);
  if (slices.at(-1).count) notes.push(`« ${OTHER} » regroupe ${slices.at(-1).count} catégories.`);

  return (
    <ChartFrame title={title} showTitle={options.showTitle} className="an-pie"
      label={title || `Répartition de ${labelOf(options, key)} par ${labelOf(options, x)}`}
      legend={(
        <ul className="an-legend an-pie-legend">
          {slices.map((s, i) => (
            <li key={s.name}><i style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />{s.name}<b>{pct(s.value)}</b></li>
          ))}
        </ul>
      )}
      note={notes.join(' ')}>
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="88%" paddingAngle={0}
            stroke="var(--an-surface)" strokeWidth={2} isAnimationActive={false}>
            {slices.map((s, i) => <Cell key={s.name} fill={SERIES_COLORS[i]} />)}
          </Pie>
          <Tooltip content={(
            <ChartTooltip formatItem={(it) => ({ name: it.name, value: `${formatNumber(it.value)} (${pct(it.value)})` })} />
          )} />
        </RPieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
