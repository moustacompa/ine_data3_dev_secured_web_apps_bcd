import { formatValue } from './chartUtils';

/**
 * Cadre commun : titre facultatif, zone de tracé extensible (remplit un widget
 * P4 comme un bloc de la page Analyse), légende et note.
 */
export function ChartFrame({ title, showTitle, label, legend, note, children, className = '' }) {
  return (
    <figure className={`an-chart ${className}`} aria-label={label || title}>
      {showTitle && title && <figcaption className="an-chart-title">{title}</figcaption>}
      <div className="an-chart-plot">{children}</div>
      {legend}
      {note && <p className="an-chart-note">{note}</p>}
    </figure>
  );
}

export function EmptyChart({ message = 'Aucun résultat à afficher.' }) {
  return <div className="an-chart-empty" role="status">{message}</div>;
}

/** Légende HTML : pastille colorée + texte à l'encre normale (jamais de texte coloré). */
export function SeriesLegend({ series, colors }) {
  if (!series || series.length < 2) return null;
  return (
    <ul className="an-legend">
      {series.map((s, i) => (
        <li key={s.key}><i style={{ background: colors[i % colors.length] }} aria-hidden="true" />{s.label}</li>
      ))}
    </ul>
  );
}

/**
 * Infobulle Recharts. Recharts injecte active, payload et label.
 * formatLabel(label) et formatItem(item) personnalisent l'affichage.
 */
export function ChartTooltip({ active, payload, label, formatLabel, formatItem }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      {label !== undefined && <p className="an-tooltip-label">{formatLabel ? formatLabel(label, payload) : formatValue(label)}</p>}
      <ul>
        {payload.map((item) => {
          const { name, value } = formatItem ? formatItem(item) : { name: item.name, value: formatValue(item.value) };
          return (
            <li key={item.dataKey ?? name}>
              <i style={{ background: item.color || item.payload?.fill }} aria-hidden="true" />
              <span>{name}</span>
              <b>{value}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
