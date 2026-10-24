'use strict';

/**
 * Erreurs HTTP du module. Le gestionnaire global de P1 n'a besoin que de
 * err.status (ou err.statusCode) et err.message ; err.details est optionnel.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.statusCode = status;
    if (details) this.details = details;
  }
}

const httpError = (status, message, details) => new HttpError(status, message, details);

/** Traduit les erreurs PostgreSQL courantes en erreurs HTTP lisibles. */
function mapPgError(err) {
  if (!err || err instanceof HttpError || !err.code) return err;
  switch (err.code) {
    case '23503': return httpError(400, 'Référence invalide (dataset ou utilisateur inexistant).');
    case '23505': return httpError(409, 'Cette ressource existe déjà.');
    case '22P02':
    case '22007':
    case '22008': return httpError(400, 'Valeur invalide dans la requête.');
    case '23514': return httpError(400, 'Donnée refusée par une contrainte de la base.');
    default: return err;
  }
}

/** Enveloppe un contrôleur async et transmet les erreurs à Express. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => next(mapPgError(err)));

/** Gestionnaire de secours, utilisé uniquement par le serveur de dev autonome. */
// eslint-disable-next-line no-unused-vars
function fallbackErrorHandler(err, req, res, next) {
  const mapped = mapPgError(err);
  const status = mapped.status || mapped.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Erreur interne du serveur.' : mapped.message,
    ...(mapped.details ? { details: mapped.details } : {}),
  });
}

module.exports = { HttpError, httpError, mapPgError, asyncHandler, fallbackErrorHandler };
