const test = require('node:test');
const assert = require('node:assert/strict');
try {
  require('ts-node/register');
} catch (_e) {
  /* optional */
}
const path = require('path');
const fs = require('fs');
const knex = require('knex');
const config = require('../../../knexfile');

const fixturesDir = path.join(__dirname, 'fixtures', 'data');
const emptyDir = path.join(__dirname, 'fixtures', 'empty');
const EMPTY_DB = path.join(__dirname, 'fixtures', 'empty.db');

const loadTournamentService = () => {
  delete require.cache[require.resolve('../config/dataPaths')];
  delete require.cache[require.resolve('../repositories/TournamentRepository')];
  delete require.cache[require.resolve('../services/TournamentService')];
  return require('../services/TournamentService');
};

const loadPlayerService = () => {
  delete require.cache[require.resolve('../config/dataPaths')];
  delete require.cache[require.resolve('../services/PlayerService')];
  return require('../services/PlayerService');
};

async function useEmptyTestDb() {
  process.env.NODE_ENV = 'test';
  process.env.KNEX_ENV = 'test';
  process.env.SQLITE_PATH = EMPTY_DB;
  process.env.DATA_DIR = emptyDir;
  process.env.TOURNAMENTS_PATH = path.join(emptyDir, 'tournaments.json');
  process.env.TOURNAMENTS_DIR = path.join(emptyDir, 'tournaments');
  process.env.PLAYERS_DIR = path.join(emptyDir, 'players');
  if (fs.existsSync(EMPTY_DB)) fs.unlinkSync(EMPTY_DB);
  delete require.cache[require.resolve('../../../lib/db')];
  const db = knex({ ...config.test, connection: { filename: EMPTY_DB } });
  await db.migrate.latest();
  await db.destroy();
}

test('TournamentService.getAllTournaments возвращает [] для пустой БД', async () => {
  await useEmptyTestDb();
  const TournamentService = loadTournamentService();
  const tournaments = await TournamentService.getAllTournaments();
  assert.deepEqual(tournaments, []);
});

test('TournamentService.getTournamentTable кидает ошибку при отсутствии турнира', async () => {
  const { migrateAndSeed, TEST_DB_PATH } = require('./helpers/testDb');
  await migrateAndSeed();
  process.env.SQLITE_PATH = TEST_DB_PATH;
  delete require.cache[require.resolve('../../../lib/db')];

  const TournamentService = loadTournamentService();
  await assert.rejects(
    () => TournamentService.getTournamentTable('missing_tournament_xyz'),
    /Tournament table not found/
  );
});

test('PlayerService.getAvailableYears возвращает пустой массив для неизвестного игрока', async () => {
  await useEmptyTestDb();
  const PlayerService = loadPlayerService();
  const years = await PlayerService.getAvailableYears('UnknownPlayer');
  assert.deepEqual(years, []);
});

test('TournamentService.getAllTournaments читает сиды из test DB', async () => {
  const { migrateAndSeed, TEST_DB_PATH } = require('./helpers/testDb');
  await migrateAndSeed();
  process.env.SQLITE_PATH = TEST_DB_PATH;
  delete require.cache[require.resolve('../../../lib/db')];
  delete require.cache[require.resolve('../repositories/TournamentRepository')];

  const TournamentService = loadTournamentService();
  const tournaments = await TournamentService.getAllTournaments();
  assert.equal(tournaments.length, 2);
  assert.ok(tournaments.some((t) => t.id === 't1'));
});

test.after(async () => {
  try {
    const { db } = require('../../../lib/db');
    await db.destroy();
  } catch (_e) {
    /* ignore */
  }
});
