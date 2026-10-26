import { EmptyChart } from './ChartParts';
import { asArray, formatNumber, labelOf } from './chartUtils';

/**
 * Indicateurs clés (total, moyenne, nombre d'observations, min, max…).
 * Lit la première ligne du résultat : une carte par colonne de y.
 * Dans un widget P4 à une seule valeur, le titre du widget sert de libellé.
 */
export default function KpiCard({ data = [], y, title, options = {} }) {
  const row = data[0];
  if (!row) return <EmptyChart />;
  const keys = asArray(y).length ? asArray(y) : Object.keys(row).slice(0, 1);
  return (
    <div className={`an-kpis${keys.length === 1 ? ' is-single' : ''}`} role="list" aria-label={title || 'Indicateurs'}>
      {keys.map((k) => (
        <div key={k} className="an-kpi" role="listitem">
          <span className="an-kpi-label">{keys.length === 1 && title && !options.labels?.[k] ? title : labelOf(options, k)}</span>
          <strong className="an-kpi-value">{formatNumber(row[k])}</strong>
        </div>
      ))}
    </div>
  );
}
