import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import DashboardViewer from '../components/DashboardViewer';
import { formatDate } from '../config';

/** Vue publique accessible sans compte : /public/dashboards/:token */
export default function PublicDashboardPage() {
  const { token } = useParams();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicApi.get(token)
      .then((d) => { setDashboard(d); document.title = d.title; })
      .catch((err) => setError(errorMessage(err, "Ce dashboard n'existe pas ou n'est plus public.")));
  }, [token]);

  const fetcher = useCallback((f) => publicApi.render(token, f), [token]);
  const loadOptions = useCallback((filterId) => publicApi.filterOptions(token, filterId), [token]);

  if (error) {
    return (
      <main className="db-page db-public">
        <div className="db-empty">
          <p>{error}</p>
          <p className="db-muted">Le lien a peut-être été remplacé. Demandez-en un nouveau à la personne qui vous l’a envoyé.</p>
        </div>
      </main>
    );
  }
  if (!dashboard) return <main className="db-page db-public"><p className="db-muted">Chargement…</p></main>;

  return (
    <main className="db-page db-public">
      <header className="db-page-head">
        <div>
          <h1>{dashboard.title}</h1>
          {dashboard.description && <p className="db-lede">{dashboard.description}</p>}
          <p className="db-meta">Dashboard public, mis à jour le {formatDate(dashboard.updatedAt)}</p>
        </div>
      </header>
      <DashboardViewer dashboard={dashboard} fetcher={fetcher} loadOptions={loadOptions} />
    </main>
  );
}
