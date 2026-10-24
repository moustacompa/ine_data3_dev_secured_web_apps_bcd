import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analysesApi, dashboardsApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import AnalysisCard from '../components/AnalysisCard';
import { ROUTES, formatDate } from '../config';

export default function SharedWithMePage() {
  const [dashboards, setDashboards] = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([dashboardsApi.list({ scope: 'shared' }), analysesApi.list({ scope: 'shared' })])
      .then(([d, a]) => { setDashboards(d.items); setAnalyses(a.items); })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <main className="db-page">
      <header className="db-page-head">
        <div>
          <h1>Partagés avec moi</h1>
          <p className="db-muted">Les dashboards et analyses que d’autres personnes vous ont ouverts, en lecture seule.</p>
        </div>
      </header>
      {error && <p className="db-note" role="alert">{error}</p>}
      {dashboards === null && !error && <p className="db-muted">Chargement…</p>}

      {dashboards && (
        <section className="db-section" aria-labelledby="shared-dash">
          <h2 id="shared-dash">Dashboards</h2>
          {dashboards.length === 0 ? <p className="db-muted">Aucun dashboard partagé avec vous.</p> : (
            <ul className="db-list">
              {dashboards.map((d) => (
                <li key={d.id} className="db-list-item">
                  <div className="db-list-main">
                    <Link to={ROUTES.dashboard(d.id)}><strong>{d.title}</strong></Link>
                    {d.description && <p>{d.description}</p>}
                    <p className="db-meta">Partagé par {d.owner.email}, {d.widgetCount} widget{d.widgetCount > 1 ? 's' : ''}, mis à jour le {formatDate(d.updatedAt)}</p>
                  </div>
                  <div className="db-list-actions"><Link className="db-btn" to={ROUTES.dashboard(d.id)}>Ouvrir</Link></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {analyses && (
        <section className="db-section" aria-labelledby="shared-an">
          <h2 id="shared-an">Analyses</h2>
          {analyses.length === 0 ? <p className="db-muted">Aucune analyse partagée avec vous.</p> : (
            <>
              <p className="db-muted">Vous pouvez les ajouter à vos propres dashboards.</p>
              <ul className="db-list">{analyses.map((a) => <AnalysisCard key={a.id} analysis={a} />)}</ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
