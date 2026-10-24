import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dashboardsApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import DashboardViewer from '../components/DashboardViewer';
import VisibilityBadge from '../components/VisibilityBadge';
import ShareDialog from '../components/ShareDialog';
import { ROUTES, formatDate } from '../config';

export default function DashboardViewPage() {
  const { id } = useParams();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    dashboardsApi.get(id).then(setDashboard).catch((err) => setError(errorMessage(err, 'Dashboard introuvable.')));
  }, [id]);

  const fetcher = useCallback((f) => dashboardsApi.render(id, f), [id]);
  const loadOptions = useCallback((filterId) => dashboardsApi.filterOptions(id, filterId), [id]);

  if (error) return <main className="db-page"><p className="db-note">{error}</p><Link to={ROUTES.dashboards}>Retour à mes dashboards</Link></main>;
  if (!dashboard) return <main className="db-page"><p className="db-muted">Chargement…</p></main>;

  return (
    <main className="db-page">
      <header className="db-page-head">
        <div>
          <Link to={dashboard.canEdit ? ROUTES.dashboards : ROUTES.sharedWithMe} className="db-back">
            {dashboard.canEdit ? 'Mes dashboards' : 'Partagés avec moi'}
          </Link>
          <h1>{dashboard.title}</h1>
          {dashboard.description && <p className="db-lede">{dashboard.description}</p>}
          <p className="db-meta">
            {dashboard.access === 'viewer' ? `Partagé par ${dashboard.owner.email}, ` : ''}mis à jour le {formatDate(dashboard.updatedAt)}
          </p>
        </div>
        <div className="db-head-actions">
          <VisibilityBadge visibility={dashboard.visibility} />
          {dashboard.canEdit && (
            <>
              <button type="button" className="db-btn" onClick={() => setSharing(true)}>Partager</button>
              <Link className="db-btn is-primary" to={ROUTES.dashboardEdit(id)}>Modifier</Link>
            </>
          )}
        </div>
      </header>
      <DashboardViewer dashboard={dashboard} fetcher={fetcher} loadOptions={loadOptions} />
      {dashboard.canEdit && (
        <ShareDialog open={sharing} onClose={() => setSharing(false)} kind="dashboard" resource={dashboard}
          onUpdated={(d) => setDashboard((s) => ({ ...s, ...d }))} />
      )}
    </main>
  );
}
