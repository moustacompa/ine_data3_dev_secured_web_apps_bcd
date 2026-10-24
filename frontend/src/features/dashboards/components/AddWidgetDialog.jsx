import { useEffect, useState } from 'react';
import Modal from './Modal';
import OutlierView from './OutlierView';
import { analysesApi, outliersApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';

const CHART_LABELS = { bar: 'Barres', line: 'Courbe', pie: 'Secteurs', kpi: 'KPI', histogram: 'Histogramme', table: 'Tableau' };
const newId = () => Math.random().toString(36).slice(2, 10);

function AnalysisPicker({ onAdd }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      analysesApi.list({ scope: 'accessible', q: q || undefined, limit: 50 })
        .then((r) => setItems(r.items))
        .catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="db-stack">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une analyse"
        aria-label="Rechercher une analyse" />
      {error && <p className="db-note">{error}</p>}
      {items === null && !error && <p className="db-muted">Chargement…</p>}
      {items?.length === 0 && (
        <p className="db-muted">Aucune analyse. Créez-en une depuis la page Analyse, puis revenez ici.</p>
      )}
      <ul className="db-pick-list">
        {items?.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onAdd({ id: newId(), type: 'analysis', analysisId: a.id, w: a.config?.chart?.type === 'kpi' ? 1 : 2, h: a.config?.chart?.type === 'kpi' ? 1 : 2 })}>
              <strong>{a.title}</strong>
              <span>{CHART_LABELS[a.config?.chart?.type] || 'Tableau'} sur {a.datasetTitle || `dataset ${a.datasetId}`}
                {a.access === 'viewer' && `, partagée par ${a.owner.email}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutlierConfigurator({ onAdd }) {
  const [datasets, setDatasets] = useState([]);
  const [methods, setMethods] = useState([]);
  const [columns, setColumns] = useState([]);
  const [form, setForm] = useState({ datasetId: '', column: '', method: 'iqr', threshold: '' });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([outliersApi.datasets(), outliersApi.methods()])
      .then(([d, m]) => { setDatasets(d); setMethods(m); })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    setColumns([]);
    setPreview(null);
    if (!form.datasetId) return;
    outliersApi.columns(form.datasetId)
      .then((cols) => {
        const numeric = cols.filter((c) => c.type === 'number');
        setColumns(numeric);
        setForm((f) => ({ ...f, column: numeric[0]?.name || '' }));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [form.datasetId]);

  const method = methods.find((m) => m.id === form.method);
  const set = (k) => (e) => { setPreview(null); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const payload = () => ({
    datasetId: Number(form.datasetId), column: form.column, method: form.method,
    ...(form.threshold ? { threshold: Number(form.threshold) } : {}),
  });

  const runPreview = async () => {
    setBusy(true); setError(null);
    try { setPreview(await outliersApi.detect(payload())); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="db-stack">
      <p className="db-muted">Repère les valeurs anormalement éloignées du reste d’une colonne numérique. Le widget se met à jour avec les filtres du dashboard.</p>
      <div className="db-form-grid">
        <label>Dataset
          <select value={form.datasetId} onChange={set('datasetId')}>
            <option value="">Choisir un dataset</option>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.title || `Dataset ${d.id}`}</option>)}
          </select>
        </label>
        <label>Colonne numérique
          <select value={form.column} onChange={set('column')} disabled={!columns.length}>
            {!columns.length && <option value="">{form.datasetId ? 'Aucune colonne numérique' : '—'}</option>}
            {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label>Méthode
          <select value={form.method} onChange={set('method')}>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label>Seuil
          <input type="number" min="0.1" max="20" step="0.1" value={form.threshold} onChange={set('threshold')}
            placeholder={method ? String(method.defaultThreshold) : ''} />
        </label>
      </div>
      {error && <p className="db-note">{error}</p>}
      <div className="db-actions">
        <button type="button" className="db-btn" onClick={runPreview} disabled={!form.column || busy}>
          {busy ? 'Analyse…' : 'Prévisualiser'}
        </button>
        <button type="button" className="db-btn is-primary" disabled={!form.column}
          onClick={() => onAdd({ id: newId(), type: 'outliers', ...payload(), w: 2, h: 3 })}>
          Ajouter au dashboard
        </button>
      </div>
      {preview && <OutlierView data={preview} />}
    </div>
  );
}

export default function AddWidgetDialog({ open, onClose, onAdd }) {
  const [tab, setTab] = useState('analysis');
  const add = (w) => { onAdd(w); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Ajouter un widget" wide>
      <div className="db-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'analysis'} onClick={() => setTab('analysis')}>Analyse enregistrée</button>
        <button type="button" role="tab" aria-selected={tab === 'outliers'} onClick={() => setTab('outliers')}>Valeurs aberrantes</button>
      </div>
      {tab === 'analysis' ? <AnalysisPicker onAdd={add} /> : <OutlierConfigurator onAdd={add} />}
    </Modal>
  );
}
