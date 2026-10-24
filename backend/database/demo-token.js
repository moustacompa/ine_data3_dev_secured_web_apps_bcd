'use strict';

/**
 * [FUSION P1/P4] Jeton JWT de test pour un compte existant (en attendant le login de P1).
 *
 *   cd backend && node --env-file-if-exists=.env database/demo-token.js alice@example.com
 *
 * Cherche l'UUID et le rôle du compte en base, puis affiche uniquement le jeton
 * (signé avec JWT_SECRET, comme le vérifie le serveur de dev P4).
 */
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const DEFAULT_URL = 'postgres://postgres:postgres@localhost:5432/platform_db';

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('Usage : node database/demo-token.js <email>');
  const client = new Client({ connectionString: process.env.DATABASE_URL || DEFAULT_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT id, email, role FROM users WHERE lower(email) = lower($1)', [email]);
    if (!rows.length) throw new Error(`Aucun compte ${email} (lancer npm run db:seed).`);
    const { id, role } = rows[0];
    console.log(jwt.sign({ id, email: rows[0].email, role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' }));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
