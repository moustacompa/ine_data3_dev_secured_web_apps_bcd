'use strict';

/**
 * Règles d'accès aux analyses et dashboards.
 *
 *  visibilité | propriétaire | admin   | utilisateur partagé | autre connecté | visiteur (jeton)
 *  -----------+--------------+---------+---------------------+----------------+-----------------
 *  private    | lecture+écr. | lec+écr | —                   | —              | —
 *  shared     | lecture+écr. | lec+écr | lecture             | —              | —
 *  public     | lecture+écr. | lec+écr | lecture             | lecture        | lecture (dashboards)
 *
 * Les lignes de partage sont conservées si on repasse en privé, mais
 * deviennent inactives : la visibilité est toujours vérifiée.
 */

// [FUSION P1/P4] les ids utilisateurs sont des UUID chez P1
const { sameId } = require('./p1-compat');

/**
 * @param {{owner_id:string|number, visibility:string, shared_with_me?:boolean}} resource
 * @param {{id:string|number, role:string}} user
 * @returns {'owner'|'admin'|'viewer'|null}
 */
function resolveAccess(resource, user) {
  if (!resource || !user) return null;
  // [FUSION P1/P4] comparaison compatible UUID (Number(uuid) valait NaN) — voir p1-compat.js
  if (sameId(resource.owner_id, user.id)) return 'owner';
  if (user.role === 'admin') return 'admin';
  if (resource.visibility === 'public') return 'viewer';
  if (resource.visibility === 'shared' && resource.shared_with_me) return 'viewer';
  return null;
}

const canEdit = (access) => access === 'owner' || access === 'admin';

module.exports = { resolveAccess, canEdit };
