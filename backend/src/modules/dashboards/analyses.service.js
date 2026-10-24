'use strict';

const { getDb, SCHEMA, runQuery, canReadDataset, logActivity } = require('./deps');
const { resolveAccess, canEdit } = require('./access');
const { httpError } = require('./errors');

const SELECT = `
  SELECT a.id, a.owner_id, a.dataset_id, a.title, a.description, a.config, a.visibility,
         a.created_at, a.updated_at,
         d.${SCHEMA.datasetTitleCol} AS dataset_title,
         u.email AS owner_email,
         EXISTS (SELECT 1 FROM analysis_shares s WHERE s.analysis_id = a.id AND s.user_id = $1) AS shared_with_me,
         (SELECT COUNT(*)::int FROM analysis_shares s WHERE s.analysis_id = a.id) AS share_count
    FROM analyses a
    LEFT JOIN datasets d ON d.id = a.dataset_id
    LEFT JOIN users u ON u.id = a.owner_id`;

function present(row, user) {
  const access = resolveAccess(row, user);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    datasetId: row.dataset_id,
    datasetTitle: row.dataset_title,
    config: row.config,
    visibility: row.visibility,
    owner: { id: row.owner_id, email: row.owner_email },
    shareCount: access === 'owner' || access === 'admin' ? row.share_count : undefined,
    access,
    canEdit: canEdit(access),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * scope : 'mine' (défaut) | 'shared' (partagées avec moi) | 'accessible' (les deux)
 *         | 'all' (admin uniquement)
 */
async function list(user, { scope = 'mine', q, datasetId, limit = 50, offset = 0 } = {}) {
  const params = [user.id];
  const where = [];
  const sharedCond = `(a.visibility = 'shared' AND a.owner_id <> $1
      AND EXISTS (SELECT 1 FROM analysis_shares s WHERE s.analysis_id = a.id AND s.user_id = $1))`;

  if (scope === 'shared') where.push(sharedCond);
  else if (scope === 'accessible') where.push(`(a.owner_id = $1 OR ${sharedCond})`);
  else if (scope === 'all') {
    if (user.role !== 'admin') throw httpError(403, 'Accès réservé aux administrateurs.');
  } else where.push('a.owner_id = $1');

  if (q) { params.push(`%${q}%`); where.push(`(a.title ILIKE $${params.length} OR a.description ILIKE $${params.length})`); }
  if (datasetId) { params.push(Number(datasetId)); where.push(`a.dataset_id = $${params.length}`); }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const sql = `SELECT x.*, COUNT(*) OVER()::int AS total_count FROM (${SELECT}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}) x
      ORDER BY x.updated_at DESC LIMIT ${lim} OFFSET ${off}`;

  const { rows } = await getDb().query(sql, params);
  return { items: rows.map((r) => present(r, user)), total: rows[0]?.total_count ?? 0, limit: lim, offset: off };
}

async function findRaw(user, id) {
  const { rows } = await getDb().query(`${SELECT} WHERE a.id = $2`, [user.id, id]);
  return rows[0] || null;
}

/** Retourne l'analyse si l'utilisateur peut la lire (sinon 404). */
async function getReadable(user, id) {
  const row = await findRaw(user, id);
  if (!row || !resolveAccess(row, user)) throw httpError(404, 'Analyse introuvable.');
  return row;
}

async function getEditable(user, id) {
  const row = await getReadable(user, id);
  if (!canEdit(resolveAccess(row, user))) throw httpError(403, 'Seul le propriétaire peut modifier cette analyse.');
  return row;
}

async function get(user, id) {
  return present(await getReadable(user, id), user);
}

async function create(user, data) {
  if (!(await canReadDataset(user, data.datasetId))) throw httpError(403, "Vous n'avez pas accès à ce dataset.");
  const { rows } = await getDb().query(
    `INSERT INTO analyses (owner_id, dataset_id, title, description, config, visibility)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [user.id, data.datasetId, data.title, data.description ?? null, JSON.stringify(data.config), data.visibility || 'private'],
  );
  logActivity(user.id, 'analysis.create', { id: rows[0].id, datasetId: data.datasetId });
  return get(user, rows[0].id);
}

async function update(user, id, data) {
  const current = await getEditable(user, id);
  // (un admin peut réaffecter n'importe quel dataset ; un propriétaire seulement les siens)
  if (data.datasetId && data.datasetId !== current.dataset_id) {
    if (!(await canReadDataset(user, data.datasetId))) throw httpError(403, "Vous n'avez pas accès à ce dataset.");
  }
  const map = { title: 'title', description: 'description', datasetId: 'dataset_id', config: 'config', visibility: 'visibility' };
  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) {
      params.push(key === 'config' ? JSON.stringify(data[key]) : data[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length) {
    params.push(id);
    await getDb().query(`UPDATE analyses SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    logActivity(user.id, 'analysis.update', { id });
  }
  return get(user, id);
}

async function remove(user, id) {
  await getEditable(user, id);
  const db = getDb();
  await db.query('DELETE FROM analyses WHERE id = $1', [id]);
  // Retire les widgets qui pointaient vers cette analyse
  await db.query(
    `UPDATE dashboards
        SET layout = COALESCE((SELECT jsonb_agg(w) FROM jsonb_array_elements(layout) w
                                WHERE (w ->> 'analysisId') IS DISTINCT FROM $1), '[]'::jsonb)
      WHERE layout @> jsonb_build_array(jsonb_build_object('analysisId', $2::int))`,
    [String(id), id],
  );
  logActivity(user.id, 'analysis.delete', { id });
}

/** Exécute l'analyse, avec d'éventuels filtres supplémentaires. */
async function run(user, id, extraFilters = []) {
  const row = await getReadable(user, id);
  return execute(row, extraFilters);
}

async function execute(row, extraFilters = []) {
  const query = row.config?.query || {};
  const merged = { ...query, filters: [...(query.filters || []), ...extraFilters] };
  const result = await runQuery(row.dataset_id, merged);
  return { chart: row.config?.chart || { type: 'table' }, ...result };
}

module.exports = { list, get, getReadable, getEditable, create, update, remove, run, execute, present };
