import { fmt, useSize } from '../charts/mockCharts';

const EDGE = 54; // place réservée aux extrêmes hors plage

/**
 * Affichage du résultat de détection des valeurs aberrantes :
 * histogramme dont la part aberrante de chaque classe est mise en évidence,
 * bornes de la méthode, et liste des lignes les plus éloignées.
 */
export default function OutlierView({ data, compact = false }) {
  const [ref, size] = useSize();
  if (!data) return null;
  if (data.warning && !data.stats) return <p className="db-muted">{data.warning}</p>;

  const W = Math.max(size.w, 260);
  const H = 150;
  const bins = data.bins || [];
  const of = data.overflow || {};
  const PAD = { t: 22, r: of.high ? EDGE : 8, b: 22, l: of.low ? EDGE : 8 };
  const lo = bins[0]?.x0 ?? 0;
  const hi = bins[bins.length - 1]?.x1 ?? 1;
  const span = hi - lo || 1;
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const xOf = (v) => PAD.l + ((v - lo) / span) * plotW;
  const hOf = (c) => (c / maxCount) * plotH;
  const bw = plotW / Math.max(bins.length, 1);
  const inRange = (v) => v >= lo && v <= hi;
  const plural = (n) => (n > 1 ? 's' : '');

  return (
    <div className="db-outliers">
      <dl className="db-outliers-summary">
        <div><dt>Valeurs analysées</dt><dd>{fmt(data.n)}</dd></div>
        <div className="is-flag"><dt>Aberrantes</dt><dd>{fmt(data.outlierCount)} <small>({fmt(data.outlierRate * 100)} %)</small></dd></div>
        <div><dt>Plage normale</dt><dd>{fmt(data.bounds?.lower)} à {fmt(data.bounds?.upper)}</dd></div>
      </dl>

      <div ref={ref} className="db-outliers-plot">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={`Distribution : ${data.outlierCount} valeurs hors de la plage ${fmt(data.bounds?.lower)} à ${fmt(data.bounds?.upper)}`}
        preserveAspectRatio="xMidYMid meet">
        {bins.map((b, i) => {
          const normal = b.count - b.outliers;
          const x = PAD.l + i * bw + 1;
          const base = H - PAD.b;
          return (
            <g key={i}>
              <rect className="db-bin" x={x} width={Math.max(bw - 2, 1)} y={base - hOf(normal)} height={hOf(normal)} />
              {b.outliers > 0 && (
                <rect className="db-bin is-outlier" x={x} width={Math.max(bw - 2, 1)}
                  y={base - hOf(b.count)} height={Math.max(hOf(b.outliers), 3)} />
              )}
              <title>{`${fmt(b.x0)} à ${fmt(b.x1)} : ${b.count} valeur(s), dont ${b.outliers} aberrante(s)`}</title>
            </g>
          );
        })}
        {data.bounds && ['lower', 'upper'].map((k) => (inRange(data.bounds[k]) ? (
          <line key={k} className="db-bound" x1={xOf(data.bounds[k])} x2={xOf(data.bounds[k])} y1={PAD.t} y2={H - PAD.b} />
        ) : null))}
        {data.bounds && inRange(data.bounds.lower) && (
          <text className="db-bound-label" x={xOf(data.bounds.lower)} y={PAD.t - 8} textAnchor="middle">{fmt(data.bounds.lower)}</text>
        )}
        {data.bounds && inRange(data.bounds.upper) && (
          <text className="db-bound-label" x={xOf(data.bounds.upper)} y={PAD.t - 8} textAnchor="middle">{fmt(data.bounds.upper)}</text>
        )}
        <text className="db-xlabel" x={PAD.l} y={H - 6}>{fmt(lo)}</text>
        <text className="db-xlabel" x={W - PAD.r} y={H - 6} textAnchor="end">{fmt(hi)}</text>
        {of.low > 0 && (
          <g className="db-overflow">
            <title>{`${of.low} valeur${plural(of.low)} sous ${fmt(lo)}, la plus basse : ${fmt(of.lowMin)}`}</title>
            <path d={`M6 ${H - PAD.b - 12} l10 -7 v14 z`} />
            <text x={20} y={H - PAD.b - 8}>{of.low}</text>
            <text x={6} y={H - PAD.b + 10} className="db-overflow-val">{fmt(of.lowMin)}</text>
          </g>
        )}
        {of.high > 0 && (
          <g className="db-overflow">
            <title>{`${of.high} valeur${plural(of.high)} au-delà de ${fmt(hi)}, la plus haute : ${fmt(of.highMax)}`}</title>
            <path d={`M${W - 6} ${H - PAD.b - 12} l-10 -7 v14 z`} />
            <text x={W - 20} y={H - PAD.b - 8} textAnchor="end">{of.high}</text>
            <text x={W - 6} y={H - PAD.b + 10} textAnchor="end" className="db-overflow-val">{fmt(of.highMax)}</text>
          </g>
        )}
      </svg>
      </div>

      <p className="db-muted db-method">
        {data.methodLabel}, seuil {fmt(data.threshold)}
        {data.stats && <> ; médiane {fmt(data.stats.median)}, moyenne {fmt(data.stats.mean)}</>}
      </p>
      {data.warning && <p className="db-note">{data.warning}</p>}

      {!compact && data.outliers?.length > 0 && (
        <div className="db-table-wrap">
          <table className="db-table">
            <caption>Lignes les plus éloignées</caption>
            <thead><tr><th scope="col">Ligne</th><th scope="col">Valeur</th><th scope="col">Écart</th></tr></thead>
            <tbody>
              {data.outliers.slice(0, 8).map((o) => (
                <tr key={o.rowId}>
                  <td>#{o.rowId}</td>
                  <td className={o.side === 'high' ? 'is-high' : 'is-low'}>{fmt(o.value)}</td>
                  <td>{o.score === null ? '—' : fmt(o.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
