import client, { publicClient } from './client';

const data = (p) => p.then((r) => r.data);

// ------------------------------ Analyses ------------------------------
export const analysesApi = {
  list: (params) => data(client.get('/analyses', { params })),
  get: (id) => data(client.get(`/analyses/${id}`)),
  create: (body) => data(client.post('/analyses', body)),
  update: (id, body) => data(client.put(`/analyses/${id}`, body)),
  remove: (id) => client.delete(`/analyses/${id}`),
  run: (id, filters = []) => data(client.post(`/analyses/${id}/run`, { filters })),
  shares: (id) => data(client.get(`/analyses/${id}/shares`)),
  share: (id, email) => data(client.post(`/analyses/${id}/shares`, { email })),
  unshare: (id, userId) => data(client.delete(`/analyses/${id}/shares/${userId}`)),
};

// ----------------------------- Dashboards -----------------------------
export const dashboardsApi = {
  list: (params) => data(client.get('/dashboards', { params })),
  get: (id) => data(client.get(`/dashboards/${id}`)),
  create: (body) => data(client.post('/dashboards', body)),
  update: (id, body) => data(client.put(`/dashboards/${id}`, body)),
  remove: (id) => client.delete(`/dashboards/${id}`),
  render: (id, filters) => data(client.post(`/dashboards/${id}/render`, { filters })),
  filterOptions: (id, filterId) => data(client.get(`/dashboards/${id}/filters/${filterId}/options`)),
  regenerateToken: (id) => data(client.post(`/dashboards/${id}/public-token`)),
  shares: (id) => data(client.get(`/dashboards/${id}/shares`)),
  share: (id, email) => data(client.post(`/dashboards/${id}/shares`, { email })),
  unshare: (id, userId) => data(client.delete(`/dashboards/${id}/shares/${userId}`)),
  stats: () => data(client.get('/dashboards/stats')),
};

// --------------------------- Vue publique -----------------------------
export const publicApi = {
  get: (token) => data(publicClient.get(`/public/dashboards/${token}`)),
  render: (token, filters) => data(publicClient.post(`/public/dashboards/${token}/render`, { filters })),
  filterOptions: (token, filterId) => data(publicClient.get(`/public/dashboards/${token}/filters/${filterId}/options`)),
};

// ------------------------- Valeurs aberrantes -------------------------
export const outliersApi = {
  methods: () => data(client.get('/outliers/methods')),
  datasets: () => data(client.get('/outliers/datasets')),
  columns: (datasetId) => data(client.get(`/outliers/datasets/${datasetId}/columns`)),
  detect: (body) => data(client.post('/outliers', body)),
};

/** URL publique d'un dashboard (à partager). */
export const publicUrl = (token) => `${window.location.origin}/public/dashboards/${token}`;
