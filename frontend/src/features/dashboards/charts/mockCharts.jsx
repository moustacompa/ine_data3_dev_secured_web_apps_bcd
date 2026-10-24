/**
 * Graphiques de REMPLACEMENT en attendant les composants de P3.
 * Contrat de props commun (à respecter par P3) :
 *   { data: Array<object>, x: string, y: string | string[], title?: string }
 * Pas de dépendance : SVG pur, responsive via viewBox.
 */
import { useLayoutEffect, useState } from 'react';

/** Mesure le conteneur pour que le SVG occupe toute la place du widget. */
export function useSize() {
  // ref par callback : fonctionne même si l'élément apparaît après le 1er rendu
  const [el, setEl] = useState(null);
  const [size, setSize] = useState({ w: 400, h: 220 });
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) setSize({ w: Math.round(width), h: Math.max(Math.round(height), 90) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size];
}

const PAD = { t: 12, r: 12, b: 34, l: 44 };
const SERIES = ['var(--db-series-1)', 'var(--db-series-2)', 'var(--db-series-3)', 'var(--db-series-4)'];

const asArray = (y) => (Array.isArray(y) ? y : [y]).filter(Boolean);
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
export const fmt = (v) =>
  typeof v === 'number' ? v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : v ?? '—';

function scale(values) {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  return { min, max: max === min ? min + 1 : max };
}

function Axis({ min, max, W, H }) {
  const ticks = [min, (min + max) / 2, max];
  const yOf = (v) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  return (
    <g className="db-axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} />
          <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end">{fmt(Math.round(t * 100) / 100)}</text>
        </g>
      ))}
    </g>
  );
}

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="db-legend">
      {series.map((s, i) => (
        <span key={s}><i style={{ background: SERIES[i % SERIES.length] }} />{s}</span>
      ))}
    </div>
  );
}

export function BarChart({ data = [], x, y }) {
  const [ref, { w: W, h: H }] = useSize();
  const series = asArray(y);
  const rows = data.slice(0, 30);
  const { min, max } = scale(rows.flatMap((r) => series.map((s) => num(r[s]))));
  const plotW = W - PAD.l - PAD.r;
  const band = plotW / Math.max(rows.length, 1);
  const barW = Math.min(Math.max((band * 0.75) / series.length, 2), 56);
  const groupOffset = (band - barW * series.length) / 2;
  const yOf = (v) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  return (
    <figure className="db-chart">
      <div className="db-chart-area" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Barres : ${series.join(', ')} par ${x}`}>
        <Axis min={min} max={max} W={W} H={H} />
        {rows.map((r, i) =>
          series.map((s, j) => {
            const v = num(r[s]);
            const top = yOf(Math.max(v, 0));
            return (
              <rect key={`${i}-${s}`} x={PAD.l + i * band + groupOffset + j * barW} y={top}
                width={barW} height={Math.abs(yOf(v) - yOf(0))} fill={SERIES[j % SERIES.length]}>
                <title>{`${r[x]} : ${fmt(v)}`}</title>
              </rect>
            );
          }))}
        {band >= 34 && rows.map((r, i) => (
          <text key={i} className="db-xlabel" x={PAD.l + i * band + band / 2} y={H - 14} textAnchor="middle">
            {String(r[x] ?? '').slice(0, 10)}
          </text>
        ))}
      </svg>
      </div>
      <Legend series={series} />
    </figure>
  );
}

export function LineChart({ data = [], x, y }) {
  const [ref, { w: W, h: H }] = useSize();
  const series = asArray(y);
  const { min, max } = scale(data.flatMap((r) => series.map((s) => num(r[s]))));
  const n = Math.max(data.length - 1, 1);
  const xOf = (i) => PAD.l + (i / n) * (W - PAD.l - PAD.r);
  const yOf = (v) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const step = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(W / 70))));
  return (
    <figure className="db-chart">
      <div className="db-chart-area" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Courbe : ${series.join(', ')} selon ${x}`}>
        <Axis min={min} max={max} W={W} H={H} />
        {series.map((s, j) => (
          <polyline key={s} fill="none" stroke={SERIES[j % SERIES.length]} strokeWidth="2"
            points={data.map((r, i) => `${xOf(i)},${yOf(num(r[s]))}`).join(' ')} />
        ))}
        {data.map((r, i) => (i % step === 0 ? (
          <text key={i} className="db-xlabel" x={xOf(i)} y={H - 14} textAnchor="middle">{String(r[x] ?? '').slice(0, 10)}</text>
        ) : null))}
      </svg>
      </div>
      <Legend series={series} />
    </figure>
  );
}

export function PieChart({ data = [], x, y }) {
  const key = asArray(y)[0];
  const rows = data.filter((r) => num(r[key]) > 0).slice(0, 8);
  const total = rows.reduce((s, r) => s + num(r[key]), 0) || 1;
  const colors = ['var(--db-series-1)', 'var(--db-series-2)', 'var(--db-series-3)', 'var(--db-series-4)',
    'var(--db-series-5)', 'var(--db-series-6)', 'var(--db-series-7)', 'var(--db-series-8)'];
  let angle = -Math.PI / 2;
  const arcs = rows.map((r, i) => {
    const a = (num(r[key]) / total) * Math.PI * 2;
    const [x1, y1] = [100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle)];
    angle += a;
    const [x2, y2] = [100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle)];
    const d = rows.length === 1
      ? 'M100 20 A80 80 0 1 1 99.99 20 Z'
      : `M100 100 L${x1} ${y1} A80 80 0 ${a > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
    return <path key={i} d={d} fill={colors[i]}><title>{`${r[x]} : ${fmt(num(r[key]))}`}</title></path>;
  });
  return (
    <figure className="db-chart db-pie">
      <svg viewBox="0 0 200 200" role="img" aria-label={`Répartition de ${key} par ${x}`}>{arcs}</svg>
      <ul className="db-pie-legend">
        {rows.map((r, i) => (
          <li key={i}><i style={{ background: colors[i] }} />{r[x]}<b>{Math.round((num(r[key]) / total) * 100)} %</b></li>
        ))}
      </ul>
    </figure>
  );
}

export function KpiCard({ data = [], y, title }) {
  const key = asArray(y)[0] || Object.keys(data[0] || {})[0];
  const value = data[0]?.[key];
  return (
    <div className="db-kpi">
      <strong>{fmt(typeof value === 'string' ? Number(value) : value)}</strong>
      <span>{title || key}</span>
    </div>
  );
}

export function Histogram(props) {
  return <BarChart {...props} y={asArray(props.y).slice(0, 1)} />;
}
