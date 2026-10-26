// =============================================================================
// MODULE P3 (ANALYSE & VISUALISATION) - TYPES PARTAGÉS
// =============================================================================
// Le format de requête est le contrat déjà utilisé par P4 (queryEngine.js,
// colonne analyses.config.query). P3 ajoute uniquement l'option `rank`.
// =============================================================================

export const METRIC_OPS = ['sum', 'avg', 'min', 'max', 'count', 'count_distinct', 'median'] as const;
export const FILTER_OPS = ['eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'isnull', 'notnull'] as const;
export const GRANULARITIES = ['day', 'week', 'month', 'quarter', 'year'] as const;

export type MetricOp = (typeof METRIC_OPS)[number];
export type FilterOp = (typeof FILTER_OPS)[number];
export type Granularity = (typeof GRANULARITIES)[number];
export type ColumnType = 'number' | 'date' | 'text';

export interface Metric {
  op: MetricOp;
  field?: string;
  alias?: string;
}

export interface Filter {
  field: string;
  op: FilterOp;
  value?: unknown;
}

export interface TimeBucket {
  field: string;
  granularity?: Granularity;
  alias?: string;
}

export interface AnalyticsQuery {
  metrics?: Metric[];
  groupBy?: string[];
  timeBucket?: TimeBucket | null;
  filters?: Filter[];
  orderBy?: { field: string; dir?: 'asc' | 'desc' } | null;
  limit?: number;
  // [P3] Classement : ajoute les colonnes `rank` et `share_pct` (part du total en %)
  rank?: boolean;
}

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  filled: number; // nombre de valeurs non vides dans l'échantillon
}

export interface DatasetInfo {
  id: number;
  title: string;
  rowCount: number;
}

export type ResultRow = Record<string, string | number | null>;

export interface QueryResult {
  columns: string[];
  rows: ResultRow[];
}

// Utilisateur décodé par authenticateToken (P1)
export interface AnalyticsUser {
  id: string;
  role: string;
}
