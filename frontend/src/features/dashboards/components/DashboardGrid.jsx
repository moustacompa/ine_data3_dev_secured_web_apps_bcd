import { useEffect, useState } from 'react';
import ChartRenderer from './ChartRenderer';

const WIDTHS = [
  { w: 1, label: 'Un quart' }, { w: 2, label: 'Moitié' }, { w: 3, label: 'Trois quarts' }, { w: 4, label: 'Pleine largeur' },
];
const HEIGHTS = [{ h: 1, label: 'Basse' }, { h: 2, label: 'Moyenne' }, { h: 3, label: 'Haute' }];

function WidgetBody({ widget, result, loading }) {
  if (!result) return <p className="db-muted" role="status">{loading ? 'Calcul en cours…' : 'En attente de calcul.'}</p>;
  if (result.status === 'error') return <p className="db-note">{result.error}</p>;
  return <ChartRenderer result={result} title={widget.title || result.title} />;
}

/**
 * Grille de 4 colonnes. En mode édition : glisser-déposer pour réordonner,
 * réglage largeur/hauteur et suppression via le menu ⋯ (aussi utilisable au
 * clavier, y compris pour déplacer un widget avant ou après).
 */
export default function DashboardGrid({ layout = [], results = {}, loading, editable = false, onChange }) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  // Ferme les menus ⋯ ouverts quand on clique ailleurs
  useEffect(() => {
    if (!editable) return undefined;
    const close = (e) => document.querySelectorAll('.db-widget-menu[open]').forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [editable]);

  if (!layout.length) return null;

  const update = (id, patch) => onChange(layout.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const remove = (id) => onChange(layout.filter((w) => w.id !== id));
  const move = (from, to) => {
    if (to < 0 || to >= layout.length || from === to) return;
    const next = [...layout];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="db-grid">
      {layout.map((widget, index) => {
        const result = results[widget.id];
        const title = widget.title || result?.title || (widget.type === 'outliers' ? `Valeurs aberrantes : ${widget.column}` : 'Widget');
        const classes = ['db-widget', `w-${widget.w || 2}`, `h-${widget.h || 2}`];
        if (dragId === widget.id) classes.push('is-dragging');
        if (overId === widget.id && dragId !== widget.id) classes.push('is-over');
        if (widget.type === 'outliers') classes.push('is-outliers');

        return (
          <article key={widget.id} className={classes.join(' ')}
            draggable={editable}
            onDragStart={(e) => { setDragId(widget.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { if (editable && dragId) { e.preventDefault(); setOverId(widget.id); } }}
            onDragLeave={() => setOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              move(layout.findIndex((w) => w.id === dragId), index);
              setDragId(null); setOverId(null);
            }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}>
            <header className="db-widget-head">
              {editable ? (
                <input className="db-widget-title-input" value={widget.title ?? ''} placeholder={title}
                  aria-label="Titre du widget" onChange={(e) => update(widget.id, { title: e.target.value })} />
              ) : <h3>{title}</h3>}
              {editable && (
                <details className="db-widget-menu">
                  <summary className="db-icon-btn" aria-label={`Réglages du widget ${title}`}>⋯</summary>
                  <div className="db-widget-menu-pop">
                    <label>Largeur
                      <select value={widget.w || 2} onChange={(e) => update(widget.id, { w: Number(e.target.value) })}>
                        {WIDTHS.map((o) => <option key={o.w} value={o.w}>{o.label}</option>)}
                      </select>
                    </label>
                    <label>Hauteur
                      <select value={widget.h || 2} onChange={(e) => update(widget.id, { h: Number(e.target.value) })}>
                        {HEIGHTS.map((o) => <option key={o.h} value={o.h}>{o.label}</option>)}
                      </select>
                    </label>
                    <div className="db-widget-menu-row">
                      <button type="button" className="db-btn" onClick={() => move(index, index - 1)} disabled={index === 0}>Avant</button>
                      <button type="button" className="db-btn" onClick={() => move(index, index + 1)} disabled={index === layout.length - 1}>Après</button>
                    </div>
                    <button type="button" className="db-link-btn is-danger" onClick={() => remove(widget.id)}>Retirer du dashboard</button>
                  </div>
                </details>
              )}
            </header>
            <div className="db-widget-body">
              <WidgetBody widget={widget} result={result} loading={loading} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
