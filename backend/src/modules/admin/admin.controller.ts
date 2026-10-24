import { Request, Response } from 'express';
import { getUsers, updateUserRole, updateUserStatus, getAdminStats, getAuditLogs } from './admin.service.js';
import { logActivity } from './activity.service.js';

// 1. Liste des utilisateurs
export const listUsers = async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string || '20', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);

    const data = await getUsers(search, limit, offset);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erreur listUsers:', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur serveur.' } });
  }
};

// 2. Modification de rôle
export const changeRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'analyst'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: "Le rôle doit être 'admin' ou 'analyst'." },
      });
    }

    const updatedUser = await updateUserRole(id, role);

    // Traçabilité : un changement de rôle est un événement critique de sécurité !
    await logActivity({
      req,
      userId: req.user?.id,
      action: 'ADMIN_CHANGE_ROLE',
      entity: 'user',
      entity_id: id,
      details: { newRole: role, targetEmail: updatedUser.email },
    });

    return res.status(200).json({
      success: true,
      message: 'Rôle mis à jour avec succès.',
      data: { user: updatedUser },
    });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Utilisateur introuvable.' } });
    }
    console.error('Erreur changeRole:', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur serveur.' } });
  }
};

// 3. Activation / Désactivation de compte
export const changeStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: "Le champ 'is_active' doit être un booléen." },
      });
    }

    const updatedUser = await updateUserStatus(id, is_active);

    // Traçabilité
    await logActivity({
      req,
      userId: req.user?.id,
      action: is_active ? 'ADMIN_ENABLE_USER' : 'ADMIN_DISABLE_USER',
      entity: 'user',
      entity_id: id,
      details: { targetEmail: updatedUser.email },
    });

    return res.status(200).json({
      success: true,
      message: `Compte ${is_active ? 'activé' : 'désactivé'} avec succès.`,
      data: { user: updatedUser },
    });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Utilisateur introuvable.' } });
    }
    console.error('Erreur changeStatus:', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur serveur.' } });
  }
};

// 4. Statistiques globales
export const getStats = async (_req: Request, res: Response) => {
  try {
    const data = await getAdminStats();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erreur getStats:', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur serveur.' } });
  }
};

// 5. Consultation des logs d'audit
export const listLogs = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);

    const data = await getAuditLogs(limit, offset);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erreur listLogs:', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur serveur.' } });
  }
};