import { Request, Response } from 'express';
import { logActivity } from '../admin/activity.service.js';
import { validationError } from './analytics.errors.js';
import { parseDatasetId, validateQueryRequest } from './analytics.validation.js';
import { executeQuery, getColumns, getDatasets } from './analytics.service.js';
import { MAX_LIMIT, MAX_GROUP_BY, MAX_METRICS } from './query.builder.js';
import { AnalyticsUser, METRIC_OPS, FILTER_OPS, GRANULARITIES } from './analytics.types.js';

// req.user est garanti par authenticateToken (monté sur tout le routeur)
const currentUser = (req: Request): AnalyticsUser => ({ id: String(req.user!.id), role: req.user!.role });

function datasetIdParam(req: Request): number {
  const id = parseDatasetId(req.params.datasetId);
  if (id === null) throw validationError('Identifiant de dataset invalide.', [{ field: 'datasetId', message: 'Entier positif attendu.' }]);
  return id;
}

// 1. Opérations disponibles (utilisé par la page Analyse pour construire ses listes)
export const getCapabilities = async (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      metricOps: METRIC_OPS,
      filterOps: FILTER_OPS,
      granularities: GRANULARITIES,
      limits: { maxRows: MAX_LIMIT, maxMetrics: MAX_METRICS, maxGroupBy: MAX_GROUP_BY },
    },
  });
};

// 2. Datasets accessibles à l'utilisateur connecté
export const listDatasets = async (req: Request, res: Response) => {
  const data = await getDatasets(currentUser(req));
  return res.status(200).json({ success: true, data });
};

// 3. Colonnes et types d'un dataset
export const listDatasetColumns = async (req: Request, res: Response) => {
  const data = await getColumns(currentUser(req), datasetIdParam(req));
  return res.status(200).json({ success: true, data });
};

// 4. Exécution d'une analyse (SUM, AVG, MIN, MAX, COUNT, GROUP BY, classement, série temporelle)
export const runAnalyticsQuery = async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { datasetId, query } = validateQueryRequest(req.body);
  const data = await executeQuery(user, datasetId, query);

  // Traçabilité (P1) : sans attendre, une panne de journalisation ne bloque pas l'analyse
  void logActivity({
    req,
    userId: user.id,
    action: 'ANALYTICS_QUERY',
    entity: 'analytics',
    entity_id: String(datasetId),
    details: {
      queryType: query.rank ? 'ranking' : query.timeBucket ? 'timeseries' : (query.groupBy?.length ? 'group_by' : 'aggregate'),
      metrics: (query.metrics || []).map((m) => m.op),
      rowCount: data.meta.rowCount,
      executionTimeMs: data.meta.executionTimeMs,
    },
  });

  return res.status(200).json({ success: true, data });
};
