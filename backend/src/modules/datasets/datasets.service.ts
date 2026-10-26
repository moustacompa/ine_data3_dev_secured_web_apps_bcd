import { pool, query } from '../../config/db.js';

export type DatasetColumn = { name: string; type: 'integer' | 'number' | 'boolean' | 'date' | 'text' };
export type DatasetRow = Record<string, string | number | boolean | null>;

const MAX_ROWS = 100_000;
const MAX_COLUMNS = 200;
const numericPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;

function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const candidates = [',', ';', '\t'].map((delimiter) => ({ delimiter, records: parseDelimited(input, delimiter) }));
  candidates.sort((a, b) => (b.records[0]?.length || 0) - (a.records[0]?.length || 0) || (a.delimiter === ',' ? -1 : 1));
  return candidates[0].records;
}

function parseDelimited(input: string, delimiter: string): string[][] {
  const records: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (quoted && c === '"' && input[i + 1] === '"') { value += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === delimiter) { row.push(value); value = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && input[i + 1] === '\n') i += 1;
      row.push(value); value = ''; if (row.some((v) => v.trim())) records.push(row); row = [];
    } else value += c;
  }
  if (quoted) throw new Error('Le CSV contient un champ entre guillemets non fermé.');
  if (value.length || row.length) { row.push(value); records.push(row); }
  return records;
}

function normalizeHeaders(values: string[]): string[] {
  const seen = new Map<string, number>();
  return values.map((raw, index) => {
    const base = raw.trim() || `column_${index + 1}`;
    const count = (seen.get(base) || 0) + 1; seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function detectType(values: string[]): DatasetColumn['type'] {
  const present = values.map((v) => v.trim()).filter(Boolean);
  if (!present.length) return 'text';
  if (present.every((v) => /^(true|false)$/i.test(v))) return 'boolean';
  if (present.every((v) => numericPattern.test(v))) {
    return present.every((v) => Number.isSafeInteger(Number(v))) ? 'integer' : 'number';
  }
  if (present.every((v) => datePattern.test(v) && !Number.isNaN(Date.parse(v)))) return 'date';
  return 'text';
}

function convertValue(raw: string | undefined, type: DatasetColumn['type']): DatasetRow[string] {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (type === 'integer' || type === 'number') return Number(value);
  if (type === 'boolean') return value.toLowerCase() === 'true';
  return value;
}

function profileRows(rows: DatasetRow[], columns: DatasetColumn[]) {
  let missingCells = 0;
  const stats = columns.map((column) => {
    const values = rows.map((row) => row[column.name]);
    const present = values.filter((v) => v !== null && v !== '');
    const missing = values.length - present.length; missingCells += missing;
    const stat: Record<string, unknown> = {
      name: column.name, type: column.type, missing, missingPercent: rows.length ? round(missing * 100 / rows.length) : 0,
      unique: new Set(present.map(String)).size,
    };
    if (column.type === 'integer' || column.type === 'number') {
      const nums = present.map(Number).filter(Number.isFinite);
      stat.min = nums.length ? nums.reduce((a, b) => Math.min(a, b), Infinity) : null;
      stat.max = nums.length ? nums.reduce((a, b) => Math.max(a, b), -Infinity) : null;
      stat.mean = nums.length ? round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
    }
    return stat;
  });
  const cellCount = rows.length * columns.length;
  return {
    rowCount: rows.length, columnCount: columns.length, missingCells,
    missingPercent: cellCount ? round(missingCells * 100 / cellCount) : 0,
    qualityScore: cellCount ? round((cellCount - missingCells) * 100 / cellCount) : 100,
    columns: stats,
  };
}
const round = (n: number) => Math.round(n * 100) / 100;

export function parseDataset(content: string, format: 'csv' | 'json') {
  let rawRows: Record<string, unknown>[];
  if (format === 'json') {
    const parsed = JSON.parse(content);
    rawRows = Array.isArray(parsed) ? parsed : parsed?.data;
    if (!Array.isArray(rawRows) || !rawRows.length || rawRows.some((r) => !r || Array.isArray(r) || typeof r !== 'object')) {
      throw new Error('Le JSON doit contenir un tableau non vide d’objets.');
    }
    rawRows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])));
  } else {
    const matrix = parseCsv(content);
    if (matrix.length < 2) throw new Error('Le CSV doit contenir une ligne d’en-têtes et au moins une ligne de données.');
    const headers = normalizeHeaders(matrix[0]);
    if (headers.length > MAX_COLUMNS) throw new Error(`Le fichier dépasse la limite de ${MAX_COLUMNS} colonnes.`);
    rawRows = matrix.slice(1).map((line) => Object.fromEntries(headers.map((name, index) => [name, line[index] ?? ''])));
  }
  if (rawRows.length > MAX_ROWS) throw new Error(`Le fichier dépasse la limite de ${MAX_ROWS} lignes.`);
  if (!rawRows.length) throw new Error('Le dataset est vide.');
  const names = [...new Set(rawRows.flatMap((row) => Object.keys(row)))];
  if (!names.length || names.length > MAX_COLUMNS) throw new Error(`Le dataset doit contenir entre 1 et ${MAX_COLUMNS} colonnes.`);
  const columns = names.map((name) => ({ name, type: detectType(rawRows.map((r) => String(r[name] ?? ''))) }));
  const rows = rawRows.map((record) => Object.fromEntries(columns.map((col) => [col.name, convertValue(String(record[col.name] ?? ''), col.type)])));
  return { columns, rows, profile: profileRows(rows, columns) };
}

export async function importDataset(ownerId: string, meta: { title: string; description?: string; category?: string; source?: string; filename: string; format: 'csv' | 'json' }, parsed: ReturnType<typeof parseDataset>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO datasets (user_id, title, description, category, source, original_filename, file_format, row_count, column_count, columns, profile)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb) RETURNING *`,
      [ownerId, meta.title, meta.description || null, meta.category || null, meta.source || null, meta.filename,
        meta.format, parsed.rows.length, parsed.columns.length, JSON.stringify(parsed.columns), JSON.stringify(parsed.profile)],
    );
    const dataset = inserted.rows[0];
    for (let offset = 0; offset < parsed.rows.length; offset += 500) {
      const batch = parsed.rows.slice(offset, offset + 500);
      await client.query(
        `INSERT INTO dataset_rows (dataset_id, data) SELECT $1, value::jsonb FROM unnest($2::text[]) AS value`,
        [dataset.id, batch.map((row) => JSON.stringify(row))],
      );
    }
    await client.query('COMMIT');
    return dataset;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

const ownerScope = (userId: string, isAdmin: boolean, paramIndex = 1) => isAdmin ? { sql: '', params: [] as unknown[] } : { sql: ` AND user_id = $${paramIndex}`, params: [userId] };

export async function listDatasets(userId: string, isAdmin: boolean, search = '') {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (!isAdmin) { params.push(userId); clauses.push(`user_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); clauses.push(`(title ILIKE $${params.length} OR COALESCE(description,'') ILIKE $${params.length} OR COALESCE(category,'') ILIKE $${params.length})`); }
  const result = await query(`SELECT * FROM datasets ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at DESC`, params);
  return result.rows;
}

export async function getDataset(id: number, userId: string, isAdmin: boolean) {
  const scope = ownerScope(userId, isAdmin, 2);
  const result = await query(`SELECT * FROM datasets WHERE id = $1${scope.sql}`, [id, ...scope.params]);
  return result.rows[0] || null;
}

export async function updateDataset(id: number, userId: string, isAdmin: boolean, values: Record<string, unknown>) {
  const allowed: Record<string, string> = { title: 'title', description: 'description', category: 'category', source: 'source' };
  const keys = Object.keys(values).filter((key) => allowed[key]);
  if (!keys.length) return getDataset(id, userId, isAdmin);
  const params: unknown[] = keys.map((key) => values[key]);
  const sets = keys.map((key, index) => `${allowed[key]} = $${index + 1}`);
  params.push(id);
  const scope = ownerScope(userId, isAdmin, params.length + 1); params.push(...scope.params);
  const result = await query(`UPDATE datasets SET ${sets.join(', ')}, updated_at = now() WHERE id = $${keys.length + 1}${scope.sql} RETURNING *`, params);
  return result.rows[0] || null;
}

export async function deleteDataset(id: number, userId: string, isAdmin: boolean) {
  const scope = ownerScope(userId, isAdmin, 2);
  const result = await query(`DELETE FROM datasets WHERE id = $1${scope.sql} RETURNING id`, [id, ...scope.params]);
  return (result.rowCount ?? 0) > 0;
}

export async function readRows(id: number, userId: string, isAdmin: boolean, options: { page: number; pageSize: number; search: string; sort?: string; direction: string; filters: Array<{ field: string; op: string; value?: unknown }> }) {
  const dataset = await getDataset(id, userId, isAdmin);
  if (!dataset) return null;
  const params: unknown[] = [id]; const clauses = ['dataset_id = $1'];
  if (options.search) { params.push(`%${options.search}%`); clauses.push(`data::text ILIKE $${params.length}`); }
  for (const filter of options.filters) {
    if (!filter.field || !['eq','contains','gt','gte','lt','lte','isnull','notnull'].includes(filter.op)) throw new Error('Filtre invalide.');
    params.push(filter.field); const fieldRef = `data ->> $${params.length}`;
    if (filter.op === 'isnull') clauses.push(`NULLIF(${fieldRef}, '') IS NULL`);
    else if (filter.op === 'notnull') clauses.push(`NULLIF(${fieldRef}, '') IS NOT NULL`);
    else { params.push(filter.value); const val = `$${params.length}`;
      if (filter.op === 'contains') clauses.push(`${fieldRef} ILIKE '%' || ${val} || '%'`);
      else if (filter.op === 'eq') clauses.push(`${fieldRef} = ${val}`);
      else clauses.push(`CASE WHEN ${fieldRef} ~ '^[+-]?[0-9]+(\\.[0-9]+)?$' THEN (${fieldRef})::numeric END ${({gt:'>',gte:'>=',lt:'<',lte:'<='} as Record<string,string>)[filter.op]} ${val}::numeric`);
    }
  }
  const where = clauses.join(' AND ');
  const count = await query(`SELECT COUNT(*)::int AS total FROM dataset_rows WHERE ${where}`, params);
  const limit = Math.min(Math.max(options.pageSize, 1), 100);
  const offset = (Math.max(options.page, 1) - 1) * limit;
  const rowParams = [...params];
  let order = 'id ASC';
  if (options.sort) { rowParams.push(options.sort); order = `data ->> $${rowParams.length} ${options.direction === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC`; }
  rowParams.push(limit, offset);
  const rows = await query(`SELECT id, data FROM dataset_rows WHERE ${where} ORDER BY ${order} LIMIT $${rowParams.length - 1} OFFSET $${rowParams.length}`, rowParams);
  return { rows: rows.rows, total: count.rows[0].total as number, page: Math.max(options.page, 1), pageSize: limit, dataset };
}

export async function getPreview(id: number, userId: string, isAdmin: boolean) {
  const dataset = await getDataset(id, userId, isAdmin);
  if (!dataset) return null;
  const rows = await query('SELECT id, data FROM dataset_rows WHERE dataset_id = $1 ORDER BY id LIMIT 10', [id]);
  return { dataset, rows: rows.rows };
}
