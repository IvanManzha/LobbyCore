#!/usr/bin/env node
// scripts/db_scripts/computeRawFrequencies.js
/**
 * Скрипт анализа частоты реальных точек позиций из сырых логов телеметрии
 * Для каждого игрока в каждом матче считает общее число точек и средний интервал между ними,
 * при этом прекращает учёт после смерти игрока (LogPlayerKill).
 */

require('dotenv').config();
const Knex = require('knex');

// Подключаем тестовую БД (NODE_ENV=test)
const config = require('../../knexfile')[process.env.NODE_ENV || 'development'];
const db = Knex(config);

function toMs(iso) {
  return new Date(iso).getTime();
}

async function main() {
  const matches = await db('matches')
    .select('id as matchRef', 'telemetry')
    .whereNotNull('telemetry');

  for (const { matchRef, telemetry } of matches) {
    console.log(`\nMatch ${matchRef}`);
    let raw;
    try {
      raw = JSON.parse(telemetry);
    } catch (e) {
      console.error(`  JSON parse error: ${e.message}`);
      continue;
    }
    const events = Array.isArray(raw.events) ? raw.events : Array.isArray(raw) ? raw : [];

    // Собираем по игрокам точки и фиксируем время смерти
    const freq = {};
    const deathTime = {};
    for (const evt of events) {
      const t = evt._D || evt.eventTime;
      // 1) Событие смерти: LogPlayerKill
      if (evt._T === 'LogPlayerKill' && evt.victim && evt.victim.name) {
        const name = evt.victim.name;
        const ms = toMs(t);
        if (!deathTime[name] || ms < toMs(deathTime[name])) {
          deathTime[name] = t;
        }
      }
      // 2) Позиционные точки
      const ch = evt.character;
      if (!ch || !ch.location) continue;
      const name = ch.name;
      if (!freq[name]) freq[name] = [];
      freq[name].push(t);
    }

    // Вычисляем и печатаем
    for (const [name, times] of Object.entries(freq)) {
      // Фильтруем по времени смерти, если есть
      const deathT = deathTime[name] ? toMs(deathTime[name]) : Infinity;
      const filtered = times
        .map(t => ({ t, ms: toMs(t) }))
        .filter(o => o.ms <= deathT)
        .sort((a, b) => a.ms - b.ms);

      if (filtered.length < 2) {
        console.log(`  Player ${name}: ${filtered.length} points`);
        continue;
      }

      let total = 0;
      for (let i = 1; i < filtered.length; i++) {
        total += (filtered[i].ms - filtered[i-1].ms);
      }
      const avg = total / (filtered.length - 1) / 1000; // в секундах
      console.log(`  Player ${name}: ${filtered.length} points, avg interval ${avg.toFixed(2)}s`);
    }
  }

  await db.destroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

// Запуск скрипта:
// NODE_ENV=test node scripts/db_scripts/computeRawFrequencies.js