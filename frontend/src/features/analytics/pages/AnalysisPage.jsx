import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { analysesApi, ROUTES } from '../../dashboards';
import { errorMessage } from '../../dashboards/api/client';
import { analyticsApi, isCanceled } from '../api/analyticsApi';
import DatasetSelector from '../components/DatasetSelector';
import AnalysisConfigPanel from '../components/AnalysisConfigPanel';
import AnalysisResults from '../components/AnalysisResults';
import SaveAnalysisDialog from '../components/SaveAnalysisDialog';
import {
  CATEGORY_VIEWS, GRANULARITY_LABELS, buildChart, buildQuery, cardinalityOf, cardinalityQueries, chartCompatibility,
  columnLabels, emptyForm, estimateTimePoints, formErrors, formFromConfig, metricLabel, resultShape, suggestChart,
  suggestGranularity, timeProfileQuery,
} from '../analysisModel';
import { IconAnalyze, IconFolder, IconPlus } from '../../../components/icons';
import '../analytics.css';

const keyOf = (datasetId, query) => JSON.stringify([String(datasetId), query]);

function defaultTitle(query, mode) {
  const shape = resultShape(query);
  if (mode === 'distribution') return `Distribution de ${query.groupBy[0]}`;
  const what = shape.metrics.map(metricLabel).join(', ');
  return shape.groupCols.length ? `${what} par ${shape.groupCols.join(', ')}` : what;
}

/**
 * Page Analyse (P3) : /analyse et /analyse?analysisId=… (ouverture d'une analyse P4).
 */
export default function AnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const analysisId = searchParams.get('analysisId');

  // Données de référence
  const [capabilities, setCapabilities] = useState(null);
  const [datasets, setDatasets] = useState(null);
  const [datasetsError, setDatasetsError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [datasetId, setDatasetId] = useState('');
  const [columns, setColumns] = useState([]);
  const [columnsState, setColumnsState] = useState({ loading: false, error: null, datasetId: null });

  // Configuration et résultat
  const [form, setForm] = useState(emptyForm);
  const [executed, setExecuted] = useState(null); // { datasetId, query, mode, key }
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [chartType, setChartType] = useState('bar');
  const [measures, setMeasures] = useState([]);
  const [categoryView, setCategoryView] = useState('top20');

  // Profil des colonnes (requêtes réelles) : valeurs distinctes, points par granularité
  const [cardinality, setCardinality] = useState(null);
  const [timePoints, setTimePoints] = useState({});
  const [timeNotice, setTimeNotice] = useState(null);
  const autoGranularity = useRef(null); // colonne date en attente d'une granularité proposée

  // Analyse enregistrée (P4)
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState(null);
  const pending = useRef(null); // { chart } : graphique à restaurer après l'ouverture
  const runController = useRef(null);
  const resultsRef = useRef(null); // zone des résultats, ramenée à l'écran après une exécution

  // 1. Capacités et datasets accessibles
  useEffect(() => {
    const ctrl = new AbortController();
    setDatasetsError(null);
    setDatasets(null);
    Promise.all([analyticsApi.capabilities(ctrl.signal), analyticsApi.datasets(ctrl.signal)])
      .then(([caps, list]) => { setCapabilities(caps); setDatasets(list); })
      .catch((err) => { if (!isCanceled(err)) setDatasetsError(errorMessage(err, 'Impossible de charger les datasets.')); });
    return () => ctrl.abort();
  }, [reloadKey]);

  // 2. Ouverture d'une analyse existante
  useEffect(() => {
    if (!analysisId) { setAnalysis(null); setAnalysisError(null); return undefined; }
    if (analysis && String(analysis.id) === analysisId) return undefined;
    let alive = true;
    setAnalysisError(null);
    analysesApi.get(analysisId)
      .then((a) => {
        if (!alive) return;
        const { form: f, chart } = formFromConfig(a.config);
        setAnalysis(a);
        setForm(f);
        setDatasetId(String(a.datasetId));
        setResult(null);
        setExecuted(null);
        pending.current = { chart };
      })
      .catch((err) => { if (alive) setAnalysisError(errorMessage(err, "Impossible d'ouvrir cette analyse.")); });
    return () => { alive = false; };
  }, [analysisId]); // `analysis` est seulement lu : pas de rechargement quand il change

  // 3. Colonnes du dataset choisi
  useEffect(() => {
    setColumns([]);
    if (!datasetId) { setColumnsState({ loading: false, error: null, datasetId: null }); return undefined; }
    const ctrl = new AbortController();
    setColumnsState({ loading: true, error: null, datasetId: null });
    analyticsApi.columns(datasetId, ctrl.signal)
      .then((d) => { setColumns(d.columns); setColumnsState({ loading: false, error: null, datasetId }); })
      .catch((err) => {
        if (!isCanceled(err)) setColumnsState({ loading: false, error: errorMessage(err, 'Impossible de lire les colonnes.'), datasetId: null });
      });
    return () => ctrl.abort();
  }, [datasetId]);

  // 3 bis. Nombre de valeurs distinctes de chaque colonne (aide au regroupement)
  useEffect(() => {
    setCardinality(null);
    setTimePoints({});
    if (!columns.length || columnsState.datasetId !== datasetId) return undefined;
    const ctrl = new AbortController();
    Promise.all(cardinalityQueries(columns, capabilities?.limits?.maxMetrics)
      .map((q) => analyticsApi.query(Number(datasetId), q, ctrl.signal)))
      .then((results) => {
        const row = Object.assign({}, ...results.map((r) => r.rows[0] || {}));
        setCardinality(Object.fromEntries(columns.map((c) => [c.name, cardinalityOf(row, c.name)]).filter(([, n]) => n !== undefined)));
      })
      .catch(() => { /* aide facultative : la page reste utilisable sans ce profil */ });
    return () => ctrl.abort();
  }, [columns, columnsState.datasetId, datasetId, capabilities]);

  // 3 ter. Densité de la colonne date choisie : points attendus par granularité
  const timeField = form.mode === 'aggregate' ? form.timeField : '';
  useEffect(() => {
    if (!timeField || timePoints[timeField] || columnsState.datasetId !== datasetId) return undefined;
    const ctrl = new AbortController();
    analyticsApi.query(Number(datasetId), timeProfileQuery(timeField, capabilities?.limits?.maxRows), ctrl.signal)
      .then((data) => {
        const points = estimateTimePoints(data.rows, timeField);
        if (!points) return;
        setTimePoints((tp) => ({ ...tp, [timeField]: points }));
        if (autoGranularity.current !== timeField) return;
        autoGranularity.current = null;
        const g = suggestGranularity(points, capabilities?.granularities);
        setForm((f) => (f.timeField === timeField ? { ...f, granularity: g } : f));
        setTimeNotice(`Granularité « ${GRANULARITY_LABELS[g]} » proposée : ${points[g]} point${points[g] > 1 ? 's' : ''} sur la courbe`
          + (g !== 'day' ? ` (${points.day} au jour près).` : '.') + ' Vous pouvez en choisir une autre.');
      })
      .catch(() => { autoGranularity.current = null; });
    return () => ctrl.abort();
  }, [timeField, timePoints, datasetId, columnsState.datasetId, capabilities]);

  const chooseTimeField = (field) => {
    setTimeNotice(null);
    autoGranularity.current = field && !timePoints[field] ? field : null;
    const known = field && timePoints[field] ? suggestGranularity(timePoints[field], capabilities?.granularities) : null;
    setForm((f) => ({
      ...f, timeField: field, timeAlias: '', groupBy: f.groupBy.filter((g) => g !== field), ...(known ? { granularity: known } : {}),
    }));
  };

  useEffect(() => () => runController.current?.abort(), []);

  const limits = capabilities?.limits;
  const errors = useMemo(() => (columns.length ? formErrors(form, limits) : []), [form, columns, limits]);
  const currentQuery = useMemo(() => (columns.length ? buildQuery(form, columns, limits) : null), [form, columns, limits]);
  const stale = !!executed && !!currentQuery && keyOf(datasetId, currentQuery) !== executed.key;

  // 4. Exécution
  // restore : graphique enregistré à réafficher (ouverture d'une analyse)
  const run = useCallback(async (restore) => {
    if (!currentQuery || errors.length) return;
    runController.current?.abort();
    const ctrl = new AbortController();
    runController.current = ctrl;
    setRunning(true);
    setRunError(null);
    setSaved(null);
    try {
      const data = await analyticsApi.query(Number(datasetId), currentQuery, ctrl.signal);
      const shape = resultShape(currentQuery);
      let nextMeasures = restore?.y?.filter((m) => shape.metricCols.includes(m))
        || measures.filter((m) => shape.metricCols.includes(m));
      if (!nextMeasures.length) nextMeasures = shape.metricCols.slice(0, 1);
      const compat = chartCompatibility(currentQuery, data, nextMeasures[0]);
      // Distribution → histogramme ; en quittant ce mode, on laisse proposer un graphique adapté
      const wanted = restore?.type || (form.mode === 'distribution' ? 'histogram' : chartType === 'histogram' ? null : chartType);
      const type = compat[wanted]?.ok ? wanted : suggestChart(compat);
      if (type === 'kpi' && !restore) nextMeasures = shape.metricCols;
      if (restore?.options) {
        const view = restore.options.categoryMode === 'all' ? 'all' : restore.options.maxCategories === 10 ? 'top10' : 'top20';
        setCategoryView(view);
      }
      setMeasures(nextMeasures);
      setChartType(type);
      setResult(data);
      // Lancée depuis le bas du panneau, l'analyse s'affiche hors de l'écran : on y revient
      if (!restore) {
        requestAnimationFrame(() => {
          const el = resultsRef.current;
          if (el && el.getBoundingClientRect().top < 0) {
            const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
          }
        });
      }
      setExecuted({ datasetId, query: currentQuery, mode: form.mode, key: keyOf(datasetId, currentQuery) });
    } catch (err) {
      if (!isCanceled(err)) setRunError(errorMessage(err, "L'analyse n'a pas pu être calculée."));
    } finally {
      if (runController.current === ctrl) setRunning(false);
    }
  }, [currentQuery, errors, datasetId, measures, chartType, form.mode]);

  // Une analyse ouverte est recalculée dès que les colonnes de son dataset sont connues
  useEffect(() => {
    if (!pending.current || columnsState.datasetId !== datasetId || !columns.length) return;
    const { chart } = pending.current;
    pending.current = null;
    run(chart);
  }, [columnsState.datasetId, datasetId, columns, run]);

  const changeDataset = (id) => {
    runController.current?.abort();
    setDatasetId(id);
    setTimeNotice(null);
    setForm(emptyForm());
    setResult(null);
    setExecuted(null);
    setRunError(null);
    setSaved(null);
  };

  // Réinitialise la configuration (le dernier résultat reste affiché, signalé comme obsolète)
  const resetForm = () => {
    autoGranularity.current = null;
    setTimeNotice(null);
    setForm(emptyForm());
  };

  const newAnalysis = () => {
    setSearchParams({});
    setAnalysis(null);
    setForm(emptyForm());
    setResult(null);
    setExecuted(null);
    setSaved(null);
  };

  // 5. Graphique courant
  const metricCols = executed ? resultShape(executed.query).metricCols : [];
  const compat = executed && result ? chartCompatibility(executed.query, result, measures[0]) : {};
  const bins = parseInt(form.bins, 10);
  const view = CATEGORY_VIEWS.find((v) => v.id === categoryView) || {};
  const chart = executed
    ? buildChart(chartType, executed.query, measures, {
      bins: Number.isInteger(bins) && bins >= 2 && bins <= 50 ? bins : undefined,
      maxCategories: view.maxCategories,
      categoryMode: view.categoryMode,
    })
    : null;
  const datasetTitle = datasets?.find((d) => String(d.id) === String(executed?.datasetId ?? datasetId))?.title || '';

  // 6. Sauvegarde via l'API analyses de P4 : config = { query, chart }
  const save = async ({ title, description, visibility, asNew }) => {
    const body = { title, description: description || null, datasetId: Number(executed.datasetId), visibility, config: { query: executed.query, chart } };
    try {
      const out = analysis?.canEdit && !asNew ? await analysesApi.update(analysis.id, body) : await analysesApi.create(body);
      setAnalysis(out);
      setSaved({ id: out.id, title: out.title, updated: analysis?.canEdit && !asNew });
      setSaveOpen(false);
      setSearchParams({ analysisId: String(out.id) }, { replace: true });
    } catch (err) {
      throw new Error(errorMessage(err, "Impossible d'enregistrer l'analyse."));
    }
  };

  return (
    <main className="db-page an-page">
      <header className="an-page-head">
        <div className="an-page-titles">
          <span className="an-page-icon" aria-hidden="true"><IconAnalyze size={24} /></span>
          <div>
            <h1>Analyse des données</h1>
            <p className="an-page-lede">
              Choisissez des opérations, des regroupements et des filtres : VIZENTRA calcule le résultat sur les données réelles,
              sans écrire de SQL.
            </p>
          </div>
        </div>
        <div className="an-head-actions">
          {analysis && (
            <button type="button" className="an-btn an-btn-ghost" onClick={newAnalysis}><IconPlus /> Nouvelle analyse</button>
          )}
          <Link className="an-btn an-btn-ghost" to={ROUTES.myAnalyses}><IconFolder size={18} /> Mes analyses</Link>
        </div>
      </header>

      {analysis && (
        <p className="an-callout is-info an-open-banner">
          Analyse ouverte : <strong>{analysis.title}</strong>
          {!analysis.canEdit && <span> (lecture seule : partagée par {analysis.owner?.email}, enregistrez une copie pour la modifier)</span>}
        </p>
      )}
      {analysisError && <p className="an-alert" role="alert">{analysisError}</p>}
      {saved && (
        <div className="an-success" role="status">
          <p>
            Analyse « {saved.title} » {saved.updated ? 'mise à jour' : 'enregistrée'}. Elle est disponible pour les dashboards.
          </p>
          <div className="an-success-links">
            <Link to={ROUTES.myAnalyses}>Voir mes analyses</Link>
            <Link to={ROUTES.dashboards}>Ajouter à un dashboard</Link>
          </div>
        </div>
      )}

      <DatasetSelector
        datasets={datasets} loading={datasets === null && !datasetsError} error={datasetsError}
        onRetry={() => setReloadKey((k) => k + 1)} value={datasetId} onChange={changeDataset}
        columns={columns} columnsLoading={columnsState.loading} columnsError={columnsState.error} disabled={running}
        cardinality={cardinality} />

      <div className="an-layout">
        <AnalysisConfigPanel
          form={form} onChange={setForm} columns={columns} capabilities={capabilities} onRun={run} onReset={resetForm}
          running={running} errors={errors} dirty={stale} hasResult={!!result}
          cardinality={cardinality} timePoints={timePoints} timeNotice={timeNotice} onTimeField={chooseTimeField} />

        <div className="an-main" ref={resultsRef}>
          {runError && <p className="an-alert" role="alert">{runError}</p>}
          {running && !result && (
            <section className="an-card an-placeholder" aria-busy="true">
              <span className="an-spinner is-lg" aria-hidden="true" />
              <p role="status">Calcul de l'analyse…</p>
            </section>
          )}
          {!result && !running && (
            <section className="an-card an-placeholder">
              <div className="an-placeholder-art" aria-hidden="true">
                <span style={{ '--h': '42%' }} /><span style={{ '--h': '68%' }} /><span style={{ '--h': '54%' }} /><span style={{ '--h': '86%' }} />
              </div>
              <h2>Les résultats s'afficheront ici</h2>
              <ol className="an-howto">
                <li><b>1</b>Choisissez un dataset.</li>
                <li><b>2</b>Sélectionnez une opération (ex. Somme) et une colonne numérique.</li>
                <li><b>3</b>Regroupez par une colonne (ex. région) ou suivez une date.</li>
                <li><b>4</b>Cliquez sur « Exécuter l'analyse ».</li>
              </ol>
            </section>
          )}
          {result && chart && (
            <div className={running ? 'an-busy' : ''} aria-busy={running}>
              <AnalysisResults
                result={result} chart={chart} compat={compat} metricCols={metricCols}
                labels={columnLabels(executed.query)} timeCol={resultShape(executed.query).timeCol}
                measures={measures} onChartType={setChartType} onMeasures={setMeasures}
                onSave={() => setSaveOpen(true)} canSave={!stale && !running && result.rows.length > 0} stale={stale}
                title={defaultTitle(executed.query, executed.mode)}
                categoryView={categoryView} onCategoryView={setCategoryView} />
            </div>
          )}
        </div>
      </div>

      {executed && (
        <SaveAnalysisDialog
          open={saveOpen} onClose={() => setSaveOpen(false)} onSubmit={save} existing={analysis}
          defaultTitle={defaultTitle(executed.query, executed.mode)} chartType={chartType} datasetTitle={datasetTitle} />
      )}
    </main>
  );
}
