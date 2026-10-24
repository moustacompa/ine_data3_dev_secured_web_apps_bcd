import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardsApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import VisibilityBadge from '../components/VisibilityBadge';
import Modal from '../components/Modal';
import { ROUTES, formatDate } from '../config';

export default function DashboardsListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });

  useEffect(() => {
    const t = setTimeout(() => {
      dashboardsApi.list({ scope: 'mine', q: q || undefined })
        .then(setData).catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const d = await dashboardsApi.create(form);
      navigate(ROUTES.dashboardEdit(d.id));
    } catch (err) { setError(errorMessage(err)); }
  };

  const remove = async (d) => {
    if (!window.confirm(`Supprimer le dashboard « ${d.title} » ? Les liens partagés cesseront de fonctionner.`)) return;
    try {
      await dashboardsApi.remove(d.id);
      setData((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== d.id), total: prev.total - 1 }));
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <main className="db-page">
      <header className="db-page-head">
        <div>
          <h1>Mes dashboards</h1>
          <p className="db-muted">Regroupez vos analyses, ajoutez des filtres communs et partagez le résultat.</p>
        </div>
        <button type="button" className="db-btn is-primary" onClick={() => setCreating(true)}>Nouveau dashboard</button>
      </header>

      <input type="search" className="db-search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un dashboard" aria-label="Rechercher un dashboard" />
      {error && <p className="db-note" role="alert">{error}</p>}
      {data === null && !error && <p className="db-muted">Chargement…</p>}

      {data?.items.length === 0 && (
        <div className="db-empty">
          <p>{q ? 'Aucun dashboard ne correspond à cette recherche.' : 'Créez votre premier dashboard pour assembler vos analyses.'}</p>
          {!q && <button type="button" className="db-btn is-primary" onClick={() => setCreating(true)}>Nouveau dashboard</button>}
        </div>
      )}

      <ul className="db-list">
        {data?.items.map((d) => (
          <li key={d.id} className="db-list-item">
            <div className="db-list-main">
              <Link to={ROUTES.dashboard(d.id)}><strong>{d.title}</strong></Link>
              {d.description && <p>{d.description}</p>}
              <p className="db-meta">
                {d.widgetCount} widget{d.widgetCount > 1 ? 's' : ''}, modifié le {formatDate(d.updatedAt)}
                {d.visibility === 'public' && `, ${d.viewCount} vue${d.viewCount > 1 ? 's' : ''} publique${d.viewCount > 1 ? 's' : ''}`}
              </p>
            </div>
            <VisibilityBadge visibility={d.visibility} />
            <div className="db-list-actions">
              <Link className="db-btn" to={ROUTES.dashboardEdit(d.id)}>Modifier</Link>
              <button type="button" className="db-link-btn is-danger" onClick={() => remove(d)}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau dashboard">
        <form className="db-stack" onSubmit={create}>
          <label>Titre
            <input required maxLength={150} value={form.title} autoFocus
              onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex. Suivi des ventes 2024" />
          </label>
          <label>Description <span className="db-muted">(facultatif)</span>
            <textarea rows={3} maxLength={2000} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="db-actions"><button type="submit" className="db-btn is-primary">Créer et ajouter des widgets</button></div>
        </form>
      </Modal>
    </main>
  );
}
