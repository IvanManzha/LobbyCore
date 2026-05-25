const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  migrateAndSeed,
  E2E_FIXTURES_DIR,
  E2E_TEST_DB_PATH
} = require('../../src/backend/tests/helpers/testDb');

let app;

test.before(async () => {
  await migrateAndSeed(E2E_FIXTURES_DIR, E2E_TEST_DB_PATH);
  process.env.SQLITE_PATH = E2E_TEST_DB_PATH;
  const serverPath = require.resolve('../../src/backend/server');
  delete require.cache[serverPath];
  app = require('../../src/backend/server');
});

test('GET /api/v1/tournaments returns list', async () => {
  const res = await request(app).get('/api/v1/tournaments');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.find((tournament) => tournament.id === 'fixture_cup'));
});

test('GET /api/v1/tournaments/:id/table returns leaderboard', async () => {
  const res = await request(app).get('/api/v1/tournaments/fixture_cup/table');
  assert.equal(res.status, 200);
  assert.ok(res.body.leaderboard);
  assert.equal(res.body.leaderboard.tournamentId, 'fixture_cup');
  assert.ok(res.body.leaderboard.rows.length > 0);
});

test('GET /api/v1/players/:name returns profile', async () => {
  const res = await request(app).get('/api/v1/players/Alice');
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Alice');
});

test('GET /api/v1/players/:name/stats returns stats core', async () => {
  const res = await request(app).get('/api/v1/players/Alice/stats?year=2026');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.core));
  const rating = res.body.core.find((item) => item.id === 'rating');
  assert.ok(rating);
});
