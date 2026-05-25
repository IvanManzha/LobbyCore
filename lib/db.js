// lib/db.js — основная БД (pubg_app.db), архив турниров (pubg.db), DNA-тесты (pubg_dna_test.db)
const path = require('path');
const knex = require('knex');
const config = require('../knexfile');

function getKnexEnv() {
  if (process.env.KNEX_ENV && config[process.env.KNEX_ENV]) {
    return process.env.KNEX_ENV;
  }
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'development';
}

function resolveSqlitePath(envVar, fallback) {
  const f = process.env[envVar] || fallback;
  return path.isAbsolute(f) ? f : path.resolve(process.cwd(), f);
}

function resolveSqliteFilename() {
  const env = getKnexEnv();
  const fallback =
    env === 'test' ? './data/pubg_test.db' : './data/pubg_app.db';
  return resolveSqlitePath('SQLITE_PATH', fallback);
}

function buildMainDb() {
  const knexEnv = getKnexEnv();
  const base = config[knexEnv];
  return knex({
    ...base,
    connection: { filename: resolveSqliteFilename() }
  });
}

function buildLegacyDb() {
  const env = getKnexEnv();
  if (env === 'test') return null;
  const raw = process.env.LEGACY_SQLITE_PATH;
  if (raw === 'false' || raw === '0' || raw === '') return null;
  const filename = resolveSqlitePath('LEGACY_SQLITE_PATH', './data/pubg.db');
  if (filename === resolveSqliteFilename()) return null;
  return knex({
    client: 'sqlite3',
    connection: { filename },
    useNullAsDefault: true
  });
}

const knexEnv = getKnexEnv();
const db = buildMainDb();
const dbLegacy = buildLegacyDb();

const dnaTestConfig = { ...config.dna_test };
if (process.env.DNA_TEST_SQLITE_PATH) {
  dnaTestConfig.connection = {
    filename: resolveSqlitePath('DNA_TEST_SQLITE_PATH', './data/pubg_dna_test.db')
  };
}
const dbDnaTest = knex(dnaTestConfig);

const tournamentDbCache = new Map();

/**
 * Knex для турнира: актуальная БД или архив (pubg.db). Новые id — только в актуальной.
 */
async function knexForTournament(tournamentId) {
  if (!tournamentId) return db;
  if (tournamentDbCache.has(tournamentId)) {
    return tournamentDbCache.get(tournamentId);
  }
  const inPrimary = await db('tournaments').where({ id: tournamentId }).first();
  if (inPrimary) {
    tournamentDbCache.set(tournamentId, db);
    return db;
  }
  if (dbLegacy) {
    const inLegacy = await dbLegacy('tournaments').where({ id: tournamentId }).first();
    if (inLegacy) {
      tournamentDbCache.set(tournamentId, dbLegacy);
      return dbLegacy;
    }
  }
  tournamentDbCache.set(tournamentId, db);
  return db;
}

function clearTournamentDbCache(tournamentId) {
  if (tournamentId) tournamentDbCache.delete(tournamentId);
  else tournamentDbCache.clear();
}

async function isLegacyTournament(tournamentId) {
  if (!dbLegacy || !tournamentId) return false;
  const k = await knexForTournament(tournamentId);
  return k === dbLegacy;
}

async function insertMatch(record) {
  const k = record.tournament_id
    ? await knexForTournament(record.tournament_id)
    : db;
  const [id] = await k('matches').insert(record);
  return id;
}

async function insertParticipants(rows, tournamentId) {
  if (!rows?.length) return;
  const k = tournamentId ? await knexForTournament(tournamentId) : db;
  await k('participants').insert(rows);
}

async function insertMatchDnaTest(record) {
  const [id] = await dbDnaTest('matches').insert(record);
  return id;
}

async function insertParticipantsDnaTest(rows) {
  await dbDnaTest('participants').insert(rows);
}

module.exports = {
  db,
  dbLegacy,
  dbDnaTest,
  knexEnv,
  knexForTournament,
  isLegacyTournament,
  clearTournamentDbCache,
  resolveSqliteFilename,
  insertMatch,
  insertParticipants,
  insertMatchDnaTest,
  insertParticipantsDnaTest
};
