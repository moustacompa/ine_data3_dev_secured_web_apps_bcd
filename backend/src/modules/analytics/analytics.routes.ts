import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware.js';
import { asyncHandler as h, analyticsErrorHandler } from './analytics.errors.js';
import { getCapabilities, listDatasets, listDatasetColumns, runAnalyticsQuery } from './analytics.controller.js';

const router = Router();

// Toutes les routes du module exigent un jeton JWT valide (middleware P1)
router.use(authenticateToken);

router.get('/capabilities', h(getCapabilities));
router.get('/datasets', h(listDatasets));
router.get('/datasets/:datasetId/columns', h(listDatasetColumns));
router.post('/query', h(runAnalyticsQuery)); // body : { datasetId, query: { metrics, groupBy, timeBucket, filters, orderBy, limit, rank } }

// Erreurs du module au format JSON de P1 (le serveur n'a pas de gestionnaire global)
router.use(analyticsErrorHandler);

export default router;
