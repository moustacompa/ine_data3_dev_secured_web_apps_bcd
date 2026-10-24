'use strict';

/**
 * =====================================================================
 *  [FUSION P1/P4] Compatibilité entre le socle P1 et le module P4
 * =====================================================================
 *  Ajouté lors de la fusion de codep4/ dans le dépôt principal.
 *
 *  Le module P4 a été écrit avec des identifiants utilisateurs entiers
 *  (SERIAL), alors que P1 utilise des UUID (backend/database/schema.sql).
 *  Les comparaisons `Number(a) === Number(b)` donnaient NaN === NaN → false,
 *  donc plus personne n'était reconnu comme propriétaire.
 *
 *  Ce fichier regroupe tout ce qui adapte P4 aux conventions de P1 :
 *    - identifiants utilisateurs : UUID (ou entier, pour les tests et le dev)
 *    - logActivity : P1 attend un objet { userId, action, entity, ... }
 *      (voir README.md, section 3.3) alors que P4 appelait (userId, action, details)
 * =====================================================================
 */
const { httpError } = require('./errors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RE = /^[1-9]\d*$/;

/** Identifiant utilisateur normalisé en chaîne (UUID en minuscules ou entier). */
function normalizeUserId(raw) {
  if (raw === undefined || raw === null || raw === '') return raw;
  return String(raw).toLowerCase();
}

/** Compare deux identifiants utilisateurs, quel que soit leur type (UUID, nombre, chaîne). */
function sameId(a, b) {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return normalizeUserId(a) === normalizeUserId(b);
}

/** Valide un identifiant utilisateur venant de l'URL (UUID de P1, ou entier en dev). */
function parseUserId(raw) {
  const v = String(raw ?? '');
  if (UUID_RE.test(v)) return v.toLowerCase();
  if (INT_RE.test(v)) return v;
  throw httpError(404, 'Ressource introuvable.');
}

/**
 * Convertit un appel P4 (userId, 'dashboard.publish', { id, ... }) en payload
 * conforme au logActivity de P1 :
 *   { userId, action: 'DASHBOARD_PUBLISH', entity: 'dashboard', entity_id, status, details }
 */
function toP1ActivityPayload(userId, action, details = {}) {
  const entity = String(action).split('.')[0] || 'dashboard';
  const entityId = details.id ?? details.datasetId;
  return {
    userId: userId ?? null,
    action: String(action).replace(/\./g, '_').toUpperCase().slice(0, 50),
    entity: entity.slice(0, 50),
    entity_id: entityId !== undefined && entityId !== null ? String(entityId) : null,
    status: 'SUCCESS',
    details,
  };
}

module.exports = { UUID_RE, normalizeUserId, sameId, parseUserId, toP1ActivityPayload };
