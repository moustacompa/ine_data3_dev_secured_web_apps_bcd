import { query } from '../../config/db.js';

// 1. Récupérer la liste des utilisateurs (avec pagination et recherche)
export const getUsers = async (search?: string, limit: number = 20, offset: number = 0) => {
  let sql = `
    SELECT id, email, first_name, last_name, role, is_active, created_at
    FROM users
  `;
  const params: unknown[] = [];

  if (search) {
    sql += ` WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1`;
    params.push(`%${search}%`);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  const countResult = await query('SELECT COUNT(*) as total FROM users');

  return {
    users: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
};

// 2. Mettre à jour le rôle d'un utilisateur ('admin' | 'analyst')
export const updateUserRole = async (userId: string, newRole: 'admin' | 'analyst') => {
  const result = await query(
    `UPDATE users 
     SET role = $1 
     WHERE id = $2 
     RETURNING id, email, first_name, last_name, role, is_active`,
    [newRole, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return result.rows[0];
};

// 3. Activer ou désactiver un compte utilisateur
export const updateUserStatus = async (userId: string, isActive: boolean) => {
  const result = await query(
    `UPDATE users 
     SET is_active = $1 
     WHERE id = $2 
     RETURNING id, email, first_name, last_name, role, is_active`,
    [isActive, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  return result.rows[0];
};

// 4. Statistiques globales pour le dashboard Admin
export const getAdminStats = async () => {
  // A. Nombre total d'utilisateurs et utilisateurs actifs
  const usersStats = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE is_active = true) as active_users,
      COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
      COUNT(*) FILTER (WHERE role = 'analyst') as analyst_users
    FROM users
  `);

  // B. Nombre total d'actions journalisées
  const logsStats = await query('SELECT COUNT(*) as total_logs FROM activity_logs');

  // C. Répartition des actions par type
  const actionsBreakdown = await query(`
    SELECT action, COUNT(*) as count 
    FROM activity_logs 
    GROUP BY action 
    ORDER BY count DESC 
    LIMIT 5
  `);

  return {
    users: usersStats.rows[0],
    totalLogs: parseInt(logsStats.rows[0].total_logs, 10),
    topActions: actionsBreakdown.rows,
  };
};

// 5. Consulter l'historique d'audit des logs
export const getAuditLogs = async (limit: number = 50, offset: number = 0) => {
  const sql = `
    SELECT 
      l.id, l.action, l.entity, l.entity_id, l.ip_address, l.user_agent, l.status, l.details, l.created_at,
      u.email as user_email, u.first_name, u.last_name
    FROM activity_logs l
    LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const result = await query(sql, [limit, offset]);
  const countResult = await query('SELECT COUNT(*) as total FROM activity_logs');

  return {
    logs: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
};