#!/usr/bin/env node
/**
 * Проверка содержимого основной БД (pubg.db) и тестовой БД (pubg_dna_test.db).
 * Запуск из корня проекта: node scripts/check_dbs.js
 */
require('dotenv').config();
const path = require('path');
const knex = require('knex');
const config = require('../knexfile');

const projectRoot = path.resolve(__dirname, '..');
const db = knex({
  ...config.development,
  connection: { filename: path.join(projectRoot, 'data', 'pubg.db') },
});
const dbDnaTest = knex({
  ...config.dna_test,
  connection: { filename: path.join(projectRoot, 'data', 'pubg_dna_test.db') },
});

async function getTableList(knexInstance) {
  try {
    const rows = await knexInstance.raw(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    return (rows && rows[0]) ? rows[0].map((r) => r.name) : [];
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log('=== Основная БД (data/pubg.db) ===\n');

  try {
    const devTables = await getTableList(db);
    console.log('Таблицы:', devTables.join(', ') || '(нет)');

    if (devTables.includes('matches')) {
      const matchCount = await db('matches').count('* as c').first();
      console.log('matches:', matchCount?.c ?? 0);
    }
    if (devTables.includes('participants')) {
      const partCount = await db('participants').count('* as c').first();
      console.log('participants:', partCount?.c ?? 0);
    }
    if (devTables.includes('dna_profiles')) {
      const profileCount = await db('dna_profiles').count('* as c').first();
      const seasons = await db('dna_profiles').distinct('season_id').pluck('season_id');
      const bySeason = await db('dna_profiles').select('season_id').count('* as c').groupBy('season_id');
      console.log('dna_profiles всего:', profileCount?.c ?? 0);
      console.log('dna_profiles по сезонам:', bySeason.map((r) => `${r.season_id}=${r.c}`).join(', ') || '(нет)');
      if (seasons.length) {
        const sample = await db('dna_profiles').where('season_id', seasons[0]).limit(5).select('player_id');
        console.log('пример player_id (сезон ' + seasons[0] + '):', sample.map((r) => r.player_id).join(', '));
      }
    }
    if (devTables.includes('tournaments')) {
      const tCount = await db('tournaments').count('* as c').first();
      console.log('tournaments:', tCount?.c ?? 0);
    }
    if (devTables.includes('player_profiles')) {
      const pCount = await db('player_profiles').count('* as c').first();
      console.log('player_profiles:', pCount?.c ?? 0);
    }
  } catch (e) {
    console.log('Ошибка основной БД:', e.message);
  }

  console.log('\n=== Тестовая БД (data/pubg_dna_test.db) ===\n');

  try {
    const testTables = await getTableList(dbDnaTest);
    console.log('Таблицы:', testTables.join(', ') || '(нет)');

    if (testTables.includes('matches')) {
      const matchCount = await dbDnaTest('matches').count('* as c').first();
      console.log('matches:', matchCount?.c ?? 0);
    }
    if (testTables.includes('participants')) {
      const partCount = await dbDnaTest('participants').count('* as c').first();
      console.log('participants:', partCount?.c ?? 0);
    }
    if (testTables.includes('dna_profiles')) {
      const profileCount = await dbDnaTest('dna_profiles').count('* as c').first();
      const bySeason = await dbDnaTest('dna_profiles').select('season_id').count('* as c').groupBy('season_id');
      console.log('dna_profiles всего:', profileCount?.c ?? 0);
      console.log('dna_profiles по сезонам:', bySeason.map((r) => `${r.season_id}=${r.c}`).join(', ') || '(нет)');
      const allProfiles = await dbDnaTest('dna_profiles').select('player_id', 'season_id');
      if (allProfiles.length) {
        console.log('Профили (player_id, season_id):', allProfiles.map((p) => `${p.player_id}/${p.season_id}`).join(', '));
        const one = await dbDnaTest('dna_profiles').first('data');
        if (one && one.data) {
          const data = typeof one.data === 'string' ? JSON.parse(one.data) : one.data;
          const mh = data.matchHistory || data.matches || [];
          console.log('В одном профиле (data): matchHistory/matches длина =', mh.length);
        }
      }
    } else {
      console.log('dna_profiles: таблицы нет');
    }
  } catch (e) {
    console.log('Ошибка тестовой БД:', e.message);
  }

  await db.destroy();
  await dbDnaTest.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
