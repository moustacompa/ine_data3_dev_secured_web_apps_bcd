// Tests d'intégration HTTP de l'inscription (P1) : une inscription publique ne doit
// jamais donner le rôle admin. Base locale requise (DATABASE_URL) ; les comptes créés
// par ces tests (@auth-test.example) sont supprimés à la fin.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../../../config/db.js';
import authRouter from '../auth.routes.js';
import adminRouter from '../../admin/admin.routes.js';

const DOMAIN = '@auth-test.example';
const PASSWORD = 'Password123!';
const stamp = Date.now();
const email = (name: string) => `${name}.${stamp}${DOMAIN}`;

async function dbAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try { await pool.query('SELECT 1 FROM users LIMIT 1'); return true; } catch { return false; }
}
const skip = (await dbAvailable()) ? false : 'base locale indisponible (docker compose up -d postgres)';

let server: Server;
let baseUrl = '';

async function call(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() as any };
}

const roleInDb = async (address: string) =>
  (await pool.query('SELECT role FROM users WHERE email = $1', [address])).rows[0]?.role;
const roleInToken = (token: string) => (jwt.decode(token) as { role?: string } | null)?.role;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  if (!skip) await pool.query('DELETE FROM users WHERE email LIKE $1', [`%.${stamp}${DOMAIN}`]);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('inscription avec role=admin : compte créé en analyst, sans privilèges admin', { skip }, async () => {
  const address = email('escalade');
  const reg = await call('POST', '/auth/register', {
    body: { email: address, password: PASSWORD, first_name: 'Test', last_name: 'Escalade', role: 'admin' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.data.user.role, 'analyst');
  assert.equal(roleInToken(reg.json.data.token), 'analyst');
  assert.equal(await roleInDb(address), 'analyst');

  // Le jeton obtenu (inscription puis connexion) est refusé par les routes administrateur
  const login = await call('POST', '/auth/login', { body: { email: address, password: PASSWORD } });
  assert.equal(login.status, 200);
  assert.equal(login.json.data.user.role, 'analyst');
  for (const token of [reg.json.data.token, login.json.data.token]) {
    assert.equal((await call('GET', '/admin/users', { token })).status, 403);
    assert.equal((await call('GET', '/admin/stats', { token })).status, 403);
  }
});

test('aucune variante du champ role ne donne un autre rôle que analyst', { skip }, async () => {
  for (const [i, role] of ['ADMIN', 'superadmin', ['admin'], { name: 'admin' }].entries()) {
    const address = email(`variante${i}`);
    const reg = await call('POST', '/auth/register', {
      body: { email: address, password: PASSWORD, first_name: 'Test', last_name: 'Variante', role },
    });
    assert.equal(reg.status, 201, `role=${JSON.stringify(role)}`);
    assert.equal(await roleInDb(address), 'analyst', `role=${JSON.stringify(role)}`);
  }
});

test('inscription et connexion ordinaires', { skip }, async () => {
  const address = email('ordinaire');
  const reg = await call('POST', '/auth/register', {
    body: { email: address, password: PASSWORD, first_name: 'Test', last_name: 'Ordinaire' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.data.user.role, 'analyst');

  const login = await call('POST', '/auth/login', { body: { email: address, password: PASSWORD } });
  assert.equal(login.status, 200);
  const me = await call('GET', '/auth/me', { token: login.json.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.user.email, address);
  assert.equal(me.json.data.user.role, 'analyst');

  assert.equal((await call('POST', '/auth/login', { body: { email: address, password: 'mauvais-mdp' } })).status, 401);
  assert.equal((await call('POST', '/auth/register', {
    body: { email: address, password: PASSWORD, first_name: 'Test', last_name: 'Doublon' },
  })).status, 409);
});

test('un administrateur existant garde son rôle et ses accès', { skip }, async (t) => {
  const login = await call('POST', '/auth/login', { body: { email: 'admin@example.com', password: PASSWORD } });
  if (login.status !== 200) { t.skip('compte de démo admin@example.com absent'); return; }
  assert.equal(login.json.data.user.role, 'admin');
  assert.equal(roleInToken(login.json.data.token), 'admin');
  const users = await call('GET', '/admin/users', { token: login.json.data.token });
  assert.equal(users.status, 200);
});
