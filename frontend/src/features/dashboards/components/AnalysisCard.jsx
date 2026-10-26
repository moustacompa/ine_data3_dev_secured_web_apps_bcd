import { useState } from 'react';
import { Link } from 'react-router-dom';
import { analysesApi } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';
import ChartRenderer from './ChartRenderer';
import VisibilityBadge from './VisibilityBadge';
import { ROUTES, formatDate } from '../config';
import {
  IconChartBar, IconChartHistogram, IconChartKpi, IconChartLine, IconChartPie, IconChartTable, IconDatabase, IconEye,
  IconPencil, IconShare, IconTrash,
} from '../../../components/icons';

const CHART_LABELS = { bar: 'Barres', line: 'Courbe', pie: 'Secteurs', kpi: 'KPI', histogram: 'Histogramme', table: 'Tableau' };
const CHART_ICONS = { bar: IconChartBar, line: IconChartLine, pie: IconChartPie, kpi: IconChartKpi, histogram: IconChartHistogram, table: IconChartTable };

export default function AnalysisCard({ analysis, onShare, onDelete }) {
  const [preview, setPreview] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const type = CHART_LABELS[analysis.config?.chart?.type] ? analysis.config.chart.type : 'table';
  const TypeIcon = CHART_ICONS[type];

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (preview) return;
    try { setPreview(await analysesApi.run(analysis.id)); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <li className="db-list-item db-analysis">
      <span className={`db-analysis-icon is-${type}`} aria-hidden="true"><TypeIcon size={22} /></span>
      <div className="db-list-main">
        <div className="db-analysis-title">
          <strong>{analysis.title}</strong>
          {analysis.canEdit && <VisibilityBadge visibility={analysis.visibility} />}
        </div>
        {analysis.description && <p>{analysis.description}</p>}
        <ul className="db-facts">
          <li><TypeIcon size={14} />{CHART_LABELS[type]}</li>
          <li><IconDatabase size={14} />{analysis.datasetTitle || `Dataset ${analysis.datasetId}`}</li>
          <li>{analysis.access === 'viewer' ? `Partagée par ${analysis.owner.email}` : `Modifiée le ${formatDate(analysis.updatedAt)}`}</li>
        </ul>
      </div>
      <div className="db-list-actions">
        <button type="button" className="db-btn" onClick={toggle} aria-expanded={open}><IconEye /> {open ? 'Masquer' : 'Consulter'}</button>
        {analysis.canEdit && <Link className="db-btn is-primary" to={ROUTES.analysisEdit(analysis.id)}><IconPencil /> Modifier</Link>}
        {onShare && <button type="button" className="db-btn" onClick={() => onShare(analysis)}><IconShare size={18} /> Partager</button>}
        {onDelete && (
          <button type="button" className="db-icon-btn is-danger db-delete" onClick={() => onDelete(analysis)}
            aria-label={`Supprimer ${analysis.title}`} title="Supprimer"><IconTrash /></button>
        )}
      </div>
      {open && (
        <div className="db-preview">
          {error && <p className="db-note">{error}</p>}
          {!preview && !error && <p className="db-muted" role="status">Calcul…</p>}
          {preview && <ChartRenderer result={preview} title={analysis.title} />}
        </div>
      )}
    </li>
  );
}
