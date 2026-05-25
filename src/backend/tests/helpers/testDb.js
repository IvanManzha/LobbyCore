/**
 * Миграции и сиды для NODE_ENV=test (до require server / lib/db).
 */
const path = require('path');
const fs = require('fs');
const knex = require('knex');
const config = require('../../../../knexfile');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'data');
const E2E_FIXTURES_DIR = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'data');
const TEST_DB_PATH = path.join(__dirname, '..', 'fixtures', 'test.db');
const E2E_TEST_DB_PATH = path.join(__dirname, '..', 'fixtures', 'test_e2e.db');

function getTestDbPath() {
  return TEST_DB_PATH;
}

async function migrateAndSeed(fixturesDir = FIXTURES_DIR, dbPath = TEST_DB_PATH) {
  return (async () => {
    process.env.NODE_ENV = 'test';
    process.env.KNEX_ENV = 'test';
    process.env.SQLITE_PATH = dbPath;
    process.env.LEGACY_SQLITE_PATH = 'false';
    process.env.DATA_DIR = fixturesDir;
    process.env.TOURNAMENTS_PATH = path.join(fixturesDir, 'tournaments.json');
    process.env.TOURNAMENTS_DIR = path.join(fixturesDir, 'tournaments');
    process.env.PLAYERS_DIR = path.join(fixturesDir, 'players');

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    const knexfilePath = require.resolve('../../../../knexfile');
    const dbModulePath = require.resolve('../../../../lib/db');
    delete require.cache[knexfilePath];
    delete require.cache[dbModulePath];

    const db = knex({
      ...config.test,
      connection: { filename: dbPath }
    });
    await db.migrate.latest();
    await db('tournament_teams').del();
    await db('tournaments').del();

    const tournaments = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'tournaments.json'), 'utf8')
    );

    for (const t of tournaments) {
      const extra = {};
      if (t.finance) extra.finance = t.finance;
      await db('tournaments').insert({
        id: t.id,
        name: t.name,
        date: t.date,
        type: t.type,
        state: t.state,
        price: t.price != null ? t.price : null,
        rounds: t.rounds != null ? t.rounds : 5,
        played_rounds: t.playedRounds != null ? t.playedRounds : 0,
        extra: Object.keys(extra).length ? JSON.stringify(extra) : null
      });

      const tablePath = path.join(fixturesDir, 'tournaments', t.id, 'table.json');
      if (!fs.existsSync(tablePath)) continue;
      const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
      for (const team of table.teams || []) {
        await db('tournament_teams').insert({
          tournament_id: t.id,
          name: team.name,
          rank: team.rank != null ? team.rank : 0,
          total_points: team.totalPoints != null ? team.totalPoints : 0,
          players: team.players ? JSON.stringify(team.players) : null,
          budget: team.budget ? JSON.stringify(team.budget) : null,
          results: team.results ? JSON.stringify(team.results) : null,
          player_kills: team.playerKills ? JSON.stringify(team.playerKills) : null,
          player_deaths: team.playerDeaths ? JSON.stringify(team.playerDeaths) : null
        });
      }
    }

    await db.destroy();
  })();
}

module.exports = {
  migrateAndSeed,
  getTestDbPath,
  FIXTURES_DIR,
  E2E_FIXTURES_DIR,
  TEST_DB_PATH,
  E2E_TEST_DB_PATH
};
