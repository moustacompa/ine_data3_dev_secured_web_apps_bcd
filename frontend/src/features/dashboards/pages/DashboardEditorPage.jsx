import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { dashboardsApi, outliersApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import DashboardGrid from '../components/DashboardGrid';
import GlobalFiltersBar from '../components/GlobalFiltersBar';
import FilterDefinitionsEditor from '../components/FilterDefinitionsEditor';
import AddWidgetDialog from '../components/AddWidgetDialog';
import ShareDialog from '../components/ShareDialog';
import VisibilityBadge from '../components/VisibilityBadge';
import Modal from '../components/Modal';
import useDashboardRender, { renderKey } from '../hooks/useDashboardRender';
import { ROUTES } from '../config';

const SAVE_DELAY = 800;
const EDITABLE_FIELDS = ['title', 'description', 'layout', 'globalFilters'];
const pick = (d) => Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, d[k]]));

/**
 * Éditeur : chaque modification est enregistrée automatiquement après un
 * court délai ; les widgets sont recalculés quand leur contenu change.
 */
export default function DashboardEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [dialog, setDialog] = useState(null); // 'add' | 'filters' | 'share'
  const [columns, setColumns] = useState([]);
  const lastSent = useRef(null);

  useEffect(() => {
    dashboardsApi.get(id)
      .then((d) => {
        if (!d.canEdit) { navigate(ROUTES.dashboard(id), { replace: true }); return; }
        setDraft(d); setSaved(d); lastSent.current = JSON.stringify(pick(d));
      })
      .catch((err) => setError(errorMessage(err, 'Dashboard introuvable.')));
  }, [id, navigate]);

  // Enregistrement automatique
  useEffect(() => {
    if (!draft) return undefined;
    const body = JSON.stringify(pick(draft));
    if (body === lastSent.current) return undefined;
    if (!draft.title?.trim()) { setSaveState('error'); setError('Le titre est obligatoire.'); return undefined; }
    setSaveState('pending');
    const t = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await dashboardsApi.update(id, JSON.parse(body));
        lastSent.current = body;
        setSaved(res);
        setSaveState('saved'); setError(null);
      } catch (err) {
        setSaveState('error'); setError(errorMessage(err, 'Les modifications n’ont pas été enregistrées.'));
      }
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [draft, id]);

  // Prévenir la perte de modifications à la fermeture de l'onglet
  useEffect(() => {
    const warn = (e) => { if (saveState === 'pending' || saveState === 'saving') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const fetcher = useCallback((f) => dashboardsApi.render(id, f), [id]);
  const key = useMemo(() => renderKey(saved), [saved]);
  const { results, loading, error: renderError } = useDashboardRender(fetcher, filters, key, { enabled: !!saved });

  // Colonnes proposées pour les filtres : celles des datasets utilisés
  const datasetIds = useMemo(
    () => [...new Set(Object.values(results).map((r) => r.datasetId).filter(Boolean))].sort().join(','),
    [results],
  );
  useEffect(() => {
    if (!datasetIds) { setColumns([]); return; }
    Promise.all(datasetIds.split(',').map((d) => outliersApi.columns(d).catch(() => [])))
      .then((lists) => {
        const byName = new Map();
        lists.flat().forEach((c) => { if (!byName.has(c.name)) byName.set(c.name, c); });
        setColumns([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)));
      });
  }, [datasetIds]);

  if (error && !draft) {
    return <main className="db-page"><p className="db-note">{error}</p><Link to={ROUTES.dashboards}>Retour à mes dashboards</Link></main>;
  }
  if (!draft) return <main className="db-page"><p className="db-muted">Chargement…</p></main>;

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));
  const statusText = {
    idle: '', pending: 'Modifications non enregistrées', saving: 'Enregistrement…', saved: 'Enregistré', error: 'Échec de l’enregistrement',
  }[saveState];

  return (
    <main className="db-page db-editor">
      <header className="db-page-head">
        <div className="db-title-block">
          <Link to={ROUTES.dashboards} className="db-back">Mes dashboards</Link>
          <input className="db-title-input" value={draft.title} maxLength={150} aria-label="Titre du dashboard"
            onChange={(e) => patch({ title: e.target.value })} />
          <textarea className="db-desc-input" rows={1} value={draft.description || ''} maxLength={2000}
            placeholder="Ajouter une description" aria-label="Description"
            onChange={(e) => patch({ description: e.target.value })} />
        </div>
        <div className="db-head-actions">
          <span className={`db-save is-${saveState}`} role="status">{statusText}</span>
          <VisibilityBadge visibility={saved.visibility} />
          <button type="button" className="db-btn" onClick={() => setDialog('share')}>Partager</button>
          <Link className="db-btn" to={ROUTES.dashboard(id)}>Aperçu</Link>
        </div>
      </header>

      <div className="db-toolbar">
        <button type="button" className="db-btn is-primary" onClick={() => setDialog('add')}>Ajouter un widget</button>
        <button type="button" className="db-btn" onClick={() => setDialog('filters')}>
          Filtres globaux{draft.globalFilters.length ? ` (${draft.globalFilters.length})` : ''}
        </button>
      </div>

      {error && <p className="db-note" role="alert">{error}</p>}
      {renderError && <p className="db-note" role="alert">{renderError}</p>}

      <GlobalFiltersBar definitions={saved.globalFilters} values={filters} onChange={setFilters} loading={loading}
        loadOptions={(filterId) => dashboardsApi.filterOptions(id, filterId)} />

      {draft.layout.length === 0 ? (
        <div className="db-empty">
          <p>Ce dashboard est vide. Ajoutez une analyse enregistrée ou un détecteur de valeurs aberrantes.</p>
          <button type="button" className="db-btn is-primary" onClick={() => setDialog('add')}>Ajouter un widget</button>
        </div>
      ) : (
        <>
          <p className="db-muted db-hint">Glissez les widgets pour les réordonner. Les modifications sont enregistrées automatiquement.</p>
          <DashboardGrid layout={draft.layout} results={results} loading={loading} editable
            onChange={(layout) => patch({ layout })} />
        </>
      )}

      <AddWidgetDialog open={dialog === 'add'} onClose={() => setDialog(null)}
        onAdd={(w) => setDraft((d) => ({ ...d, layout: [...d.layout, w] }))} />

      <Modal open={dialog === 'filters'} onClose={() => setDialog(null)} title="Filtres globaux" wide>
        <FilterDefinitionsEditor definitions={draft.globalFilters} columns={columns}
          onChange={(globalFilters) => { patch({ globalFilters }); setFilters({}); }} />
      </Modal>

      <ShareDialog open={dialog === 'share'} onClose={() => setDialog(null)} kind="dashboard" resource={saved}
        onUpdated={(d) => setSaved((s) => ({ ...s, ...d }))} />
    </main>
  );
}
