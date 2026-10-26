import express, { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware.js';
import { logActivity } from '../admin/activity.service.js';
import { deleteDataset, getDataset, getPreview, importDataset, listDatasets, parseDataset, readRows, updateDataset } from './datasets.service.js';

const router = Router();
const asId = (raw: string) => /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
const userId = (req: Request) => req.user!.id;
const admin = (req: Request) => req.user!.role === 'admin';
const fail = (res: Response, status: number, message: string, code = 'DATASET_ERROR') => res.status(status).json({ success: false, error: { code, message } });
const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => {
  void fn(req, res).catch((error: unknown) => {
    console.error('[datasets]', error);
    fail(res, error instanceof SyntaxError ? 400 : 500, error instanceof SyntaxError ? 'Requête JSON invalide.' : 'Une erreur interne est survenue.');
  });
};

router.use(authenticateToken);

router.get('/', asyncRoute(async (req, res) => {
  const datasets = await listDatasets(userId(req), admin(req), String(req.query.q || '').slice(0, 200));
  return res.json({ success: true, data: { datasets } });
}));

router.post('/import', express.text({ type: () => true, limit: '15mb' }), asyncRoute(async (req, res) => {
  const { title, description, category, source, format } = req.query;
  const fileFormat = String(format || '').toLowerCase();
  const content = typeof req.body === 'string' ? req.body : '';
  let filename = String(req.headers['x-file-name'] || 'dataset.' + fileFormat);
  try { filename = decodeURIComponent(filename); } catch { return fail(res, 400, 'Nom de fichier invalide.'); }
  filename = filename.replace(/[\\/]/g, '_').slice(0, 255);
  if (!content) return fail(res, 400, 'Le fichier est vide.');
  if (!['csv', 'json'].includes(fileFormat)) return fail(res, 400, 'Formats acceptés : CSV et JSON.');
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 255) return fail(res, 400, 'Le titre est obligatoire (255 caractères maximum).');
  if (String(description || '').length > 5000 || String(category || '').length > 120 || String(source || '').length > 500) return fail(res, 400, 'Un champ de métadonnées dépasse sa longueur maximale.');
  let parsed;
  try { parsed = parseDataset(content, fileFormat as 'csv' | 'json'); }
  catch (error) { return fail(res, 400, error instanceof Error ? error.message : 'Fichier invalide.', 'INVALID_DATASET_FILE'); }
  const dataset = await importDataset(userId(req), {
    title: title.trim(), description: String(description || '').trim(), category: String(category || '').trim(),
    source: String(source || '').trim(), filename, format: fileFormat as 'csv' | 'json',
  }, parsed);
  await logActivity({ req, userId: userId(req), action: 'DATASET_IMPORT', entity: 'dataset', entity_id: String(dataset.id), details: { filename, format: fileFormat, rowCount: parsed.rows.length, columnCount: parsed.columns.length } });
  return res.status(201).json({ success: true, data: { dataset } });
}));

router.get('/:id/rows', asyncRoute(async (req, res) => {
  const id = asId(req.params.id); if (!id) return fail(res, 400, 'Identifiant invalide.');
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '25'), 10) || 25));
  let filters: Array<{ field: string; op: string; value?: unknown }> = [];
  try { filters = req.query.filters ? JSON.parse(String(req.query.filters)) : []; } catch { return fail(res, 400, 'Le paramètre filters doit être un tableau JSON.'); }
  if (!Array.isArray(filters) || filters.length > 20) return fail(res, 400, 'Filtres invalides (20 maximum).');
  const result = await readRows(id, userId(req), admin(req), {
    page, pageSize, search: String(req.query.search || '').slice(0, 200), sort: String(req.query.sort || '').slice(0, 128) || undefined,
    direction: String(req.query.direction || 'asc').toLowerCase(), filters,
  });
  if (!result) return fail(res, 404, 'Dataset introuvable.', 'DATASET_NOT_FOUND');
  return res.json({ success: true, data: { rows: result.rows, pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: Math.ceil(result.total / result.pageSize) } } });
}));

router.get('/:id/preview', asyncRoute(async (req, res) => {
  const id = asId(req.params.id); if (!id) return fail(res, 400, 'Identifiant invalide.');
  const result = await getPreview(id, userId(req), admin(req));
  if (!result) return fail(res, 404, 'Dataset introuvable.', 'DATASET_NOT_FOUND');
  return res.json({ success: true, data: result });
}));

router.get('/:id/profile', asyncRoute(async (req, res) => {
  const id = asId(req.params.id); if (!id) return fail(res, 400, 'Identifiant invalide.');
  const dataset = await getDataset(id, userId(req), admin(req));
  if (!dataset) return fail(res, 404, 'Dataset introuvable.', 'DATASET_NOT_FOUND');
  return res.json({ success: true, data: { columns: dataset.columns, profile: dataset.profile } });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const id = asId(req.params.id); if (!id) return fail(res, 400, 'Identifiant invalide.');
  const dataset = await getDataset(id, userId(req), admin(req));
  if (!dataset) return fail(res, 404, 'Dataset introuvable.', 'DATASET_NOT_FOUND');
  return res.json({ success: true, data: { dataset } });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
  const id = asId(req.params.id); if (!id) return fail(res, 400, 'Identifiant invalide.');
  const values = req.body || {};
  if (values.title !== undefined && (typeof values.title !== 'string' || !values.title.trim() || values.title.trim().length > 255)) return fail(res, 400, 'Titre invalide.');
  for (const [field, max] of [['description', 5000], ['category', 120], ['source', 500]] as const) {
    if (values[field] !== undefined && (typeof values[field] !== 'string' || values[field].length > max)) return fail(res, 400, `${field} invalide.`);
  }
  if (values.title) values.title = values.title.trim();
  const dataset = await updateDataset(id, userId(req), admin(req), values);
  if (!dataset) return fail(res, 404, 'Dataset introuvable.', 'DATASET_NOT_FOUND');
  await logActivity({ req, userId: userId(req), action: 'DATASET_UPDATE', entity: 'dataset', entity_id: String(id) });
  return res.json({ success: true, data: { dataset } });
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const id = asId(req.params.id); if (!id) return fail(res, 400, 'Identifiant invalide.');
  const deleted = await deleteDataset(id, userId(req), admin(req));
  if (!deleted) return fail(res, 404, 'Dataset introuvable.', 'DATASET_NOT_FOUND');
  await logActivity({ req, userId: userId(req), action: 'DATASET_DELETE', entity: 'dataset', entity_id: String(id) });
  return res.json({ success: true, message: 'Dataset supprimé.' });
}));

router.use((error: Error & { type?: string }, _req: Request, res: Response, next: (err?: unknown) => void) => {
  if (res.headersSent) return next(error);
  const tooLarge = error.type === 'entity.too.large';
  return fail(res, tooLarge ? 413 : 400, tooLarge ? 'Fichier trop volumineux (15 Mo maximum).' : 'Corps de requête invalide.', tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_REQUEST_BODY');
});

export default router;
