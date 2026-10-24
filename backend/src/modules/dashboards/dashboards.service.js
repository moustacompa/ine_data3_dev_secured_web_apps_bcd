'use strict';

const crypto = require('crypto');
const deps = require('./deps');
const { resolveAccess, canEdit } = require('./access');
const { httpError } = require('./errors');
const { toQueryFilters } = require('./validate');
const { detectOutliers } = require('./outliers');
const analysesService = require('./analyses.service');
// [FUSION P1/P4] comparaison d'ids compatible UUID
const { sameId } = require('./p1-compat');

const { getDb, logActivity } = deps;

const SELECT = `
  SELECT b.*, u.email AS owner_email,
         EXISTS (SELECT 1 FROM dashboard_shares s WHERE s.dashboard_id = b.id AND s.user_id = $1) AS shared_with_me,
         (SELECT COUNT(*)::int FROM dashboard_shares s WHERE s.dashboard_id = b.id) AS share_count
    FROM dashboards b
    LEFT JOIN users u ON u.id = b.owner_id`;

const newToken = () => crypto.randomBytes(24).toString('base64url');

function present(row, user) {
  const access = resolveAccess(row, user);
  const editable = canEdit(access);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    layout: row.layout,
    globalFilters: row.global_filters,
    visibility: row.visibility,
    publicToken: editable ? row.public_token : undefined,
    publishedAt: row.published_at,
    viewCount: editable ? row.view_count : undefined,
    shareCount: editable ? row.share_count : undefined,
    owner: { id: row.owner_id, email: row.owner_email },
    access,
    canEdit: editable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Version publique : aucune donnée personnelle ni jeton. */
const presentPublic = (row) => ({
  title: row.title,
  description: row.description,
  layout: row.layout,
  globalFilters: row.global_filters,
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
});

async function list(user, { scope = 'mine', q, limit = 50, offset = 0 } = {}) {
  const params = [user.id];
  const where = [];
  if (scope === 'shared') {
    where.push(`b.owner_id <> $1 AND b.visibility IN ('shared', 'public')
      AND EXISTS (SELECT 1 FROM dashboard_shares s WHERE s.dashboard_id = b.id AND s.user_id = $1)`);
  } else if (scope === 'all') {
    if (user.role !== 'admin') throw httpError(403, 'Accès réservé aux administrateurs.');
  } else where.push('b.owner_id = $1');

  if (q) { params.push(`%${q}%`); where.push(`(b.title ILIKE $${params.length} OR b.description ILIKE $${params.length})`); }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const { rows } = await getDb().query(
    `SELECT x.*, COUNT(*) OVER()::int AS total_count FROM (${SELECT}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}) x
      ORDER BY x.updated_at DESC LIMIT ${lim} OFFSET ${off}`,
    params,
  );
  return {
    items: rows.map((r) => {
      const d = present(r, user);
      d.widgetCount = Array.isArray(r.layout) ? r.layout.length : 0;
      delete d.layout;
      delete d.globalFilters;
      return d;
    }),
    total: rows[0]?.total_count ?? 0,
    limit: lim,
    offset: off,
  };
}

async function getReadable(user, id) {
  const { rows } = await getDb().query(`${SELECT} WHERE b.id = $2`, [user.id, id]);
  const row = rows[0];
  if (!row || !resolveAccess(row, user)) throw httpError(404, 'Dashboard introuvable.');
  return row;
}

async function getEditable(user, id) {
  const row = await getReadable(user, id);
  if (!canEdit(resolveAccess(row, user))) throw httpError(403, 'Seul le propriétaire peut modifier ce dashboard.');
  return row;
}

async function get(user, id) {
  return present(await getReadable(user, id), user);
}

async function getByToken(token, { countView = false } = {}) {
  if (typeof token !== 'string' || !/^[\w-]{20,64}$/.test(token)) throw httpError(404, 'Dashboard introuvable.');
  const db = getDb();
  const { rows } = await db.query(
    "SELECT * FROM dashboards WHERE public_token = $1 AND visibility = 'public'",
    [token],
  );
  if (!rows[0]) throw httpError(404, "Ce dashboard n'existe pas ou n'est plus public.");
  if (countView) db.query('UPDATE dashboards SET view_count = view_count + 1 WHERE id = $1', [rows[0].id]).catch(() => {});
  return rows[0];
}

/**
 * Vérifie que le propriétaire du dashboard a bien accès à chaque élément
 * référencé (analyses possédées ou partagées avec lui, datasets lisibles).
 */
async function checkLayoutAccess(owner, layout = []) {
  const analysisIds = [...new Set(layout.filter((w) => w.type === 'analysis').map((w) => w.analysisId))];
  if (analysisIds.length) {
    const { rows } = await getDb().query(
      `SELECT a.id, a.owner_id, a.visibility,
              EXISTS (SELECT 1 FROM analysis_shares s WHERE s.analysis_id = a.id AND s.user_id = $1) AS shared_with_me
         FROM analyses a WHERE a.id = ANY($2::int[])`,
      [owner.id, analysisIds],
    );
    // Évalué comme un utilisateur standard, exactement comme au moment du rendu
    const asUser = { id: owner.id, role: 'user' };
    const ok = new Set(rows.filter((r) => resolveAccess(r, asUser)).map((r) => r.id));
    const missing = analysisIds.filter((id) => !ok.has(id));
    if (missing.length) throw httpError(400, `Analyses inaccessibles : ${missing.join(', ')}.`);
  }
  const datasetIds = [...new Set(layout.filter((w) => w.type === 'outliers').map((w) => w.datasetId))];
  for (const datasetId of datasetIds) {
    if (!(await deps.canReadDataset(owner, datasetId))) throw httpError(400, `Dataset ${datasetId} inaccessible.`);
  }
}

function visibilityColumns(visibility, currentToken) {
  if (visibility === 'public') {
    return { public_token: currentToken || newToken(), published_at: currentToken ? undefined : new Date() };
  }
  return { public_token: null, published_at: null };
}

async function create(user, data) {
  const layout = data.layout || [];
  await checkLayoutAccess(user, layout);
  const visibility = data.visibility || 'private';
  const vis = visibilityColumns(visibility, null);
  const { rows } = await getDb().query(
    `INSERT INTO dashboards (owner_id, title, description, layout, global_filters, visibility, public_token, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [user.id, data.title, data.description ?? null, JSON.stringify(layout),
      JSON.stringify(data.globalFilters || []), visibility, vis.public_token, vis.published_at ?? null],
  );
  logActivity(user.id, 'dashboard.create', { id: rows[0].id });
  return get(user, rows[0].id);
}

async function update(user, id, data) {
  const current = await getEditable(user, id);
  const owner = { id: current.owner_id, role: sameId(current.owner_id, user.id) ? user.role : 'user' }; // [FUSION P1/P4] était Number(...) === Number(...)
  if (data.layout) await checkLayoutAccess(owner, data.layout);

  const cols = {};
  if (data.title !== undefined) cols.title = data.title;
  if (data.description !== undefined) cols.description = data.description;
  if (data.layout !== undefined) cols.layout = JSON.stringify(data.layout);
  if (data.globalFilters !== undefined) cols.global_filters = JSON.stringify(data.globalFilters);
  if (data.visibility !== undefined && data.visibility !== current.visibility) {
    cols.visibility = data.visibility;
    Object.assign(cols, visibilityColumns(data.visibility, current.public_token));
    logActivity(user.id, data.visibility === 'public' ? 'dashboard.publish' : 'dashboard.visibility', { id, visibility: data.visibility });
  }

  const entries = Object.entries(cols).filter(([, v]) => v !== undefined);
  if (entries.length) {
    const params = entries.map(([, v]) => v);
    params.push(id);
    await getDb().query(
      `UPDATE dashboards SET ${entries.map(([k], i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${params.length}`,
      params,
    );
    logActivity(user.id, 'dashboard.update', { id });
  }
  return get(user, id);
}

async function remove(user, id) {
  await getEditable(user, id);
  await getDb().query('DELETE FROM dashboards WHERE id = $1', [id]);
  logActivity(user.id, 'dashboard.delete', { id });
}

/** Génère un nouveau lien public ; l'ancien cesse immédiatement de fonctionner. */
async function regenerateToken(user, id) {
  const current = await getEditable(user, id);
  if (current.visibility !== 'public') throw httpError(400, "Rendez d'abord le dashboard public.");
  await getDb().query('UPDATE dashboards SET public_token = $1 WHERE id = $2', [newToken(), id]);
  logActivity(user.id, 'dashboard.token.regenerate', { id });
  return get(user, id);
}

// ---------------------------------------------------------------------
// Rendu : exécute chaque widget avec les filtres globaux
// ---------------------------------------------------------------------
async function loadLayoutAnalyses(ownerId, layout) {
  const ids = [...new Set(layout.filter((w) => w.type === 'analysis').map((w) => w.analysisId))];
  if (!ids.length) return new Map();
  const { rows } = await getDb().query(
    `SELECT a.*, EXISTS (SELECT 1 FROM analysis_shares s WHERE s.analysis_id = a.id AND s.user_id = $1) AS shared_with_me
       FROM analyses a WHERE a.id = ANY($2::int[])`,
    [ownerId, ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function renderWidget(widget, ctx) {
  const { owner, analyses, globalFilters, filterValues } = ctx;
  if (widget.type === 'analysis') {
    const analysis = analyses.get(widget.analysisId);
    if (!analysis) throw httpError(404, "L'analyse de ce widget a été supprimée.");
    // L'accès est évalué pour le PROPRIÉTAIRE du dashboard, pas pour le lecteur :
    // si le partage d'une analyse est retiré, le widget cesse de s'afficher.
    if (!resolveAccess(analysis, owner)) throw httpError(403, "L'accès à cette analyse a été retiré.");
    const filters = toQueryFilters(globalFilters, filterValues, analysis.dataset_id);
    const result = await analysesService.execute(analysis, filters);
    return { title: widget.title || analysis.title, datasetId: analysis.dataset_id, ...result };
  }
  if (widget.type === 'outliers') {
    const filters = toQueryFilters(globalFilters, filterValues, widget.datasetId);
    const points = await deps.fetchColumnValues(widget.datasetId, widget.column, filters);
    return {
      title: widget.title || `Valeurs aberrantes : ${widget.column}`,
      datasetId: widget.datasetId,
      chart: { type: 'outliers' },
      outliers: detectOutliers(points, { method: widget.method, threshold: widget.threshold, maxReturned: 50 }),
    };
  }
  throw httpError(400, 'Type de widget inconnu.');
}

async function render(row, filterValues = {}) {
  const layout = Array.isArray(row.layout) ? row.layout : [];
  const ctx = {
    owner: { id: row.owner_id, role: 'user' },
    analyses: await loadLayoutAnalyses(row.owner_id, layout),
    globalFilters: row.global_filters || [],
    filterValues,
  };
  const settled = await Promise.allSettled(layout.map((w) => renderWidget(w, ctx)));
  return {
    widgets: layout.map((w, i) => {
      const s = settled[i];
      if (s.status === 'fulfilled') return { widgetId: w.id, status: 'ok', ...s.value };
      const status = s.reason?.status;
      if (!status || status >= 500) console.error('[dashboards] widget', w.id, s.reason);
      return {
        widgetId: w.id,
        status: 'error',
        title: w.title || 'Widget',
        error: status && status < 500 ? s.reason.message : "Ce widget n'a pas pu être calculé.",
      };
    }),
    renderedAt: new Date().toISOString(),
  };
}

/** Valeurs proposées pour un filtre global de type "select". */
async function filterOptions(row, filterId) {
  const filter = (row.global_filters || []).find((f) => f.id === filterId);
  if (!filter) throw httpError(404, 'Filtre introuvable.');
  const layout = Array.isArray(row.layout) ? row.layout : [];
  const analyses = await loadLayoutAnalyses(row.owner_id, layout);
  let datasetIds = layout
    .map((w) => (w.type === 'analysis' ? analyses.get(w.analysisId)?.dataset_id : w.datasetId))
    .filter(Boolean);
  if (filter.datasetIds?.length) datasetIds = datasetIds.filter((d) => filter.datasetIds.includes(d));
  const lists = await Promise.all([...new Set(datasetIds)].map((d) => deps.distinctValues(d, filter.field, 200)));
  const values = [...new Set(lists.flat())].sort((a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true }));
  return { filterId, field: filter.field, values: values.slice(0, 200), truncated: values.length > 200 };
}

/** Indicateurs pour le dashboard d'administration de P1. */
async function stats() {
  const { rows } = await getDb().query(`
    SELECT
      (SELECT COUNT(*)::int FROM analyses) AS analyses,
      (SELECT COUNT(*)::int FROM analyses WHERE visibility = 'shared') AS shared_analyses,
      (SELECT COUNT(*)::int FROM dashboards) AS dashboards,
      (SELECT COUNT(*)::int FROM dashboards WHERE visibility = 'shared') AS shared_dashboards,
      (SELECT COUNT(*)::int FROM dashboards WHERE visibility = 'public') AS public_dashboards,
      (SELECT COALESCE(SUM(view_count), 0)::int FROM dashboards) AS public_views`);
  const top = await getDb().query(`
    SELECT b.id, b.title, b.view_count, u.email AS owner_email
      FROM dashboards b LEFT JOIN users u ON u.id = b.owner_id
     WHERE b.visibility = 'public' ORDER BY b.view_count DESC LIMIT 5`);
  return { totals: rows[0], topPublicDashboards: top.rows };
}

module.exports = {
  list, get, getReadable, getEditable, getByToken, create, update, remove,
  regenerateToken, render, filterOptions, stats, present, presentPublic,
};
