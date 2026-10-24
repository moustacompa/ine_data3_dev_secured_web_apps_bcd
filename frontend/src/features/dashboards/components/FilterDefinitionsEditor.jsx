import { useState } from 'react';

const TYPES = [
  { id: 'select', label: 'Liste de valeurs' },
  { id: 'range', label: 'Plage de nombres' },
  { id: 'date-range', label: 'Période' },
];
const guessType = (col) => (col?.type === 'date' ? 'date-range' : col?.type === 'number' ? 'range' : 'select');

/**
 * Définit les filtres globaux du dashboard. Un filtre s'applique à tous les
 * widgets dont le dataset contient le champ choisi.
 */
export default function FilterDefinitionsEditor({ definitions = [], onChange, columns = [] }) {
  const [draft, setDraft] = useState({ label: '', field: '', type: 'select' });

  const pickField = (field) => {
    const col = columns.find((c) => c.name === field);
    setDraft((d) => ({ ...d, field, type: col ? guessType(col) : d.type, label: d.label || field }));
  };
  const add = (e) => {
    e.preventDefault();
    if (!draft.field.trim()) return;
    onChange([...definitions, {
      id: Math.random().toString(36).slice(2, 10),
      field: draft.field.trim(),
      label: draft.label.trim() || draft.field.trim(),
      type: draft.type,
    }]);
    setDraft({ label: '', field: '', type: 'select' });
  };

  return (
    <div className="db-stack">
      {definitions.length > 0 && (
        <ul className="db-filter-defs">
          {definitions.map((f) => (
            <li key={f.id}>
              <span><strong>{f.label}</strong> sur « {f.field} », {TYPES.find((t) => t.id === f.type)?.label.toLowerCase()}</span>
              <button type="button" className="db-link-btn" onClick={() => onChange(definitions.filter((x) => x.id !== f.id))}>Retirer</button>
            </li>
          ))}
        </ul>
      )}
      <form className="db-form-grid" onSubmit={add}>
        <label>Champ
          <input list="db-field-suggestions" value={draft.field} onChange={(e) => pickField(e.target.value)}
            placeholder="ex. region" required />
          <datalist id="db-field-suggestions">
            {columns.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
        </label>
        <label>Libellé affiché
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="ex. Région" />
        </label>
        <label>Type
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <div className="db-form-end"><button type="submit" className="db-btn">Ajouter le filtre</button></div>
      </form>
      {columns.length === 0 && <p className="db-muted">Ajoutez d’abord des widgets : leurs colonnes seront proposées ici.</p>}
    </div>
  );
}
