import { api } from '../../../services/api';

export const datasetsApi = {
  list: (q = '') => api.get('/datasets', { params: q ? { q } : {} }).then((r) => r.data.data.datasets),
  get: (id) => api.get(`/datasets/${id}`).then((r) => r.data.data.dataset),
  import: async ({ file, ...metadata }) => {
    const params = new URLSearchParams({
      title: metadata.title,
      description: metadata.description || '',
      category: metadata.category || '',
      source: metadata.source || '',
      format: file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv',
    });
    const content = await file.text();
    return api.post(`/datasets/import?${params}`, content, {
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
      transformRequest: [(data) => data],
      maxBodyLength: 15 * 1024 * 1024,
    }).then((r) => r.data.data.dataset);
  },
  update: (id, values) => api.patch(`/datasets/${id}`, values).then((r) => r.data.data.dataset),
  remove: (id) => api.delete(`/datasets/${id}`),
  rows: (id, options) => api.get(`/datasets/${id}/rows`, { params: options }).then((r) => r.data.data),
  preview: (id) => api.get(`/datasets/${id}/preview`).then((r) => r.data.data),
  profile: (id) => api.get(`/datasets/${id}/profile`).then((r) => r.data.data),
};
