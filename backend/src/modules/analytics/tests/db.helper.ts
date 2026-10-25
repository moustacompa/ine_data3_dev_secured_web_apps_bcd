// Aide aux tests d'intégration : ils sont ignorés si la base de démo n'est pas
// disponible (base locale initialisée avec 050_demo_seed.sql). Les données ne
// sont jamais modifiées ; seules des lignes ANALYTICS_QUERY sont ajoutées à
// activity_logs par les appels HTTP (comportement normal de l'API).
import { pool } from '../../../config/db.js';

export interface DemoContext {
  datasetId: number;
  users: Record<'alice' | 'bob' | 'admin', { id: string; role: string }>;
}

export async function loadDemoContext(): Promise<DemoContext | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const ds = await pool.query("SELECT id FROM datasets WHERE title = 'Ventes 2026 (démo)' ORDER BY id LIMIT 1");
    const us = await pool.query(
      "SELECT id, email, role FROM users WHERE email IN ('alice@example.com', 'bob@example.com', 'admin@example.com')",
    );
    if (!ds.rows[0] || us.rows.length !== 3) return null;
    const byName = Object.fromEntries(us.rows.map((u) => [u.email.split('@')[0], { id: u.id, role: u.role }]));
    return { datasetId: ds.rows[0].id, users: byName as DemoContext['users'] };
  } catch {
    return null;
  }
}

export const SKIP_REASON = 'base de démo indisponible (docker compose up -d postgres, puis schéma + 050_demo_seed.sql)';

export { pool };
