'use strict';

const { getDb, findUserByEmail, logActivity } = require('./deps');
const { httpError } = require('./errors');
// [FUSION P1/P4] comparaison d'ids compatible UUID
const { sameId } = require('./p1-compat');

// Tables autorisées (jamais issues de la requête HTTP)
const KINDS = {
  analysis: { table: 'analyses', shareTable: 'analysis_shares', fk: 'analysis_id' },
  dashboard: { table: 'dashboards', shareTable: 'dashboard_shares', fk: 'dashboard_id' },
};

async function listShares(kind, resourceId) {
  const k = KINDS[kind];
  const { rows } = await getDb().query(
    `SELECT u.id, u.email, s.created_at AS shared_at
       FROM ${k.shareTable} s JOIN users u ON u.id = s.user_id
      WHERE s.${k.fk} = $1
      ORDER BY s.created_at`,
    [resourceId],
  );
  return rows;
}

/**
 * Partage une ressource avec un utilisateur (par e-mail).
 * Une ressource privée passe automatiquement en "shared".
 */
async function addShare(kind, resource, actor, { email }) {
  const k = KINDS[kind];
  const target = await findUserByEmail(email);
  if (!target) throw httpError(404, `Aucun compte n'utilise l'adresse ${email}.`);
  if (sameId(target.id, resource.owner_id)) { // [FUSION P1/P4] était Number(...) === Number(...)
    throw httpError(400, 'Le propriétaire a déjà accès à cette ressource.');
  }

  const db = getDb();
  await db.query(
    `INSERT INTO ${k.shareTable} (${k.fk}, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [resource.id, target.id],
  );
  let visibility = resource.visibility;
  if (visibility === 'private') {
    await db.query(`UPDATE ${k.table} SET visibility = 'shared' WHERE id = $1`, [resource.id]);
    visibility = 'shared';
  }
  logActivity(actor.id, `${kind}.share`, { id: resource.id, with: target.id });
  return { shares: await listShares(kind, resource.id), visibility };
}

async function removeShare(kind, resource, actor, userId) {
  const k = KINDS[kind];
  const { rowCount } = await getDb().query(
    `DELETE FROM ${k.shareTable} WHERE ${k.fk} = $1 AND user_id = $2`,
    [resource.id, userId],
  );
  if (!rowCount) throw httpError(404, "Cet utilisateur n'avait pas accès.");
  logActivity(actor.id, `${kind}.unshare`, { id: resource.id, with: userId });
  return { shares: await listShares(kind, resource.id) };
}

module.exports = { listShares, addShare, removeShare };
