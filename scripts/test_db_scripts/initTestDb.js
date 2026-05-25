#!/usr/bin/env node
// scripts/test_db_scripts/initTestDb.js
/**
 * Инициализация тестовой БД: копирует последние 5 матчей MixedRandom
 * (включая сырую телеметрию), участников и player_profiles,
 * переименовывая tournament_id в 'test1'.
 * Телеметрию не разбиваем — оставляем для отдельного скрипта.
 */

require('dotenv').config();
const Knex = require('knex');

// Основная (production) БД
const mainDb = Knex({
  client: 'sqlite3',
  connection: { filename: './data/pubg.db' },
  useNullAsDefault: true
});
// Тестовая БД
const testDb = Knex({
  client: 'sqlite3',
  connection: { filename: './data/pubg_test.db' },
  useNullAsDefault: true
});

async function main() {
  // 1) Очистим тестовую БД (кроме telemetry_events)
  await testDb('participants').del();
  await testDb('matches').del();
  await testDb('player_profiles').del();

  // 2) Выберем 5 последних матчей MixedRandom
  const matches = await mainDb('matches')
    .where({ tournament_id: 'MixedRandom' })
    .orderBy('played_at', 'desc')
    .limit(5)
    .select('*');

  for (const m of matches) {
    // 3) Копируем матч вместе с telemetry JSON
    const { id: oldMatchId, ...matchData } = m;
    const [newMatchId] = await testDb('matches').insert({
      ...matchData,
      tournament_id: 'test1'
    });
    console.log(`Match ${m.match_id} → test DB as id ${newMatchId}`);

    // 4) Копируем участников
    const participants = await mainDb('participants')
      .where({ match_ref: oldMatchId })
      .select('*');
    const newParts = participants.map(p => {
      const { id, match_ref, ...rest } = p;
      return { ...rest, match_ref: newMatchId };
    });
    await testDb('participants').insert(newParts);
    console.log(`  → ${newParts.length} participants copied`);
  }

  // 5) Копируем player_profiles
  const profiles = await mainDb('player_profiles').select().catch(() => []);
  if (profiles.length) {
    const newProfiles = profiles.map(p => {
      const { id, ...rest } = p;
      return rest;
    });
    await testDb('player_profiles').insert(newProfiles);
    console.log(`Player profiles copied: ${newProfiles.length}`);
  }

  await mainDb.destroy();
  await testDb.destroy();
  console.log('✅ Test DB initialized (raw telemetry copied)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

// Запуск скрипта:
// node scripts/test_db_scripts/initTestDb.js