import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analysesApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import AnalysisCard from '../components/AnalysisCard';
import ShareDialog from '../components/ShareDialog';
import { ROUTES } from '../config';

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
      <header className="db-page-head">
        <div>
          <h1>Mes analyses</h1>
          <p className="db-muted">Les analyses enregistrées depuis la page Analyse. Ajoutez-les à un dashboard ou partagez-les.</p>
        </div>
        <Link className="db-btn is-primary" to={ROUTES.analysisNew}>Nouvelle analyse</Link>
      </header>
      <input type="search" className="db-search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher une analyse" aria-label="Rechercher une analyse" />
      {error && <p className="db-note" role="alert">{error}</p>}
      {data === null && !error && <p className="db-muted">Chargement…</p>}
      {data?.items.length === 0 && (
        <div className="db-empty">
          <p>{q ? 'Aucune analyse ne correspond à cette recherche.' : 'Vous n’avez pas encore enregistré d’analyse.'}</p>
          {!q && <Link className="db-btn is-primary" to={ROUTES.analysisNew}>Créer une analyse</Link>}
        </div>
      )}
      <ul className="db-list">
        {data?.items.map((a) => <AnalysisCard key={a.id} analysis={a} onShare={setSharing} onDelete={remove} />)}
      </ul>
      <ShareDialog open={!!sharing} onClose={() => setSharing(null)} kind="analysis" resource={sharing} onUpdated={replace} />
    </main>
  );
}
