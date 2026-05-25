#!/usr/bin/env node
// scripts/analysis/speedAnalysis.js

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

// Настройки
const DB_PATH       = process.argv[2] || 'data/pubg_test.db';
const EVENT_TYPE    = 'LogPlayerPosition';
const thresholdSpeed = parseFloat(process.argv[3]) || 8.0; // м/с

(async()=>{
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, e => {
    if (e) {
      console.error('Cannot open DB:', e.message);
      process.exit(1);
    }
  });

  // 1) Найти participant_ref с максимальным числом точек
  const maxPart = await new Promise((res, rej) => {
    db.get(
      `SELECT participant_ref, COUNT(*) AS cnt
       FROM telemetry_events
       WHERE event_type = ?
         AND participant_ref IS NOT NULL
       GROUP BY participant_ref
       ORDER BY cnt DESC
       LIMIT 1`,
      [EVENT_TYPE],
      (e,row) => e ? rej(e) : res(row)
    );
  });
  if (!maxPart) {
    console.error('No LogPlayerPosition events found.');
    db.close();
    return;
  }
  console.log(`→ Анализ участника ${maxPart.participant_ref} с ${maxPart.cnt} точками`);

  // 2) Загрузить первые N точек
  const N = 1000;
  const rows = await new Promise((res, rej) => {
    db.all(
      `SELECT event_time,
              json_extract(event_data, '$.character.location.x') AS x,
              json_extract(event_data, '$.character.location.y') AS y,
              json_extract(event_data, '$.character.location.z') AS z
       FROM telemetry_events
       WHERE event_type = ?
         AND participant_ref = ?
       ORDER BY event_time
       LIMIT ?`,
      [EVENT_TYPE, maxPart.participant_ref, N],
      (e, data) => e ? rej(e) : res(data)
    );
  });

  // 3) Парсим и считаем скорости
  const speeds = [];
  let prev = null;
  for (const r of rows) {
    const t = Date.parse(r.event_time);
    if (isNaN(t) || r.x == null || r.y == null || r.z == null) {
      prev = null;
      continue;
    }
    const curr = { t: t/1000, x: r.x, y: r.y, z: r.z };
    if (prev) {
      const dt = curr.t - prev.t;
      if (dt > 0) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dz = curr.z - prev.z;
        speeds.push(Math.sqrt(dx*dx + dy*dy + dz*dz) / dt);
      }
    }
    prev = curr;
  }
  db.close();

  if (!speeds.length) {
    console.log('Нечего анализировать — нет подряд идущих точек.');
    return;
  }

  // 4) Статистика
  const total  = speeds.length;
  const slow   = speeds.filter(v => v <= thresholdSpeed).length;
  const minV   = Math.min(...speeds).toFixed(2);
  const maxV   = Math.max(...speeds).toFixed(2);
  const avgV   = (speeds.reduce((a,b)=>a+b,0)/total).toFixed(2);

  console.log(`Анализ ${total} скоростей (порог ${thresholdSpeed} м/с):`);
  console.log(`  • «Медленных» точек: ${slow} (${(slow/total*100).toFixed(1)}%)`);
  console.log(`  • Минимальная скорость: ${minV} м/с`);
  console.log(`  • Максимальная скорость: ${maxV} м/с`);
  console.log(`  • Средняя скорость:     ${avgV} м/с`);
})();
