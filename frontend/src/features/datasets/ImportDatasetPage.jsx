import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { datasetsApi } from './api/datasetsApi';
import { datasetError } from './datasetUtils';
import './datasets.css';

export default function ImportDatasetPage() {
  const navigate = useNavigate(); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!file) { setError('Choisissez un fichier CSV ou JSON.'); return; }
    if (!/\.(csv|json)$/i.test(file.name)) { setError('Seuls les fichiers CSV et JSON sont pris en charge.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('Le fichier doit faire moins de 15 Mo.'); return; }
    const form = new FormData(event.currentTarget); setBusy(true);
    try {
      const dataset = await datasetsApi.import({ file, title: form.get('title'), description: form.get('description'), category: form.get('category'), source: form.get('source') });
      navigate(`/datasets/${dataset.id}`, { state: { imported: true } });
    } catch (e) { setError(datasetError(e)); } finally { setBusy(false); }
  };
  return <section className="container datasets-page import-page">
    <Link to="/datasets" className="dataset-back">← Tous les datasets</Link><div className="dataset-heading"><div><p className="dataset-eyebrow">NOUVELLES DONNÉES</p><h1>Importer un dataset</h1><p>Ajoutez un fichier pour le profiler et l’explorer.</p></div></div>
    <form className="card import-form" onSubmit={submit}>
      {error && <p className="alert alert-danger">{error}</p>}
      <label>Titre <em>*</em><input name="title" required maxLength="255" placeholder="Ex. Ventes du premier trimestre" /></label>
      <label>Description<textarea name="description" rows="3" maxLength="5000" placeholder="Décrivez le contenu du dataset" /></label>
      <div className="import-fields"><label>Catégorie<input name="category" maxLength="120" placeholder="Ex. Ventes, transport, énergie" /></label><label>Source des données<input name="source" maxLength="500" placeholder="Ex. Export CRM, portail Open Data" /></label></div>
      <label className="file-drop"><span className="file-symbol">⇧</span><strong>{file ? file.name : 'Choisir un fichier CSV ou JSON'}</strong><span>CSV avec en-têtes ou tableau JSON d’objets · 15 Mo maximum</span><input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      <div className="import-actions"><Link to="/datasets" className="btn btn-secondary">Annuler</Link><button className="btn btn-primary" disabled={busy}>{busy ? 'Import en cours…' : 'Importer et profiler'}</button></div>
    </form>
  </section>;
}
