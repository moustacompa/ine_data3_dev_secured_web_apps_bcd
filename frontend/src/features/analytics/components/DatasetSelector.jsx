import { useState } from 'react';
import { IconDatabase } from '../../../components/icons';
import { HIGH_CARDINALITY } from '../analysisModel';

const TYPE_LABELS = { number: 'Nombre', date: 'Date', text: 'Texte' };
const TYPE_ORDER = ['number', 'date', 'text'];
const fmt = (n) => Number(n).toLocaleString('fr-FR');

/**
 * Zone 1 : dataset analysé, volumétrie et colonnes (types détectés par le
 * backend, nombre de valeurs distinctes quand il est connu).
 */
export default function DatasetSelector({
  datasets, loading, error, onRetry, value, onChange, columns, columnsLoading, columnsError, disabled, cardinality,
}) {
  const [showColumns, setShowColumns] = useState(false);
  const selected = datasets?.find((d) => String(d.id) === String(value));
  const byType = TYPE_ORDER.map((t) => [t, columns.filter((c) => c.type === t).length]).filter(([, n]) => n > 0);

  return (
    <section className="an-card an-dataset" aria-labelledby="an-dataset-title">
      <div className="an-dataset-main">
        <span className="an-dataset-icon" aria-hidden="true"><IconDatabase size={22} /></span>
        <div className="an-dataset-id">
          <p className="an-eyebrow" id="an-dataset-title">Données analysées</p>
          <p className="an-dataset-name">{selected ? selected.title || `Dataset ${selected.id}` : 'Aucun dataset sélectionné'}</p>
        </div>

        {selected && !!columns.length && (
          <dl className="an-dataset-stats">
            <div><dt>Lignes</dt><dd>{fmt(selected.rowCount)}</dd></div>
            <div><dt>Colonnes</dt><dd>{columns.length}</dd></div>
            {byType.map(([t, n]) => (
              <div key={t}><dt>{TYPE_LABELS[t]}</dt><dd><span className={`an-type-dot is-${t}`} aria-hidden="true" />{n}</dd></div>
            ))}
          </dl>
        )}

        <div className="an-dataset-actions">
          {!!datasets?.length && (
            <label className="an-field an-dataset-select">
              <span>{selected ? 'Changer de dataset' : 'Choisir un dataset'}</span>
              <select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
                <option value="">Sélectionner…</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>{d.title || `Dataset ${d.id}`} ({fmt(d.rowCount)} lignes)</option>
                ))}
              </select>
            </label>
          )}
          {selected && !!columns.length && (
            <button type="button" className="an-btn an-btn-ghost an-btn-sm" aria-expanded={showColumns}
              aria-controls="an-column-list" onClick={() => setShowColumns((s) => !s)}>
              {showColumns ? 'Masquer les colonnes' : 'Voir les colonnes'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="an-alert" role="alert">
          <p>{error}</p>
          {onRetry && <button type="button" className="an-btn an-btn-ghost an-btn-sm" onClick={onRetry}>Réessayer</button>}
        </div>
      )}
      {loading && <p className="an-hint" role="status">Chargement des datasets…</p>}
      {!loading && !error && datasets?.length === 0 && (
        <p className="an-hint">Aucun dataset accessible. Importez un fichier (module P2) ou demandez un accès à son propriétaire.</p>
      )}
      {selected && columnsLoading && <p className="an-hint" role="status">Lecture des colonnes…</p>}
      {selected && columnsError && <p className="an-error" role="alert">{columnsError}</p>}
      {selected && !columnsLoading && !columnsError && columns.length === 0 && (
        <p className="an-hint">Ce dataset ne contient encore aucune ligne exploitable.</p>
      )}

      {showColumns && !!columns.length && (
        <ul id="an-column-list" className="an-column-list" aria-label="Colonnes du dataset">
          {columns.map((c) => {
            const distinct = cardinality?.[c.name];
            return (
              <li key={c.name}>
                <span className={`an-type is-${c.type}`}>{TYPE_LABELS[c.type] || c.type}</span>
                <span className="an-column-name">{c.name}</span>
                {distinct !== undefined && (
                  <span className={`an-column-card${distinct > HIGH_CARDINALITY ? ' is-high' : ''}`}>
                    {fmt(distinct)} valeur{distinct > 1 ? 's' : ''} distincte{distinct > 1 ? 's' : ''}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
