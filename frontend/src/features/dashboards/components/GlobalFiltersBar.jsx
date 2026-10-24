import { useEffect, useState } from 'react';

function SelectFilter({ def, value = [], onChange, loadOptions }) {
  const [options, setOptions] = useState(null);
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);
  const selected = Array.isArray(value) ? value : [];

  const load = async (e) => {
    if (!e.currentTarget.open || options) return;
    try {
      const res = await loadOptions(def.id);
      setOptions(res.values || []);
    } catch {
      setFailed(true);
      setOptions([]);
    }
  };

  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const visible = (options || []).filter((o) => String(o).toLowerCase().includes(query.toLowerCase()));
  const summary = selected.length === 0 ? 'Tous' : selected.length <= 2 ? selected.join(', ') : `${selected.length} valeurs`;

  return (
    <details className="db-filter db-filter-select" onToggle={load}>
      <summary>
        <span className="db-filter-label">{def.label}</span>
        <span className={selected.length ? 'db-filter-value is-set' : 'db-filter-value'}>{summary}</span>
      </summary>
      <div className="db-filter-pop">
        {options === null && <p className="db-muted">Chargement des valeurs…</p>}
        {failed && <p className="db-note">Les valeurs n’ont pas pu être chargées.</p>}
        {options && options.length > 8 && (
          <input type="search" placeholder="Rechercher une valeur" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label={`Rechercher dans ${def.label}`} />
        )}
        <ul>
          {visible.map((o) => (
            <li key={o}>
              <label><input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} /> {o}</label>
            </li>
          ))}
        </ul>
        {selected.length > 0 && (
          <button type="button" className="db-link-btn" onClick={() => onChange([])}>Tout afficher</button>
        )}
      </div>
    </details>
  );
}

function RangeFilter({ def, value = {}, onChange, kind }) {
  const [a, b] = kind === 'date' ? ['from', 'to'] : ['min', 'max'];
  const type = kind === 'date' ? 'date' : 'number';
  return (
    <fieldset className="db-filter db-filter-range">
      <legend className="db-filter-label">{def.label}</legend>
      <input type={type} value={value[a] ?? ''} aria-label={`${def.label} : début`}
        onChange={(e) => onChange({ ...value, [a]: e.target.value })} />
      <span aria-hidden="true">à</span>
      <input type={type} value={value[b] ?? ''} aria-label={`${def.label} : fin`}
        onChange={(e) => onChange({ ...value, [b]: e.target.value })} />
    </fieldset>
  );
}

/**
 * Barre de filtres globaux d'un dashboard.
 * Les valeurs sont envoyées telles quelles à l'API ({ [filterId]: valeur }).
 */
export default function GlobalFiltersBar({ definitions = [], values, onChange, loadOptions, loading }) {
  // Ferme la liste ouverte au clic extérieur ou avec Échap
  useEffect(() => {
    const closeAll = (keep) => document.querySelectorAll('.db-filter-select[open]').forEach((d) => {
      if (!keep || !d.contains(keep)) d.removeAttribute('open');
    });
    const onClick = (e) => closeAll(e.target);
    const onKey = (e) => { if (e.key === 'Escape') closeAll(null); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  if (!definitions.length) return null;
  const set = (id, v) => onChange({ ...values, [id]: v });
  const active = Object.values(values || {}).some((v) =>
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.values(v).some(Boolean) : v);

  return (
    <section className="db-filters" aria-label="Filtres du dashboard">
      {definitions.map((def) => {
        if (def.type === 'select') {
          return <SelectFilter key={def.id} def={def} value={values?.[def.id]} onChange={(v) => set(def.id, v)} loadOptions={loadOptions} />;
        }
        return (
          <RangeFilter key={def.id} def={def} value={values?.[def.id]} onChange={(v) => set(def.id, v)}
            kind={def.type === 'date-range' ? 'date' : 'number'} />
        );
      })}
      <div className="db-filters-end">
        {loading && <span className="db-muted" role="status">Mise à jour…</span>}
        {active && <button type="button" className="db-link-btn" onClick={() => onChange({})}>Réinitialiser les filtres</button>}
      </div>
    </section>
  );
}
