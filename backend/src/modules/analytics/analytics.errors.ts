import { Request, Response, NextFunction } from 'express';

export interface ErrorDetail {
  field: string;
  message: string;
}

// 1. Erreur métier du module (convertie au format JSON de P1 par analyticsErrorHandler)
//    `status` / `statusCode` sont aussi lus par le module P4 lorsqu'il appelle runQuery.
export class AnalyticsError extends Error {
  status: number;
  statusCode: number;
  code: string;
  details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AnalyticsError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    if (details && details.length) this.details = details;
  }
}

export const validationError = (message: string, details?: ErrorDetail[]) =>
  new AnalyticsError(400, 'VALIDATION_ERROR', message, details);

// Un dataset inexistant et un dataset d'un autre utilisateur renvoient la même
// réponse : on ne révèle pas l'existence des datasets privés.
export const datasetNotFound = () =>
  new AnalyticsError(404, 'DATASET_NOT_FOUND', 'Dataset introuvable ou accès non autorisé.');

// 2. Traduction des erreurs PostgreSQL courantes (sans exposer le détail SQL)
function fromPgError(err: { code?: string }): AnalyticsError | null {
  switch (err.code) {
    case '22P02':
    case '22007':
    case '22008':
    case '22003':
    case '22012':
      return new AnalyticsError(400, 'INVALID_VALUE', 'Valeur invalide dans la requête d\'analyse.');
    case '57014':
      return new AnalyticsError(503, 'QUERY_TIMEOUT', 'L\'analyse a dépassé le temps de calcul autorisé.');
    default:
      return null;
  }
}

// 3. Enveloppe un contrôleur async pour transmettre les erreurs à Express
export const asyncHandler = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// 4. Gestionnaire d'erreurs du routeur /api/analytics (format P1, pas de stack trace côté client)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const analyticsErrorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  const known = err instanceof AnalyticsError ? err : fromPgError(err || {});
  if (!known) {
    console.error('Erreur analytics:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Une erreur interne est survenue.' },
    });
  }

  return res.status(known.status).json({
    success: false,
    error: {
      code: known.code,
      message: known.message,
      ...(known.details ? { details: known.details } : {}),
    },
  });
};
