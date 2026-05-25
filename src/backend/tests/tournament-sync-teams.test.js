/**
 * Синхронизация registration.entries → tournament_teams при старте турнира.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const knex = require('knex');
const config = require('../../../knexfile');

const TournamentService = require('../services/TournamentService');
const repo = require('../repositories/TournamentRepository');

const TEST_DB = path.join(__dirname, 'fixtures', 'sync_test.db');

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.KNEX_ENV = 'test';
  process.env.SQLITE_PATH = TEST_DB;
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  delete require.cache[require.resolve('../../../lib/db')];
  const db = knex(config.test);
  await db.migrate.latest();
  await db.destroy();
  delete require.cache[require.resolve('../services/TournamentService')];
  delete require.cache[require.resolve('../repositories/TournamentRepository')];
});

test.after(async () => {
  try {
    const { db } = require('../../../lib/db');
    await db.destroy();
  } catch (_e) {
    /* ignore */
  }
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('startTournament переносит entries в tournament_teams', async () => {
  const id = `sync_reg_${Date.now()}`;
  const existing = await repo.getById(id);
  if (existing) await repo.deleteById(id);

  await repo.create({
    id,
    name: 'Sync Reg Cup',
    date: '2026-12-01',
    type: 'solo',
    state: 'Запланирован',
    rounds: 2,
    registration: {
      entries: [
        { kind: 'solo', playerId: 'Alice', status: 'confirmed', createdAt: new Date().toISOString() },
        { kind: 'solo', playerId: 'Bob', status: 'confirmed', createdAt: new Date().toISOString() }
      ]
    }
  });

  let table = await TournamentService.getTournamentTable(id);
  assert.equal(table.teams.length, 0);

  await TournamentService.syncRegistrationEntriesToTable(id);
  table = await TournamentService.getTournamentTable(id);
  assert.equal(table.teams.length, 2);
  assert.ok(table.teams.some((t) => t.name === 'Alice'));
  assert.ok(table.teams.some((t) => t.name === 'Bob'));

  await TournamentService.startTournament(id);
  const started = await TournamentService.getTournamentById(id);
  assert.equal(started.state, 'В процессе');
  table = await TournamentService.getTournamentTable(id);
  assert.equal(table.teams.length, 2);

  await repo.deleteById(id);
});

test('getRegistrationDeadlineIso учитывает startAt', () => {
  assert.equal(
    TournamentService.getRegistrationDeadlineIso({
      date: '2026-01-01',
      startedAt: '2026-01-02',
      startAt: '2026-01-03T18:00:00.000Z'
    }),
    '2026-01-03T18:00:00.000Z'
  );
});
