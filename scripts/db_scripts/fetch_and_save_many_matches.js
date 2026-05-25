#!/usr/bin/env node
// scripts/db_scripts/fetch_and_save_many_matches.js
// ⚠️ DEPRECATED: Этот скрипт устарел. Используйте автоматический мониторинг через MatchMonitorService.
// Мониторинг запускается автоматически при нажатии "Начать турнир" в UI.

/**
 * Скрипт пакетно загружает и сохраняет в БД N матчей игрока IVANCHK,
 * начиная сразу после (более новых), чем заданный matchId.
 *
 * Usage:
 *   NODE_ENV=production node scripts/db_scripts/fetch_and_save_many_matches.js \
 *     <tournamentId> <startMatchId> <count>
 *
 * Пример:
 *   NODE_ENV=test node scripts/db_scripts/fetch_and_save_many_matches.js \
 *     HotDrop edbab25e-e10b-4cc8-95d1-56ff279ff731 4
 */

require('dotenv').config();
const { getPlayer, getPlayerMatchList, getMatch, getTelemetry } = require('../../services/pubgApi');
const { insertMatch, insertParticipants, db } = require('../../lib/db');

async function main() {
  const [ , , tournamentId, startMatchId, countArg ] = process.argv;
  const count = parseInt(countArg, 10);

  if (!tournamentId || !startMatchId || isNaN(count)) {
    console.error('Usage: node fetch_and_save_many_matches.js <tournamentId> <startMatchId> <count>');
    process.exit(1);
  }

  const shard = 'steam';
  const playerName = 'IVANCHK';

  // 1) Получаем UUID игрока
  let playerId;
  try {
    const resp = await getPlayer(shard, playerName);
    const data = resp.data[0];
    playerId = data.attributes.platformId || data.id;
    console.log(`→ Player "${playerName}" UUID: ${playerId}`);
  } catch (err) {
    console.error('Failed to fetch player profile:', err.message);
    process.exit(1);
  }

  // 2) Получаем ВСЕ матчи в хронологическом порядке (API отдаёт newest first)
  let allMatches;
  try {
    allMatches = await getPlayerMatchList(shard, playerName);
  } catch (err) {
    console.error('Failed to fetch match list:', err.message);
    process.exit(1);
  }

  // 3) Находим позицию стартового матча
  const idx = allMatches.findIndex(id => id === startMatchId);
  if (idx < 0) {
    console.error(`Start matchId ${startMatchId} not found in player's history.`);
    process.exit(1);
  }

  // 4) Берём следующие N матчей **более новые**, т.е. с индексами [idx-N ... idx-1]
  const start = Math.max(0, idx - count);
  const toFetch = allMatches.slice(start, idx);
  if (toFetch.length === 0) {
    console.log('Нет более новых матчей после указанного, нечего сохранить.');
    process.exit(0);
  }
  console.log(`→ Will fetch ${toFetch.length} more recent match(es):`, toFetch);

  // 5) Обрабатываем каждый матч
  for (const externalMatchId of toFetch) {
    console.log(`\n=== Processing ${externalMatchId} ===`);
    let matchData, matchRef;

    // 5.1) Fetch match details
    try {
      matchData = await getMatch(shard, externalMatchId);
    } catch (err) {
      console.error(`  ✗ getMatch failed: ${err.message}`);
      continue;
    }

    // 5.2) Проверяем, есть ли уже в БД
    const existing = await db('matches')
      .where({ tournament_id: tournamentId, match_id: externalMatchId })
      .first('id');

    if (existing) {
      matchRef = existing.id;
      console.log(`  • Already exists as matchRef=${matchRef}, skipping insert`);
    } else {
      // 5.3) Собираем поля для вставки
      const { createdAt: played_at, mapName: map_name } = matchData.data.attributes;
      const asset = matchData.included.find(i => i.type === 'asset');
      let telemetry = null;
      if (asset) {
        try {
          telemetry = await getTelemetry(asset.attributes.URL);
        } catch (err) {
          console.warn(`  • getTelemetry failed: ${err.message}`);
        }
      }

      // 5.4) Вставляем match
      try {
        matchRef = await insertMatch({
          tournament_id: tournamentId,
          match_id:      externalMatchId,
          shard,
          map_name,
          played_at,
          telemetry: telemetry ? JSON.stringify(telemetry) : null,
          processed:   true
        });
        console.log(`  ✓ Inserted matchRef=${matchRef}`);
      } catch (err) {
        console.error(`  ✗ insertMatch failed: ${err.message}`);
        continue;
      }
    }

    // 5.5) Собираем и вставляем участников
    try {
      const participantsData = matchData.included.filter(i => i.type === 'participant');
      const participantsToSave = participantsData.map(p => ({
        match_ref:   matchRef,
        player_id:   p.attributes.stats.playerId,
        api_name:    p.attributes.stats.name,
        player_name: p.attributes.stats.name,
        team_id:     p.attributes.stats.teamId,
        kills:       p.attributes.stats.kills,
        damage:      p.attributes.stats.damageDealt,
        placement:   p.attributes.stats.winPlace,
        stats:       JSON.stringify({
          assists:       p.attributes.stats.assists,
          timeSurvived:  p.attributes.stats.timeSurvived,
          headshotKills: p.attributes.stats.headshotKills
        })
      }));

      if (participantsToSave.length) {
        await db('participants').where({ match_ref: matchRef }).del();
        await insertParticipants(participantsToSave);
        console.log(`  ✓ Saved ${participantsToSave.length} participant(s)`);
      } else {
        console.log('  • No participants to save');
      }
    } catch (err) {
      console.error(`  ✗ insertParticipants failed: ${err.message}`);
      continue;
    }
  }

  await db.destroy();
  console.log('\nAll done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
