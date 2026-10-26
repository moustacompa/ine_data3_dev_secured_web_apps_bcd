import { useState } from 'react';
import FiltersEditor from './FiltersEditor';
import {
  IconCalendar, IconCheck, IconChartHistogram, IconFilter, IconLayers, IconPlay, IconReset, IconSigma, IconSort, IconWarning,
} from '../../../components/icons';
import {
  GRANULARITY_LABELS, HIGH_CARDINALITY, LIMIT_PRESETS, MAX_TIME_POINTS, NUMERIC_OPS, OP_INFO, OP_LABELS,
  addedByToggle, buildQuery, isNumericMetric, isRowCount, limitPreset, metricLabel, metricName, metricSelection,
  resultShape, sameMetric, toggleMeasureField, toggleOperation,
} from '../analysisModel';

const fmt = (n) => Number(n).toLocaleString('fr-FR');
// Colonne de résultat issue d'un indicateur (et non d'un regroupement)
const resultShapeMetric = (form, col) => form.metrics.some((m) => metricName(m) === col) || (!form.metrics.length && col === 'count');

/** Section repliable du panneau : en-tête bouton (aria-expanded), lettre et résumé. */
function Section({ letter, icon: Icon, title, summary, defaultOpen = true, collapsible = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `an-sec-${letter}`;
  const head = (
    <>
      <span className="an-sec-icon" aria-hidden="true"><Icon /></span>
      <span className="an-sec-titles">
        <span className="an-sec-title"><span className="an-sec-letter">{letter}</span>{title}</span>
        {summary && <span className="an-sec-summary">{summary}</span>}
      </span>
    </>
  );
  return (
    <section className={`an-sec${open ? ' is-open' : ''}`} aria-labelledby={`${id}-h`}>
      <h3 className="an-sec-head" id={`${id}-h`}>
        {collapsible ? (
          <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            {head}<span className="an-sec-caret" aria-hidden="true" />
          </button>
        ) : <span className="an-sec-static">{head}</span>}
      </h3>
      {(open || !collapsible) && <div id={id} className="an-sec-body">{children}</div>}
    </section>
  );
}

/** Section A : opérations × colonnes mesurées, plus le comptage des lignes. */
function OperationsSection({ form, columns, ops, maxMetrics, onChange }) {
  const numeric = columns.filter((c) => c.type === 'number');
  const sel = metricSelection(form.metrics);
  const room = maxMetrics - form.metrics.length;
  const numericOps = ops.filter((op) => NUMERIC_OPS.includes(op));
  const countRows = { op: 'count' };
  const others = form.metrics.filter((m) => !isNumericMetric(m) && !isRowCount(m));

  return (
    <div className="an-ops">
      <div className="an-ops-group" role="group" aria-labelledby="an-ops-label">
        <p className="an-label" id="an-ops-label">Opérations <span className="an-label-hint">plusieurs choix possibles</span></p>
        <div className="an-op-grid">
          {numericOps.map((op) => {
            const on = sel.ops.includes(op);
            const blocked = !on && (!numeric.length || addedByToggle(form.metrics, { op }) > room);
            return (
              <button key={op} type="button" className={`an-op${on ? ' is-on' : ''}`} aria-pressed={on} disabled={blocked}
                title={!numeric.length ? 'Aucune colonne numérique dans ce dataset' : blocked ? `${maxMetrics} indicateurs maximum` : OP_INFO[op]?.hint}
                onClick={() => onChange(toggleOperation(form.metrics, op, numeric[0]?.name))}>
                <span className="an-op-check" aria-hidden="true">{on && <IconCheck size={12} />}</span>
                <span className="an-op-name">{OP_LABELS[op]}</span>
                <span className="an-op-sql">{OP_INFO[op]?.sql}</span>
              </button>
            );
          })}
          <button type="button" className={`an-op${sel.countRows ? ' is-on' : ''}`} aria-pressed={sel.countRows}
            disabled={!sel.countRows && room < 1} title="Nombre de lignes (observations)"
            onClick={() => onChange(sel.countRows ? form.metrics.filter((m) => !isRowCount(m)) : [...form.metrics, countRows])}>
            <span className="an-op-check" aria-hidden="true">{sel.countRows && <IconCheck size={12} />}</span>
            <span className="an-op-name">Nombre d'observations</span>
            <span className="an-op-sql">COUNT</span>
          </button>
        </div>
      </div>

      {numeric.length > 0 && (
        <div className="an-ops-group" role="group" aria-labelledby="an-measures-label">
          <p className="an-label" id="an-measures-label">Appliquées aux colonnes numériques</p>
          <div className="an-chips">
            {numeric.map((c) => {
              const on = sel.fields.includes(c.name);
              const blocked = !on && addedByToggle(form.metrics, { field: c.name }) > room;
              return (
                <button key={c.name} type="button" className={`an-chip${on ? ' is-on' : ''}`} aria-pressed={on} disabled={blocked}
                  onClick={() => onChange(toggleMeasureField(form.metrics, c.name))}>
                  {on && <IconCheck size={14} />}{c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="an-metric-summary" aria-live="polite">
        <p className="an-label">Indicateurs calculés <span className="an-label-hint">{form.metrics.length} / {maxMetrics}</span></p>
        {form.metrics.length ? (
          <ul className="an-metric-list">
            {form.metrics.map((m) => (
              <li key={metricName(m)}>
                {metricLabel(m)}
                <button type="button" aria-label={`Retirer ${metricLabel(m)}`} title="Retirer"
                  onClick={() => onChange(form.metrics.filter((x) => !sameMetric(x, m)))}>×</button>
              </li>
            ))}
          </ul>
        ) : <p className="an-hint">Aucune opération choisie : l'analyse comptera les lignes.</p>}
        {others.length > 0 && <p className="an-hint">Comptages spécifiques repris de l'analyse ouverte.</p>}
      </div>
    </div>
  );
}

/** Section B : colonnes de regroupement (badges numérotés) et alertes de lisibilité. */
function GroupBySection({ form, columns, maxGroupBy, cardinality, onChange, onTopN }) {
  const candidates = columns.filter((c) => c.name !== form.timeField);
  const toggle = (name) => onChange(form.groupBy.includes(name) ? form.groupBy.filter((g) => g !== name) : [...form.groupBy, name]);
  const crowded = form.groupBy.filter((g) => (cardinality?.[g] || 0) > HIGH_CARDINALITY);

  return (
    <div className="an-groupby">
      <div className="an-chips" role="group" aria-label="Colonnes de regroupement">
        {candidates.map((c) => {
          const index = form.groupBy.indexOf(c.name);
          const on = index >= 0;
          const distinct = cardinality?.[c.name];
          const high = distinct > HIGH_CARDINALITY;
          return (
            <button key={c.name} type="button" className={`an-chip an-chip-group${on ? ' is-on' : ''}${high ? ' is-high' : ''}`}
              aria-pressed={on} disabled={!on && form.groupBy.length >= maxGroupBy}
              title={high ? `${fmt(distinct)} valeurs distinctes : catégories nombreuses` : undefined}
              onClick={() => toggle(c.name)}>
              {on && <span className="an-chip-index">{index + 1}</span>}
              <span>{c.name}</span>
              {distinct !== undefined && (
                <span className="an-chip-count">{high && <IconWarning size={12} />}{fmt(distinct)}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="an-hint">
        {form.groupBy.length
          ? `Ordre : ${form.groupBy.join(' › ')}. ${maxGroupBy} colonnes maximum.`
          : 'Sans regroupement, le résultat est un indicateur global (affiché en KPI).'}
        {cardinality && ' Le nombre indique les valeurs distinctes de chaque colonne.'}
      </p>
      {crowded.length > 0 && (
        <div className="an-callout is-warn" role="status">
          <IconWarning />
          <div>
            <p>
              <strong>{crowded.join(', ')}</strong> compte {crowded.map((g) => fmt(cardinality[g])).join(' et ')} valeurs
              distinctes : autant de catégories. Le graphique n'en affichera qu'une partie, le tableau les gardera toutes.
            </p>
            <p>Pour une colonne numérique, préférez une opération (Somme, Moyenne…) ou l'histogramme.</p>
            {limitPreset(form.limit) === 'all' && (
              <button type="button" className="an-btn an-btn-ghost an-btn-sm" onClick={onTopN}>Limiter au Top 10</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Section C : série temporelle, granularité (points estimés) et indicateur suivi. */
function TimeSection({ form, columns, granularities, timePoints, notice, onTimeField, onChange }) {
  const dates = columns.filter((c) => c.type === 'date');
  const numeric = columns.filter((c) => c.type === 'number');
  const points = form.timeField ? timePoints?.[form.timeField] : null;
  const active = !!form.timeField;
  const current = points?.[form.granularity];
  if (!dates.length) return <p className="an-hint">Aucune colonne date détectée dans ce dataset.</p>;
  const measureLabel = form.metrics.length ? metricLabel(form.metrics[0]) : 'Nombre de lignes';

  // Indicateur suivi = premier indicateur (il pilote la courbe et le tri par défaut)
  const pickMeasure = (value) => {
    if (value.startsWith('add:')) { onChange({ metrics: [{ op: 'sum', field: value.slice(4) }, ...form.metrics] }); return; }
    const i = Number(value);
    onChange({ metrics: [form.metrics[i], ...form.metrics.filter((_, j) => j !== i)] });
  };

  return (
    <div className="an-time">
      <div className="an-row">
        <label className="an-field">
          <span>Colonne date</span>
          <select value={form.timeField} onChange={(e) => onTimeField(e.target.value)}>
            <option value="">Aucune</option>
            {dates.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="an-field">
          <span>Indicateur analysé</span>
          <select value={form.metrics.length ? '0' : ''} onChange={(e) => pickMeasure(e.target.value)}>
            {!form.metrics.length && <option value="">Nombre de lignes</option>}
            {form.metrics.map((m, i) => <option key={metricName(m)} value={String(i)}>{metricLabel(m)}</option>)}
            {numeric.filter((c) => !form.metrics.some((m) => m.op === 'sum' && m.field === c.name))
              .map((c) => <option key={c.name} value={`add:${c.name}`}>Somme de {c.name} (ajouter)</option>)}
          </select>
        </label>
      </div>

      <p className="an-label" id="an-gran-label">Granularité</p>
      {/* Sans colonne date : granularités désactivées et aucune sélectionnée */}
      <div role="radiogroup" aria-labelledby="an-gran-label" aria-disabled={!active} className={`an-gran${active ? '' : ' is-disabled'}`}>
        {granularities.map((g) => {
          const n = points?.[g];
          const on = active && form.granularity === g;
          return (
            <button key={g} type="button" role="radio" aria-checked={on} disabled={!active}
              className={`an-gran-btn${on ? ' is-on' : ''}${n > MAX_TIME_POINTS ? ' is-dense' : ''}`}
              onClick={() => onChange({ granularity: g })}>
              <span>{GRANULARITY_LABELS[g] || g}</span>
              {n !== undefined && <small>{fmt(n)} pt{n > 1 ? 's' : ''}</small>}
            </button>
          );
        })}
      </div>
      {active ? (
        <p className="an-time-summary">
          Courbe : <strong>{measureLabel}</strong> par <strong>{(GRANULARITY_LABELS[form.granularity] || form.granularity).toLowerCase()}</strong> de <strong>{form.timeField}</strong>
        </p>
      ) : (
        <p className="an-hint">Choisissez une colonne date pour activer Jour, Semaine, Mois, Trimestre et Année.</p>
      )}
      {active && notice && <p className="an-callout is-info" role="status">{notice}</p>}
      {active && current > MAX_TIME_POINTS && (
        <p className="an-callout is-warn" role="status">
          <IconWarning /> {fmt(current)} points sur la courbe : elle sera peu lisible. Choisissez une granularité plus large.
        </p>
      )}
    </div>
  );
}

/** Section E : tri (défaut, croissant, décroissant), Top N et classement. */
function SortSection({ form, sortable, maxRows, onChange }) {
  const firstMetric = sortable.find((c) => !['rank', 'share_pct'].includes(c) && resultShapeMetric(form, c)) || sortable[0] || '';
  const dir = form.orderField ? form.orderDir : 'default';
  const preset = limitPreset(form.limit);
  const setDir = (d) => onChange(d === 'default' ? { orderField: '' } : { orderField: form.orderField || firstMetric, orderDir: d });
  const setPreset = (id) => {
    if (id === 'all') { onChange({ limit: '' }); return; }
    const limit = id === 'custom' ? (preset === 'custom' ? form.limit : '20') : id;
    // Un Top N n'a de sens que trié : par défaut, valeurs décroissantes du premier indicateur
    onChange({ limit, ...(form.orderField ? {} : { orderField: firstMetric, orderDir: 'desc' }) });
  };

  return (
    <div className="an-sort">
      <div className="an-sort-block">
        <p className="an-label" id="an-dir-label">Ordre des résultats</p>
        <div className="an-segmented" role="radiogroup" aria-labelledby="an-dir-label">
          {[['default', 'Par défaut'], ['desc', 'Décroissant ↓'], ['asc', 'Croissant ↑']].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={dir === id} className={dir === id ? 'is-on' : ''}
              onClick={() => setDir(id)}>{label}</button>
          ))}
        </div>
        {form.orderField && (
          <label className="an-field an-sort-field">
            <span>Trier selon</span>
            <select value={sortable.includes(form.orderField) ? form.orderField : ''} onChange={(e) => onChange({ orderField: e.target.value })}>
              {!sortable.includes(form.orderField) && <option value="">Choisir…</option>}
              {sortable.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="an-sort-block">
        <p className="an-label" id="an-limit-label">Classement</p>
        <div className="an-segmented" role="radiogroup" aria-labelledby="an-limit-label">
          {LIMIT_PRESETS.map(({ id, label }) => (
            <button key={id} type="button" role="radio" aria-checked={preset === id} className={preset === id ? 'is-on' : ''}
              onClick={() => setPreset(id)}>{label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <label className="an-field an-field-sm">
            <span>Nombre de lignes</span>
            <input type="number" min="1" max={maxRows} value={form.limit} onChange={(e) => onChange({ limit: e.target.value })} />
          </label>
        )}
        <label className="an-check">
          <input type="checkbox" checked={form.rank} onChange={(e) => onChange({ rank: e.target.checked })}
            disabled={!form.groupBy.length && !form.timeField} />
          Ajouter le rang et la part du total (%)
        </label>
      </div>
    </div>
  );
}

export default function AnalysisConfigPanel({
  form, onChange, columns, capabilities, onRun, onReset, running, errors = [], dirty, hasResult,
  cardinality, timePoints, timeNotice, onTimeField,
}) {
  const limits = capabilities?.limits || {};
  const maxMetrics = limits.maxMetrics || 10;
  const maxGroupBy = limits.maxGroupBy || 3;
  const ops = Object.keys(OP_LABELS).filter((op) => !capabilities || capabilities.metricOps.includes(op));
  const granularities = capabilities?.granularities || Object.keys(GRANULARITY_LABELS);
  const numeric = columns.filter((c) => c.type === 'number');
  const set = (patch) => onChange({ ...form, ...patch });
  const disabled = !columns.length;
  const sortable = form.mode === 'aggregate' && columns.length ? resultShape(buildQuery(form, columns, limits)).all : [];
  const aggregate = form.mode === 'aggregate';

  const sortSummary = [
    form.orderField ? `${form.orderDir === 'asc' ? '↑' : '↓'} ${form.orderField}` : null,
    form.limit ? `${form.limit} lignes max.` : null,
    form.rank ? 'rang' : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="an-card an-config" aria-labelledby="an-config-title">
      <header className="an-config-head">
        <div>
          <p className="an-eyebrow">Étape 2</p>
          <h2 id="an-config-title">Configurer l'analyse</h2>
        </div>
        {!disabled && (
          <div className="an-segmented an-mode" role="radiogroup" aria-label="Type d'analyse">
            {[['aggregate', 'Agrégation'], ['distribution', 'Distribution']].map(([mode, label]) => (
              <button key={mode} type="button" role="radio" aria-checked={form.mode === mode}
                className={form.mode === mode ? 'is-on' : ''} onClick={() => set({ mode })}>{label}</button>
            ))}
          </div>
        )}
      </header>

      {disabled ? <p className="an-config-empty">Choisissez d'abord un dataset pour configurer l'analyse.</p> : (
        <form className="an-config-form" onSubmit={(e) => { e.preventDefault(); onRun(); }}>
          <div className="an-config-scroll">
            {aggregate ? (
              <>
                <Section letter="A" icon={IconSigma} title="Opérations statistiques" collapsible={false}
                  summary="Que voulez-vous calculer ?">
                  <OperationsSection form={form} columns={columns} ops={ops} maxMetrics={maxMetrics}
                    onChange={(metrics) => set({ metrics })} />
                </Section>

                <Section letter="B" icon={IconLayers} title="Regrouper les résultats par" collapsible={false}
                  summary="Comparer des catégories (GROUP BY)">
                  <GroupBySection form={form} columns={columns} maxGroupBy={maxGroupBy} cardinality={cardinality}
                    onChange={(groupBy) => set({ groupBy })}
                    onTopN={() => set({ limit: '10', ...(form.orderField ? {} : { orderField: sortable.find((c) => resultShapeMetric(form, c)) || '', orderDir: 'desc' }) })} />
                </Section>

                <Section letter="C" icon={IconCalendar} title="Analyse temporelle" defaultOpen={!!form.timeField || !form.groupBy.length}
                  summary={form.timeField ? `${form.timeField} · ${(GRANULARITY_LABELS[form.granularity] || '').toLowerCase()}` : 'Évolution dans le temps'}>
                  <TimeSection form={form} columns={columns} granularities={granularities} timePoints={timePoints}
                    notice={timeNotice} onTimeField={onTimeField} onChange={set} />
                </Section>
              </>
            ) : (
              <Section letter="A" icon={IconChartHistogram} title="Distribution d'une variable" collapsible={false}
                summary="Histogramme des valeurs d'une colonne numérique">
                {numeric.length ? (
                  <div className="an-row">
                    <label className="an-field">
                      <span>Colonne numérique</span>
                      <select value={form.distField} onChange={(e) => set({ distField: e.target.value })}>
                        <option value="">Choisir</option>
                        {numeric.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="an-field an-field-sm">
                      <span>Classes</span>
                      <input type="number" min="2" max="50" value={form.bins} placeholder="auto"
                        onChange={(e) => set({ bins: e.target.value })} />
                    </label>
                  </div>
                ) : <p className="an-hint">Aucune colonne numérique dans ce dataset.</p>}
                <p className="an-hint">
                  Le backend renvoie l'effectif réel de chaque valeur ; l'histogramme les regroupe en classes d'égale amplitude
                  (nombre de classes par défaut : règle de Sturges).
                </p>
              </Section>
            )}

            <Section letter={aggregate ? 'D' : 'B'} icon={IconFilter} title="Filtres" defaultOpen={form.filters.length > 0}
              summary={form.filters.length ? `${form.filters.length} filtre${form.filters.length > 1 ? 's' : ''} actif${form.filters.length > 1 ? 's' : ''}` : 'Restreindre les lignes analysées'}>
              <FiltersEditor filters={form.filters} columns={columns} onChange={(filters) => set({ filters })} />
            </Section>

            {aggregate && (
              <Section letter="E" icon={IconSort} title="Tri et classement" defaultOpen={!!(form.orderField || form.limit || form.rank)}
                summary={sortSummary || 'Ordre, Top 5, Top 10, limite'}>
                <SortSection form={form} sortable={sortable} maxRows={limits.maxRows || 1000} onChange={set} />
              </Section>
            )}

            {errors.length > 0 && (
              <ul className="an-error-list" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            )}
          </div>

          {/* Section F : toujours visible en bas du panneau */}
          <div className="an-run">
            {dirty && hasResult && <p className="an-dirty" role="status">Paramètres modifiés : relancez l'analyse.</p>}
            <div className="an-run-actions">
              <button type="button" className="an-btn an-btn-ghost" onClick={onReset} disabled={running}>
                <IconReset /> Réinitialiser
              </button>
              <button type="submit" className="an-btn an-btn-primary an-run-btn" disabled={running || errors.length > 0} aria-busy={running}>
                {running ? <span className="an-spinner" aria-hidden="true" /> : <IconPlay />}
                {running ? 'Calcul en cours…' : "Exécuter l'analyse"}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
