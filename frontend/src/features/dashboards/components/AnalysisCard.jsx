import { useState } from 'react';
import { Link } from 'react-router-dom';
import { analysesApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import ChartRenderer from './ChartRenderer';
import VisibilityBadge from './VisibilityBadge';
import { ROUTES, formatDate } from '../config';

const CHART_LABELS = { bar: 'Barres', line: 'Courbe', pie: 'Secteurs', kpi: 'KPI', histogram: 'Histogramme', table: 'Tableau' };

export default function AnalysisCard({ analysis, onShare, onDelete }) {
  const [preview, setPreview] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (preview) return;
    try { setPreview(await analysesApi.run(analysis.id)); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <li className="db-list-item db-analysis">
      <div className="db-list-main">
        <strong>{analysis.title}</strong>
        {analysis.description && <p>{analysis.description}</p>}
        <p className="db-meta">
          {CHART_LABELS[analysis.config?.chart?.type] || 'Tableau'} sur {analysis.datasetTitle || `dataset ${analysis.datasetId}`},
          {analysis.access === 'viewer' ? ` partagée par ${analysis.owner.email}` : ` modifiée le ${formatDate(analysis.updatedAt)}`}
        </p>
      </div>
      {analysis.canEdit && <VisibilityBadge visibility={analysis.visibility} />}
      <div className="db-list-actions">
        <button type="button" className="db-btn" onClick={toggle} aria-expanded={open}>{open ? 'Masquer' : 'Aperçu'}</button>
        {analysis.canEdit && <Link className="db-btn" to={ROUTES.analysisEdit(analysis.id)}>Modifier</Link>}
        {onShare && <button type="button" className="db-btn" onClick={() => onShare(analysis)}>Partager</button>}
        {onDelete && <button type="button" className="db-link-btn is-danger" onClick={() => onDelete(analysis)}>Supprimer</button>}
      </div>
      {open && (
        <div className="db-preview">
          {error && <p className="db-note">{error}</p>}
          {!preview && !error && <p className="db-muted">Calcul…</p>}
          {preview && <ChartRenderer result={preview} title={analysis.title} />}
        </div>
      )}
    </li>
  );
}
