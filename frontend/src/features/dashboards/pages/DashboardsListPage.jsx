import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardsApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import VisibilityBadge from '../components/VisibilityBadge';
import Modal from '../components/Modal';
import ShareDialog from '../components/ShareDialog';
import { ROUTES, formatDate } from '../config';
import { IconEye, IconLayout, IconPencil, IconPlus, IconSearch, IconShare, IconTrash } from '../../../components/icons';

export default function DashboardsListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(null);
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

  const replace = (d) => {
    setData((prev) => ({ ...prev, items: prev.items.map((x) => (x.id === d.id ? { ...x, ...d } : x)) }));
    setSharing((s) => (s && s.id === d.id ? { ...s, ...d } : s));
  };

  return (
    <main className="db-page">
      <header className="db-page-head db-hero-head">
        <div className="db-head-titles">
          <span className="db-head-icon" aria-hidden="true"><IconLayout size={24} /></span>
          <div>
            <h1>Mes dashboards</h1>
            <p className="db-muted">Regroupez vos analyses, ajoutez des filtres communs et partagez le résultat.</p>
          </div>
        </div>
        <button type="button" className="db-btn is-primary" onClick={() => setCreating(true)}><IconPlus /> Nouveau dashboard</button>
      </header>

      <div className="db-list-toolbar">
        <label className="db-search-box">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un dashboard" aria-label="Rechercher un dashboard" />
        </label>
        {data && <p className="db-count">{data.items.length} dashboard{data.items.length > 1 ? 's' : ''}</p>}
      </div>
      {error && <p className="db-note" role="alert">{error}</p>}
      {data === null && !error && <p className="db-muted" role="status">Chargement…</p>}

      {data?.items.length === 0 && (
        <div className="db-empty">
          <span className="db-empty-icon" aria-hidden="true"><IconLayout size={28} /></span>
          <p className="db-empty-title">{q ? 'Aucun dashboard ne correspond à cette recherche.' : 'Aucun dashboard pour le moment'}</p>
          {!q && <p>Créez votre premier dashboard pour assembler vos analyses enregistrées et les partager.</p>}
          {!q && <button type="button" className="db-btn is-primary" onClick={() => setCreating(true)}><IconPlus /> Nouveau dashboard</button>}
        </div>
      )}

      {!!data?.items.length && (
        <ul className="db-card-grid">
          {data.items.map((d) => (
            <li key={d.id} className="db-dash-card">
              <div className="db-dash-thumb" aria-hidden="true">
                <span style={{ '--h': '45%' }} /><span style={{ '--h': '72%' }} /><span style={{ '--h': '58%' }} /><span style={{ '--h': '88%' }} />
              </div>
              <div className="db-dash-body">
                <div className="db-dash-title">
                  <Link to={ROUTES.dashboard(d.id)}><strong>{d.title}</strong></Link>
                  <VisibilityBadge visibility={d.visibility} />
                </div>
                <p className="db-dash-desc">{d.description || 'Sans description'}</p>
                <p className="db-meta">
                  {d.widgetCount} widget{d.widgetCount > 1 ? 's' : ''} · modifié le {formatDate(d.updatedAt)}
                  {d.visibility === 'public' && ` · ${d.viewCount} vue${d.viewCount > 1 ? 's' : ''} publique${d.viewCount > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="db-dash-actions">
                <Link className="db-btn is-primary" to={ROUTES.dashboard(d.id)}><IconEye /> Consulter</Link>
                <Link className="db-btn" to={ROUTES.dashboardEdit(d.id)}><IconPencil /> Modifier</Link>
                <button type="button" className="db-btn" onClick={() => setSharing(d)}><IconShare size={18} /> Partager</button>
                <button type="button" className="db-icon-btn is-danger db-delete" onClick={() => remove(d)}
                  aria-label={`Supprimer ${d.title}`} title="Supprimer"><IconTrash /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
      <ShareDialog open={!!sharing} onClose={() => setSharing(null)} kind="dashboard" resource={sharing} onUpdated={replace} />
    </main>
  );
}
