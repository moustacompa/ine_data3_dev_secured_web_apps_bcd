import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * [FUSION P1/P4] Initialisation d'un PostgreSQL installé directement sur le PC (sans Docker).
 *
 *   cd backend && npm run db:init
 *
 * Lit DATABASE_URL (fichier backend/.env, voir .env.example ; défaut :
 * postgres://postgres:postgres@localhost:5432/platform_db), crée la base si
 * elle n'existe pas, puis exécute les scripts dans l'ordre :
 *   schema.sql (P1) -> 020_datasets_placeholder.sql (P2) -> 040_dashboards.sql (P4)
 *
 * Les scripts sont idempotents (IF NOT EXISTS) : on peut relancer sans risque.
 */
const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_URL = 'postgres://postgres:postgres@localhost:5432/platform_db';
const SEED = process.argv.includes('--seed'); // npm run db:seed : ajoute les données de démo
const SCRIPTS = ['schema.sql', '020_datasets_placeholder.sql', '040_dashboards.sql', ...(SEED ? ['050_demo_seed.sql', '060_datasets_seed.sql'] : [])];

async function ensureDatabase(url) {
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z_][a-z0-9_]*$/i.test(dbName)) throw new Error(`Nom de base invalide : ${dbName}`);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Base "${dbName}" créée.`);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  const url = new URL(process.env.DATABASE_URL || DEFAULT_URL);
  await ensureDatabase(url);

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    // gen_random_uuid() est natif depuis PostgreSQL 13 ; pgcrypto le fournit pour les versions plus anciennes
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto').catch(() => {});
    for (const file of SCRIPTS) {
      await client.query(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      console.log(`✔ ${file}`);
    }
    console.log(`Base prête sur ${url.host}${url.pathname}.`);
    if (SEED) {
      const { rows } = await client.query('SELECT id, email, role FROM users ORDER BY email');
      console.log('\nComptes (mot de passe des comptes de démo : Password123!) :');
      console.table(rows);
      const ds = await client.query(
        'SELECT d.id, d.title, COUNT(r.id)::int AS lignes FROM datasets d LEFT JOIN dataset_rows r ON r.dataset_id = d.id GROUP BY d.id ORDER BY d.id',
      );
      console.log('Datasets :');
      console.table(ds.rows);
      console.log('Jeton de test : npm run token:dashboards -- <id ci-dessus> <role>');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Échec de l\'initialisation :', err.message);
  process.exit(1);
});
