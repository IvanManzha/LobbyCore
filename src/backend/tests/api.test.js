const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { migrateAndSeed, TEST_DB_PATH } = require('./helpers/testDb');

let app;

test.before(async () => {
  await migrateAndSeed();
  process.env.SQLITE_PATH = TEST_DB_PATH;
  delete require.cache[require.resolve('../../../lib/db')];
  const serverPath = require.resolve('../server');
  delete require.cache[serverPath];
  app = require('../server');
});

test('GET /api/v1/tournaments возвращает список турниров', async () => {
  const res = await request(app).get('/api/v1/tournaments?includeTest=1');
  assert.equal(res.status, 200);
  assert.equal(Array.isArray(res.body), true);
  assert.equal(res.body.length, 2);
});

test('GET /api/v1/tournaments/:id возвращает турнир', async () => {
  const res = await request(app).get('/api/v1/tournaments/t1');
  assert.equal(res.status, 200);
  assert.equal(res.body.id, 't1');
  assert.equal(res.body.name, 'Winter Cup');
});

test('GET /api/v1/tournaments/:id/table возвращает таблицу', async () => {
  const res = await request(app).get('/api/v1/tournaments/t1/table');
  assert.equal(res.status, 200);
  assert.equal(res.body.tournament.id, 't1');
  assert.equal(Array.isArray(res.body.teams), true);
  assert.ok(res.body.leaderboard);
});

test('GET /api/v1/players/:name возвращает профиль игрока', async () => {
  const res = await request(app).get('/api/v1/players/PlayerOne');
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'PlayerOne');
});

test('GET /api/v1/players/:name/stats?year=2026 возвращает статистику', async () => {
  const res = await request(app).get('/api/v1/players/PlayerOne/stats?year=2026');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.core));
  assert.ok(res.body.coverage);
  assert.equal(res.body.meta.year, '2026');
});

test.after(async () => {
  try {
    const { db } = require('../../../lib/db');
    await db.destroy();
  } catch (_e) {
    /* ignore */
  }
});
