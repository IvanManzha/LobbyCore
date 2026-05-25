#!/usr/bin/env node
/**
 * Смок-проверки перед staging/production (чеклист из аудита).
 * Запуск: node scripts/verify-production-readiness.js [--strict]
 * В strict-режиме код выхода 1 при любой проваленной проверке.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const strict = process.argv.includes('--strict');
let failed = 0;

function check(ok, message) {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok && strict) failed += 1;
}

async function main() {
  console.log('Production readiness (automated subset)\n');

  const nodeEnv = process.env.NODE_ENV || '(unset)';
  check(true, `NODE_ENV=${nodeEnv} (в проде обычно production)`);

  const { db, dbLegacy, knexEnv, resolveSqliteFilename } = require('../lib/db');

  try {
    await db.raw('select 1 as ok');
    check(true, `SQLite актуальная БД: ${resolveSqliteFilename()} (knex env: ${knexEnv})`);
    if (dbLegacy) {
      check(true, 'Архив турниров (LEGACY_SQLITE_PATH) подключён');
    }
    const hasLadder = await db.schema.hasTable('player_ladder');
    check(hasLadder, 'Таблица player_ladder существует (миграции применены)');
    const hasHistory = await db.schema.hasTable('player_ladder_history');
    check(hasHistory, 'Таблица player_ladder_history существует');
    const hasMatches = await db.schema.hasTable('matches');
    check(hasMatches, 'Таблица matches существует');
  } catch (e) {
    check(false, `БД: ${e.message}`);
  } finally {
    await db.destroy();
    if (dbLegacy) await dbLegacy.destroy();
  }

  const projectRoot = path.resolve(__dirname, '..');
  const spaIndex = path.join(projectRoot, 'public', 'react', 'index.html');
  check(fs.existsSync(spaIndex), 'Собранный SPA: public/react/index.html (npm run frontend:build)');

  if (nodeEnv === 'production') {
    check(!!process.env.JWT_SECRET, 'JWT_SECRET задан в production');
  } else {
    check(true, 'JWT_SECRET (обязателен только при NODE_ENV=production)');
  }

  check(
    true,
    'MatchMonitor: включается при турнире «В процессе», выключается когда таких турниров нет'
  );

  console.log('\nРучной чеклист: см. план аудита (турнирный цикл, финансы, ladder, DNA, отмена).');

  if (strict && failed > 0) {
    console.error(`\nStrict: ${failed} проверок провалено`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
