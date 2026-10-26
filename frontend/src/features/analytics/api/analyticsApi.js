import { api } from '../../../services/api';

/**
 * API Analytics (P3), via le client Axios partagé de P1 : il ajoute le jeton
 * JWT et redirige vers /login en cas de 401. Les réponses ont la forme
 * { success: true, data } : on renvoie directement `data`.
 * `signal` (AbortController) permet d'annuler une requête devenue inutile.
 */
const unwrap = (p) => p.then((r) => r.data.data);

export const analyticsApi = {
  // { metricOps, filterOps, granularities, limits: { maxRows, maxMetrics, maxGroupBy } }
  capabilities: (signal) => unwrap(api.get('/analytics/capabilities', { signal })),
  // [{ id, title, rowCount }]
  datasets: (signal) => unwrap(api.get('/analytics/datasets', { signal })),
  // { dataset: { id, title, rowCount }, columns: [{ name, type: 'number'|'date'|'text', filled }] }
  columns: (datasetId, signal) => unwrap(api.get(`/analytics/datasets/${datasetId}/columns`, { signal })),
  // { columns, rows, meta: { datasetId, rowCount, limit, truncated, executionTimeMs } }
  query: (datasetId, query, signal) => unwrap(api.post('/analytics/query', { datasetId, query }, { signal })),
};

export const isCanceled = (err) => err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';

export default analyticsApi;
