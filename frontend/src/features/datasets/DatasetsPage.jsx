import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { datasetsApi } from './api/datasetsApi';
import { datasetError } from './datasetUtils';
import './datasets.css';

export default function DatasetsPage() {
  const [items, setItems] = useState([]); const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = () => { setLoading(true); datasetsApi.list(search).then(setItems).catch((e) => setError(datasetError(e))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [search]);
  const remove = async (item) => {
    if (!window.confirm(`Supprimer « ${item.title} » et toutes ses lignes ?`)) return;
    try { await datasetsApi.remove(item.id); load(); } catch (e) { setError(datasetError(e)); }
  };
  return <section className="container datasets-page">
    <div className="dataset-heading"><div><p className="dataset-eyebrow">EXPLORATION DES DONNÉES</p><h1>Mes datasets</h1><p>Importez et explorez vos jeux de données.</p></div><Link className="btn btn-primary" to="/datasets/import">＋ Importer un dataset</Link></div>
    <div className="dataset-toolbar"><input aria-label="Rechercher un dataset" placeholder="Rechercher par titre, description ou catégorie…" value={search} onChange={(e) => setSearch(e.target.value)} /><span>{items.length} dataset{items.length === 1 ? '' : 's'}</span></div>
    {error && <p className="alert alert-danger">{error}</p>}
    {loading ? <div className="card">Chargement des datasets…</div> : items.length === 0 ? <div className="card dataset-empty"><h2>Aucun dataset pour le moment</h2><p>Importez un fichier CSV ou JSON pour commencer l’exploration.</p><Link to="/datasets/import" className="btn btn-primary">Importer un fichier</Link></div> : <div className="dataset-cards">
      {items.map((d) => <article className="card dataset-card" key={d.id}>
        <div className="dataset-card-top"><span className="dataset-icon">▦</span><span className="badge badge-analyst">{d.file_format?.toUpperCase()}</span></div>
        <h2>{d.title}</h2><p className="dataset-description">{d.description || 'Aucune description.'}</p>
        <div className="dataset-tags">{d.category && <span>{d.category}</span>}<span>{d.row_count} lignes</span><span>{d.column_count} colonnes</span></div>
        <div className="dataset-quality"><div><span>Qualité des données</span><strong>{Number(d.profile?.qualityScore ?? 100)}%</strong></div><div className="quality-track"><i style={{ width: `${Number(d.profile?.qualityScore ?? 100)}%` }} /></div></div>
        <div className="dataset-card-actions"><Link to={`/datasets/${d.id}`} className="btn btn-primary btn-sm">Explorer</Link><button className="btn btn-secondary btn-sm" onClick={() => remove(d)}>Supprimer</button></div>
      </article>)}
    </div>}
  </section>;
}
