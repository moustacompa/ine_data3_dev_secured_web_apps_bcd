import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analysesApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import AnalysisCard from '../components/AnalysisCard';
import ShareDialog from '../components/ShareDialog';
import { ROUTES } from '../config';
import { IconFolder, IconPlus, IconSearch } from '../../../components/icons';

export default function MyAnalysesPage() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      analysesApi.list({ scope: 'mine', q: q || undefined })
        .then(setData).catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const replace = (a) => {
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === a.id ? { ...x, ...a } : x)) }));
    setSharing((s) => (s && s.id === a.id ? { ...s, ...a } : s));
  };

  const remove = async (a) => {
    if (!window.confirm(`Supprimer l’analyse « ${a.title} » ? Elle sera aussi retirée des dashboards qui l’utilisent.`)) return;
    try {
      await analysesApi.remove(a.id);
      setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== a.id), total: d.total - 1 }));
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <main className="db-page">
      <header className="db-page-head db-hero-head">
        <div className="db-head-titles">
          <span className="db-head-icon" aria-hidden="true"><IconFolder size={24} /></span>
          <div>
            <h1>Mes analyses</h1>
            <p className="db-muted">Les analyses enregistrées depuis la page Analyse. Ajoutez-les à un dashboard ou partagez-les.</p>
          </div>
        </div>
        <Link className="db-btn is-primary" to={ROUTES.analysisNew}><IconPlus /> Nouvelle analyse</Link>
      </header>
      <div className="db-list-toolbar">
        <label className="db-search-box">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une analyse" aria-label="Rechercher une analyse" />
        </label>
        {data && <p className="db-count">{data.items.length} analyse{data.items.length > 1 ? 's' : ''}</p>}
      </div>
      {error && <p className="db-note" role="alert">{error}</p>}
      {data === null && !error && <p className="db-muted" role="status">Chargement…</p>}
      {data?.items.length === 0 && (
        <div className="db-empty">
          <span className="db-empty-icon" aria-hidden="true"><IconFolder size={28} /></span>
          <p className="db-empty-title">{q ? 'Aucune analyse ne correspond à cette recherche.' : 'Vous n’avez pas encore enregistré d’analyse.'}</p>
          {!q && <p>Construisez une analyse en quelques clics, puis sauvegardez-la pour la retrouver ici.</p>}
          {!q && <Link className="db-btn is-primary" to={ROUTES.analysisNew}><IconPlus /> Créer une analyse</Link>}
        </div>
      )}
      <ul className="db-list">
        {data?.items.map((a) => <AnalysisCard key={a.id} analysis={a} onShare={setSharing} onDelete={remove} />)}
      </ul>
      <ShareDialog open={!!sharing} onClose={() => setSharing(null)} kind="analysis" resource={sharing} onUpdated={replace} />
    </main>
  );
}
