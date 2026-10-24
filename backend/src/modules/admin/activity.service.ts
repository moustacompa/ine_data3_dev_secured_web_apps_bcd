import { Request } from 'express';
import { query } from '../../config/db.js';

export interface LogActivityParams {
  req?: Request;
  userId?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  status?: 'SUCCESS' | 'FAILURE';
  details?: Record<string, unknown> | null;
}

// Service d'enregistrement des logs d'audit
export const logActivity = async (params: LogActivityParams) => {
  try {
    const { req, userId, action, entity, entity_id, status = 'SUCCESS', details } = params;

    // Extraction automatique de l'adresse IP et de l'User-Agent si req est fourni
    const ip = req ? ((req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || null) : null;
    const userAgent = req ? (req.headers['user-agent'] || null) : null;

    const sql = `
      INSERT INTO activity_logs (user_id, action, entity, entity_id, ip_address, user_agent, status, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await query(sql, [
      userId || null,
      action.toUpperCase(),
      entity.toLowerCase(),
      entity_id ? String(entity_id) : null,
      ip,
      userAgent,
      status,
      details ? JSON.stringify(details) : null,
    ]);
  } catch (error) {
    // Règle d'or en cybersécurité : une panne de logging ne doit jamais faire crasher le service métier principal
    console.error('Erreur lors de l\'enregistrement du log d\'activité:', error);
  }
};