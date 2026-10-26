// =============================================================================
// MODULE P3 - ACCÈS AUX DATASETS (SEUL POINT DE CONTACT AVEC LES TABLES DE P2)
// =============================================================================
// Tables utilisées (schéma P2, backend/database/020_datasets_placeholder.sql) :
//   datasets(id, user_id, title, columns JSONB, ...)   dataset_rows(id, dataset_id, data JSONB)
// Les noms de colonnes se règlent avec les mêmes variables d'environnement que
// le module P4 (P4_DATASET_OWNER_COL, P4_DATASET_TITLE_COL, P4_ROWS_DATA_COL).
// Les types de colonnes viennent des métadonnées de l'import P2 (datasets.columns)
// quand elles existent, sinon d'une détection sur un échantillon des lignes.
// =============================================================================
import { pool } from '../../config/db.js';
import { ISO_DATE_RE, NUMERIC_RE } from './query.builder.js';
import { AnalyticsUser, ColumnInfo, ColumnType, DatasetInfo } from './analytics.types.js';

const identifier = (value: string | undefined, fallback: string) => {
  const v = value || fallback;
  if (!/^[a-z_][a-z0-9_]*$/i.test(v)) throw new Error(`Identifiant SQL invalide : ${v}`);
  return v;
};

const OWNER_COL = identifier(process.env.P4_DATASET_OWNER_COL, 'user_id');
const TITLE_COL = identifier(process.env.P4_DATASET_TITLE_COL, 'title');
const DATA_COL = identifier(process.env.P4_ROWS_DATA_COL, 'data');

const COLUMN_SAMPLE_SIZE = 1000;
const TYPE_THRESHOLD = 0.9; // 90 % des valeurs non vides doivent être du type détecté
const STATEMENT_TIMEOUT_MS = 10000;

const isAdmin = (user: AnalyticsUser) => user.role === 'admin';

// 1. Datasets lisibles : les siens, ou tous pour un administrateur
export async function listReadableDatasets(user: AnalyticsUser): Promise<DatasetInfo[]> {
  const where = isAdmin(user) ? '' : `WHERE d.${OWNER_COL} = $1`;
  const { rows } = await pool.query(
    `SELECT d.id, d.${TITLE_COL} AS title,
            (SELECT COUNT(*)::int FROM dataset_rows r WHERE r.dataset_id = d.id) AS row_count
       FROM datasets d ${where}
      ORDER BY d.id DESC
      LIMIT 200`,
    isAdmin(user) ? [] : [user.id],
  );
  return rows.map((r) => ({ id: r.id, title: r.title, rowCount: r.row_count }));
}

// 2. Dataset si l'utilisateur a le droit de le lire, sinon null
export async function findReadableDataset(user: AnalyticsUser, datasetId: number): Promise<DatasetInfo | null> {
  const params: unknown[] = [datasetId];
  let ownerCond = '';
  if (!isAdmin(user)) {
    params.push(user.id);
    ownerCond = `AND d.${OWNER_COL} = $2`;
  }
  const { rows } = await pool.query(
    `SELECT d.id, d.${TITLE_COL} AS title,
            (SELECT COUNT(*)::int FROM dataset_rows r WHERE r.dataset_id = d.id) AS row_count
       FROM datasets d
      WHERE d.id = $1 ${ownerCond}`,
    params,
  );
  return rows[0] ? { id: rows[0].id, title: rows[0].title, rowCount: rows[0].row_count } : null;
}

// Types P2 (detectType de datasets.service.ts) -> types P3
const P2_TYPES: Record<string, ColumnType> = { integer: 'number', number: 'number', date: 'date' };

// Colonnes déclarées par l'import P2. to_jsonb(d) évite une erreur SQL sur une
// base où la colonne `columns` n'a pas encore été ajoutée (renvoie alors []).
async function listDeclaredColumns(datasetId: number): Promise<{ name: string; type: string }[]> {
  const { rows } = await pool.query(`SELECT to_jsonb(d) -> 'columns' AS columns FROM datasets d WHERE d.id = $1`, [datasetId]);
  const declared = rows[0]?.columns;
  return Array.isArray(declared)
    ? declared.filter((c) => c && typeof c.name === 'string' && c.name).map((c) => ({ name: c.name, type: String(c.type) }))
    : [];
}

// 3. Colonnes et types : métadonnées P2 si présentes, sinon détection sur un échantillon.
// P2 classe en « text » une colonne dès qu'une valeur n'est pas du bon type ; P3 garde
// alors sa propre détection (90 % des valeurs), les conversions SQL ignorant les autres.
export async function listColumns(datasetId: number): Promise<ColumnInfo[]> {
  const [declared, sampled] = await Promise.all([listDeclaredColumns(datasetId), sampleColumns(datasetId)]);
  if (!declared.length) return sampled;
  const byName = new Map(sampled.map((c) => [c.name, c]));
  const columns: ColumnInfo[] = declared.map(({ name, type }) => ({
    name,
    type: P2_TYPES[type] || byName.get(name)?.type || 'text',
    filled: byName.get(name)?.filled ?? 0,
  }));
  const known = new Set(declared.map((c) => c.name));
  // Même ordre (par nom) que la détection : l'interface P3 présélectionne la première colonne numérique
  return [...columns, ...sampled.filter((c) => !known.has(c.name))].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

async function sampleColumns(datasetId: number): Promise<ColumnInfo[]> {
  const { rows } = await pool.query(
    `SELECT kv.key AS name,
            COUNT(*)::int AS filled,
            COUNT(*) FILTER (WHERE kv.value ~ '${NUMERIC_RE}')::int AS numeric,
            COUNT(*) FILTER (WHERE kv.value ~ '${ISO_DATE_RE}')::int AS dates
       FROM (SELECT ${DATA_COL} AS data FROM dataset_rows WHERE dataset_id = $1 ORDER BY id LIMIT ${COLUMN_SAMPLE_SIZE}) s,
            LATERAL jsonb_each_text(s.data) kv
      WHERE NULLIF(kv.value, '') IS NOT NULL
      GROUP BY kv.key
      ORDER BY kv.key`,
    [datasetId],
  );
  return rows.map((r) => ({
    name: r.name,
    type: r.numeric / r.filled >= TYPE_THRESHOLD ? 'number' : r.dates / r.filled >= TYPE_THRESHOLD ? 'date' : 'text',
    filled: r.filled,
  }));
}

// 4. Exécution d'une requête d'analyse avec un temps de calcul borné
export async function runAnalyticsSql(text: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const { rows } = await client.query(text, params);
    await client.query('COMMIT');
    return rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
