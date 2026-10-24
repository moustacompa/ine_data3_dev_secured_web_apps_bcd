'use strict';

// [FUSION P1/P4] Tests de compatibilité avec les UUID et le logActivity de P1
const test = require('node:test');
const assert = require('node:assert/strict');
const { sameId, parseUserId, normalizeUserId, toP1ActivityPayload } = require('../p1-compat');
const { resolveAccess } = require('../access');

const OWNER = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const OTHER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

test('sameId : UUID, casse et entiers', () => {
  assert.equal(sameId(OWNER, OWNER.toUpperCase()), true);
  assert.equal(sameId(OWNER, OTHER), false);
  assert.equal(sameId(1, '1'), true);
  assert.equal(sameId(null, null), false);
  assert.equal(normalizeUserId(OWNER.toUpperCase()), OWNER);
});

test('resolveAccess reconnaît le propriétaire par UUID', () => {
  const res = { owner_id: OWNER, visibility: 'private', shared_with_me: false };
  assert.equal(resolveAccess(res, { id: OWNER, role: 'analyst' }), 'owner');
  assert.equal(resolveAccess(res, { id: OTHER, role: 'analyst' }), null);
  assert.equal(resolveAccess(res, { id: OTHER, role: 'admin' }), 'admin');
});

test('parseUserId accepte un UUID, refuse le reste', () => {
  assert.equal(parseUserId(OWNER), OWNER);
  assert.equal(parseUserId('12'), '12');
  assert.throws(() => parseUserId("1 OR 1=1"), { status: 404 });
  assert.throws(() => parseUserId(''), { status: 404 });
});

test('toP1ActivityPayload suit le format de P1', () => {
  assert.deepEqual(toP1ActivityPayload(OWNER, 'dashboard.publish', { id: 7, visibility: 'public' }), {
    userId: OWNER,
    action: 'DASHBOARD_PUBLISH',
    entity: 'dashboard',
    entity_id: '7',
    status: 'SUCCESS',
    details: { id: 7, visibility: 'public' },
  });
  assert.equal(toP1ActivityPayload(OWNER, 'outliers.detect', { datasetId: 3 }).entity_id, '3');
});
