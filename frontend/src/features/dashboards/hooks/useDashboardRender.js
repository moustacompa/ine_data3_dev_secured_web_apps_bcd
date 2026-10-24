import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';

/**
 * Calcule les widgets d'un dashboard et recalcule quand `deps` ou les
 * filtres changent (avec un délai pour ne pas surcharger l'API pendant la
 * saisie). Les réponses obsolètes sont ignorées.
 *
 * @param {(filters: object) => Promise<{widgets: any[]}>} fetcher
 * @param {object} filters  valeurs des filtres globaux { [filterId]: valeur }
 * @param {string} key      clé qui change quand la structure du dashboard change
 */
export default function useDashboardRender(fetcher, filters, key, { delay = 300, enabled = true } = {}) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const filtersKey = JSON.stringify(filters || {});

  useEffect(() => {
    if (!enabled) return undefined;
    const current = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetcherRef.current(JSON.parse(filtersKey));
        if (current !== seq.current) return;
        setResults(Object.fromEntries(res.widgets.map((w) => [w.widgetId, w])));
        setError(null);
      } catch (err) {
        if (current === seq.current) setError(errorMessage(err, 'Impossible de calculer le dashboard.'));
      } finally {
        if (current === seq.current) setLoading(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [filtersKey, key, delay, enabled]);

  return { results, loading, error };
}

/** Clé de rendu : ne change que si les widgets ou les filtres définis changent. */
export function renderKey(dashboard) {
  if (!dashboard) return '';
  const widgets = (dashboard.layout || []).map(({ w, h, ...rest }) => rest);
  return JSON.stringify([widgets.sort((a, b) => a.id.localeCompare(b.id)), dashboard.globalFilters || []]);
}
