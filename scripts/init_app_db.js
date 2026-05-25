#!/usr/bin/env node
/**
 * Инициализация актуальной БД (pubg_app.db): миграции + копия игроков/ladder/DNA из pubg.db.
 * Турниры и tournament_teams в pubg.db не копируются (архив).
 *
 * Запуск: node scripts/init_app_db.js
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const knex = require('knex');
const config = require('../knexfile');

const projectRoot = path.resolve(__dirname, '..');
const appDbPath = path.resolve(
  projectRoot,
  process.env.SQLITE_PATH || './data/pubg_app.db'
);
const legacyDbPath = path.resolve(
  projectRoot,
  process.env.LEGACY_SQLITE_PATH || './data/pubg.db'
);

const COPY_TABLES = [
  'player_profiles',
  'player_ladder',
  'player_ladder_history',
  'dna_profiles',
  'dna_baselines',
  'dna_pool_stats',
  'player_dna_rating_history',
  'metric_records',
  'player_stats_cache'
];

async function tableExists(k, name) {
  return k.schema.hasTable(name);
}

async function copyTable(legacy, app, tableName) {
  if (!(await tableExists(legacy, tableName))) {
    console.log(`  skip ${tableName} (нет в архиве)`);
    return 0;
  }
  if (!(await tableExists(app, tableName))) {
    console.log(`  skip ${tableName} (нет в актуальной БД — проверьте миграции)`);
    return 0;
  }
  const existing = await app(tableName).count('* as c').first();
  if (Number(existing?.c) > 0) {
    console.log(`  skip ${tableName} (уже ${existing.c} строк)`);
    return 0;
  }
  const rows = await legacy(tableName).select('*');
  if (!rows.length) {
    console.log(`  ${tableName}: пусто в архиве`);
    return 0;
  }
  const chunk = 100;
  for (let i = 0; i < rows.length; i += chunk) {
    await app(tableName).insert(rows.slice(i, i + chunk));
  }
  console.log(`  ${tableName}: скопировано ${rows.length}`);
  return rows.length;
}

async function main() {
  if (!fs.existsSync(legacyDbPath)) {
    console.error(`Архив не найден: ${legacyDbPath}`);
    process.exit(1);
  }

  console.log(`Актуальная БД: ${appDbPath}`);
  console.log(`Архив:         ${legacyDbPath}\n`);

  const appKnex = knex({
    ...config.development,
    connection: { filename: appDbPath }
  });

  console.log('Миграции…');
  await appKnex.migrate.latest();

  const legacyKnex = knex({
    client: 'sqlite3',
    connection: { filename: legacyDbPath },
    useNullAsDefault: true
  });

  console.log('\nКопирование данных (без tournaments / tournament_teams / matches)…');
  let total = 0;
  for (const table of COPY_TABLES) {
    total += await copyTable(legacyKnex, appKnex, table);
  }

  const tourCount = await appKnex('tournaments').count('* as c').first();
  const legacyTourCount = await legacyKnex('tournaments').count('* as c').first();

  console.log(`\nГотово. Скопировано записей: ${total}`);
  console.log(`Турниры в актуальной БД: ${tourCount?.c ?? 0} (новые создаются здесь)`);
  console.log(`Турниры в архиве pubg.db: ${legacyTourCount?.c ?? 0} (только чтение в API)`);

  await appKnex.destroy();
  await legacyKnex.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
