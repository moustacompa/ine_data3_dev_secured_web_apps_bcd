import { useEffect, useId, useState } from 'react';
import { BarChart, LineChart, PieChart, Histogram, KpiCard, computeHistogram, formatValue, formatNumber, formatPeriod } from './charts';
import { CATEGORY_VIEWS, CHART_TYPES } from '../analysisModel';
import {
  IconChartBar, IconChartHistogram, IconChartKpi, IconChartLine, IconChartPie, IconChartTable, IconInfo, IconSave,
} from '../../../components/icons';

const COMPONENTS = { bar: BarChart, line: LineChart, pie: PieChart, histogram: Histogram, kpi: KpiCard };
const ICONS = { bar: IconChartBar, line: IconChartLine, pie: IconChartPie, histogram: IconChartHistogram, kpi: IconChartKpi, table: IconChartTable };
const PAGE_SIZES = [25, 50, 100];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

function cellValue(v, isTime, granularity) {
  if (v === null || v === undefined || v === '') return <span className="an-null">—</span>;
  if (isTime) return formatPeriod(v, granularity);
  if (typeof v === 'string' && ISO_DATE.test(v)) return formatPeriod(v, 'day');
  return formatValue(v);
}

/** Tableau paginé : en-têtes fixes, défilement interne, nombres alignés à droite. */
function ResultsTable({ result, labels, timeCol, granularity }) {
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const total = result.rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  useEffect(() => { setPage(0); }, [result, size]);
  const start = page * size;
  const rows = result.rows.slice(start, start + size);
  const numeric = Object.fromEntries(result.columns.map((c) => [c, result.rows.some((r) => typeof r[c] === 'number')]));

  return (
    <div className="an-table-block">
      <div className="an-table-wrap" tabIndex={0} role="region" aria-label="Tableau des résultats">
        <table className="an-table">
          <thead>
            <tr>{result.columns.map((c) => (
              <th key={c} scope="col" title={c} className={numeric[c] ? 'is-num' : ''}>{labels[c] || c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={start + i}>
                {result.columns.map((c) => (
                  <td key={c} className={numeric[c] ? 'is-num' : ''}>{cellValue(r[c], c === timeCol, granularity)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="an-pager">
        <p>Lignes {formatNumber(total ? start + 1 : 0)}–{formatNumber(Math.min(start + size, total))} sur {formatNumber(total)}</p>
        <label className="an-pager-size">
          <span>Par page</span>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="an-pager-nav">
          <button type="button" className="an-btn an-btn-ghost an-btn-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Précédent</button>
          <span aria-live="polite">Page {page + 1} / {pages}</span>
          <button type="button" className="an-btn an-btn-ghost an-btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1}>Suivant</button>
        </div>
      </div>
    </div>
  );
}

/** Tableau des classes de l'histogramme (mêmes calculs que le graphique). */
function BinsTable({ chart, rows }) {
  const { bins, n } = computeHistogram(rows, chart.x, chart.y, chart.options?.bins);
  return (
    <div className="an-table-wrap" tabIndex={0} role="region" aria-label="Tableau des classes">
      <table className="an-table">
        <thead><tr><th scope="col">Classe de {chart.x}</th><th scope="col" className="is-num">Effectif</th><th scope="col" className="is-num">Fréquence</th></tr></thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b.range}>
              <td>{b.range}</td>
              <td className="is-num">{formatNumber(b.count)}</td>
              <td className="is-num">{b.share.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th scope="row">Total</th><td className="is-num">{formatNumber(n)}</td><td className="is-num">100 %</td></tr></tfoot>
      </table>
    </div>
  );
}

/** Sélecteur de visualisation : icône, libellé, infobulle ; choix incompatibles expliqués. */
function ChartTypePicker({ value, compat, onChange }) {
  const uid = useId();
  return (
    <div className="an-viz" role="radiogroup" aria-label="Type de visualisation">
      {CHART_TYPES.map(({ type, label, hint }) => {
        const Icon = ICONS[type];
        const ok = !!compat[type]?.ok;
        const on = value === type;
        const tipId = `${uid}-${type}`;
        return (
          <div key={type} className="an-viz-item">
            <button type="button" role="radio" aria-checked={on} aria-disabled={!ok} aria-describedby={tipId}
              className={`an-viz-btn${on ? ' is-on' : ''}${ok ? '' : ' is-off'}`}
              onClick={() => { if (ok) onChange(type); }}>
              <Icon size={20} />
              <span>{label}</span>
            </button>
            <span role="tooltip" id={tipId} className="an-viz-tip">
              <strong>{label}</strong> · {hint}
              {!ok && <em>Indisponible : {compat[type]?.reason}</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalysisResults({
  result, chart, compat, metricCols, labels, timeCol, measures, onChartType, onMeasures, onSave, canSave, stale, title,
  categoryView, onCategoryView,
}) {
  const Component = COMPONENTS[chart.type];
  const multiMeasure = ['bar', 'line', 'kpi'].includes(chart.type) && !chart.options?.seriesBy;
  const showPicker = chart.type !== 'histogram' && chart.type !== 'table' && metricCols.length > 1;
  const { meta } = result;
  const categoryCount = chart.type === 'bar' && !chart.options?.granularity
    ? new Set(result.rows.map((r) => (chart.options?.xFields || [chart.x]).map((f) => r[f]).join('\u0001'))).size : 0;
  const unavailable = CHART_TYPES.filter(({ type }) => !compat[type]?.ok);

  const toggleMeasure = (m) => {
    if (!multiMeasure) { onMeasures([m]); return; }
    const next = measures.includes(m) ? measures.filter((x) => x !== m) : [...measures, m];
    if (next.length) onMeasures(metricCols.filter((c) => next.includes(c)));
  };

  return (
    <section className="an-card an-results" aria-labelledby="an-results-title">
      <header className="an-results-head">
        <div className="an-results-titles">
          <p className="an-eyebrow">Étape 3 · Résultats</p>
          <h2 id="an-results-title">{title}</h2>
          <p className="an-meta">
            <span>{meta.rowCount.toLocaleString('fr-FR')} ligne{meta.rowCount > 1 ? 's' : ''}</span>
            <span>calculé en {meta.executionTimeMs} ms</span>
            {meta.truncated && <span className="an-badge-warn">Résultat tronqué à {meta.limit} lignes</span>}
          </p>
        </div>
        <button type="button" className="an-btn an-btn-primary" onClick={onSave} disabled={!canSave}
          title={stale ? "Relancez l'analyse avant de l'enregistrer" : undefined}>
          <IconSave /> Sauvegarder l'analyse
        </button>
      </header>

      {stale && <p className="an-callout is-warn" role="status">Les paramètres ont changé depuis ce calcul : relancez l'analyse pour mettre à jour les résultats.</p>}

      {result.rows.length === 0 ? (
        <div className="an-empty">
          <p><strong>Aucune ligne ne correspond à cette analyse.</strong></p>
          <p className="an-hint">Assouplissez ou retirez des filtres, puis relancez.</p>
        </div>
      ) : (
        <>
          <div className="an-viz-bar">
            <ChartTypePicker value={chart.type} compat={compat} onChange={onChartType} />
            {unavailable.length > 0 && (
              <details className="an-why">
                <summary><IconInfo /> Pourquoi {unavailable.length > 1 ? `${unavailable.length} visualisations sont indisponibles` : 'une visualisation est indisponible'} ?</summary>
                <ul>
                  {unavailable.map(({ type, label }) => <li key={type}><strong>{label}</strong> : {compat[type].reason}</li>)}
                </ul>
              </details>
            )}
          </div>

          {(showPicker || categoryCount > 10) && (
            <div className="an-viz-options">
              {showPicker && (
                <div className="an-viz-opt">
                  <span className="an-label" id="an-measures-shown">{multiMeasure ? 'Indicateurs affichés' : 'Indicateur affiché'}</span>
                  <div className="an-chips" role="group" aria-labelledby="an-measures-shown">
                    {metricCols.map((m) => (
                      <button key={m} type="button" className={`an-chip${measures.includes(m) ? ' is-on' : ''}`}
                        aria-pressed={measures.includes(m)} onClick={() => toggleMeasure(m)}>{labels[m] || m}</button>
                    ))}
                  </div>
                </div>
              )}
              {categoryCount > 10 && (
                <div className="an-viz-opt">
                  <span className="an-label" id="an-cat-view">Catégories affichées ({formatNumber(categoryCount)} au total)</span>
                  <div className="an-segmented" role="radiogroup" aria-labelledby="an-cat-view">
                    {CATEGORY_VIEWS.map((v) => (
                      <button key={v.id} type="button" role="radio" aria-checked={categoryView === v.id}
                        className={categoryView === v.id ? 'is-on' : ''} onClick={() => onCategoryView(v.id)}>{v.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {Component && (
            <div className={`an-chart-box is-${chart.type}`}>
              <Component data={result.rows} x={chart.x} y={chart.y} title={title}
                options={{ ...chart.options, truncated: meta.truncated }} />
            </div>
          )}

          <div className="an-table-section">
            <h3 className="an-subtitle">{chart.type === 'histogram' ? 'Classes de la distribution' : 'Données du résultat'}</h3>
            {chart.type === 'histogram'
              ? <BinsTable chart={chart} rows={result.rows} />
              : <ResultsTable result={result} labels={labels} timeCol={timeCol} granularity={chart.options?.granularity} />}
          </div>
        </>
      )}
    </section>
  );
}
