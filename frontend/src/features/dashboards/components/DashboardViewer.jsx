import { useMemo, useState } from 'react';
import DashboardGrid from './DashboardGrid';
import GlobalFiltersBar from './GlobalFiltersBar';
import useDashboardRender, { renderKey } from '../hooks/useDashboardRender';

/** Affichage en lecture seule, partagé par la vue connectée et la vue publique. */
export default function DashboardViewer({ dashboard, fetcher, loadOptions }) {
  const [filters, setFilters] = useState({});
  const key = useMemo(() => renderKey(dashboard), [dashboard]);
  const { results, loading, error } = useDashboardRender(fetcher, filters, key);

  return (
    <>
      <GlobalFiltersBar definitions={dashboard.globalFilters} values={filters} onChange={setFilters}
        loadOptions={loadOptions} loading={loading} />
      {error && <p className="db-note" role="alert">{error}</p>}
      {dashboard.layout?.length
        ? <DashboardGrid layout={dashboard.layout} results={results} loading={loading} />
        : <div className="db-empty"><p>Ce dashboard ne contient encore aucun widget.</p></div>}
    </>
  );
}
