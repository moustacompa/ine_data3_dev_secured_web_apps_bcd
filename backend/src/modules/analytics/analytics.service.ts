// =============================================================================
// MODULE P3 - SERVICE D'ANALYSE
// =============================================================================
// - Endpoints REST (/api/analytics) : validation stricte + contrôle d'accès.
// - runQuery(datasetId, query) : moteur exposé au module P4, chargé par
//   dashboards/deps.js (PATHS.analyticsService). P4 vérifie lui-même l'accès
//   à l'analyse ou au dashboard avant de l'appeler.
// =============================================================================
import { datasetNotFound } from './analytics.errors.js';
import { buildAggregateQuery, mapRows } from './query.builder.js';
import { checkQueryColumns } from './analytics.validation.js';
import { findReadableDataset, listColumns, listReadableDatasets, runAnalyticsSql } from './analytics.repository.js';
import { AnalyticsQuery, AnalyticsUser, ColumnInfo, DatasetInfo, QueryResult } from './analytics.types.js';

export interface QueryResponse extends QueryResult {
  meta: { datasetId: number; rowCount: number; limit: number; truncated: boolean; executionTimeMs: number };
}

// 1. Datasets accessibles
export const getDatasets = (user: AnalyticsUser): Promise<DatasetInfo[]> => listReadableDatasets(user);

// 2. Dataset lisible, sinon 404 (même réponse pour inexistant et non autorisé)
export async function getReadableDataset(user: AnalyticsUser, datasetId: number): Promise<DatasetInfo> {
  const dataset = await findReadableDataset(user, datasetId);
  if (!dataset) throw datasetNotFound();
  return dataset;
}

// 3. Colonnes d'un dataset lisible
export async function getColumns(user: AnalyticsUser, datasetId: number): Promise<{ dataset: DatasetInfo; columns: ColumnInfo[] }> {
  const dataset = await getReadableDataset(user, datasetId);
  return { dataset, columns: await listColumns(datasetId) };
}

// 4. Requête d'analyse (POST /api/analytics/query)
export async function executeQuery(user: AnalyticsUser, datasetId: number, query: AnalyticsQuery): Promise<QueryResponse> {
  await getReadableDataset(user, datasetId);
  checkQueryColumns(query, await listColumns(datasetId));

  const started = Date.now();
  const built = buildAggregateQuery(datasetId, query, { probe: true });
  const rows = await runAnalyticsSql(built.text, built.params);
  const truncated = rows.length > built.limit;
  const result = mapRows(built, truncated ? rows.slice(0, built.limit) : rows);

  return {
    ...result,
    meta: {
      datasetId,
      rowCount: result.rows.length,
      limit: built.limit,
      truncated,
      executionTimeMs: Date.now() - started,
    },
  };
}

// 5. Moteur utilisé par P4 (analyses enregistrées, rendu des dashboards)
//    Même contrat et même résultat que dashboards/queryEngine.js.runQuery.
//    Pas de contrôle des colonnes ici : P4 applique des filtres globaux à
//    plusieurs datasets, une colonne absente doit donner un résultat vide
//    (comportement actuel de P4) et non une erreur.
//    Repli sur le moteur de P4 : ANALYTICS_P4_ENGINE=p4 dans .env.
async function runQueryForP4(datasetId: number, query: AnalyticsQuery = {}): Promise<QueryResult> {
  const built = buildAggregateQuery(Number(datasetId), query || {});
  return mapRows(built, await runAnalyticsSql(built.text, built.params));
}

export const runQuery = process.env.ANALYTICS_P4_ENGINE === 'p4' ? undefined : runQueryForP4;
