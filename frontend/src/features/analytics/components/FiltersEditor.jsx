import { IconPlus, IconTrash } from '../../../components/icons';
import { FILTER_LABELS, NO_VALUE_OPS, newFilter } from '../analysisModel';

// Opérateurs proposés selon le type de colonne (le backend les accepte tous)
const OPS_BY_TYPE = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'isnull', 'notnull'],
  date: ['eq', 'gte', 'lte', 'between', 'isnull', 'notnull'],
  text: ['eq', 'neq', 'in', 'contains', 'isnull', 'notnull'],
};

function ValueInputs({ filter, type, index, onChange }) {
  if (NO_VALUE_OPS.includes(filter.op)) return <span className="an-filter-novalue">Aucune valeur à saisir</span>;
  const inputType = type === 'date' ? 'date' : 'text';
  const inputMode = type === 'number' ? 'decimal' : undefined;
  if (filter.op === 'between') {
    return (
      <div className="an-filter-range">
        <input type={inputType} inputMode={inputMode} value={filter.value} aria-label={`Valeur minimale du filtre ${index}`}
          placeholder="min" onChange={(e) => onChange({ value: e.target.value })} />
        <span aria-hidden="true">et</span>
        <input type={inputType} inputMode={inputMode} value={filter.value2} aria-label={`Valeur maximale du filtre ${index}`}
          placeholder="max" onChange={(e) => onChange({ value2: e.target.value })} />
      </div>
    );
  }
  return (
    <input type={filter.op === 'in' ? 'text' : inputType} inputMode={inputMode} value={filter.value}
      aria-label={`Valeur du filtre ${index}`}
      placeholder={filter.op === 'in' ? 'Nord ; Sud' : 'Valeur'} onChange={(e) => onChange({ value: e.target.value })} />
  );
}

/** Section D : filtres { colonne, opérateur, valeur } appliqués avant l'agrégation. */
export default function FiltersEditor({ filters, columns, onChange, max = 20 }) {
  const types = Object.fromEntries(columns.map((c) => [c.name, c.type]));
  const update = (id, patch) => onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id) => onChange(filters.filter((f) => f.id !== id));

  return (
    <div className="an-filters">
      {filters.length === 0 && <p className="an-hint">Aucun filtre : toutes les lignes du dataset sont analysées.</p>}
      {filters.length > 0 && (
        <div className="an-filter-head" aria-hidden="true"><span>Colonne</span><span>Opérateur</span><span>Valeur</span><span /></div>
      )}
      {filters.map((f, i) => {
        const type = types[f.field] || 'text';
        const ops = OPS_BY_TYPE[type];
        return (
          <div key={f.id} className="an-filter-row" role="group" aria-label={`Filtre ${i + 1}`}>
            <select value={f.field} aria-label={`Colonne du filtre ${i + 1}`}
              onChange={(e) => {
                const nextOps = OPS_BY_TYPE[types[e.target.value] || 'text'];
                update(f.id, { field: e.target.value, op: nextOps.includes(f.op) ? f.op : 'eq', value: '', value2: '' });
              }}>
              {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <select value={f.op} aria-label={`Opérateur du filtre ${i + 1}`} onChange={(e) => update(f.id, { op: e.target.value })}>
              {ops.map((op) => <option key={op} value={op}>{FILTER_LABELS[op]}</option>)}
            </select>
            <ValueInputs filter={f} type={type} index={i + 1} onChange={(patch) => update(f.id, patch)} />
            <button type="button" className="an-icon-btn is-danger" onClick={() => remove(f.id)}
              aria-label={`Supprimer le filtre ${i + 1}`} title="Supprimer ce filtre">
              <IconTrash />
            </button>
          </div>
        );
      })}
      <button type="button" className="an-add-btn" disabled={!columns.length || filters.length >= max}
        onClick={() => onChange([...filters, newFilter(columns[0]?.name || '')])}>
        <IconPlus /> Ajouter un filtre
      </button>
      {filters.some((f) => f.op === 'in') && <p className="an-hint">« fait partie de » : séparez les valeurs par un point-virgule.</p>}
    </div>
  );
}
