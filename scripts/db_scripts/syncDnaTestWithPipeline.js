#!/usr/bin/env node
// Перезаписывает тестовую БД (pubg_dna_test.db): загружает последние N матчей игрока (по умолчанию IVANCHK),
// сохраняет матч+телеметрию+участников в dna_test, пишет телеметрию в data/pubg/telemetry для совместимости,
// запускает полный ingest в file store (data/pubg/matches/<matchId>/) для треков и событий карты.
// После этого в DNA Lab при выборе «использовать матчи из тестовой БД» подтягиваются гены и карта (треки/события/смерти).
//
// Usage:
//   node scripts/db_scripts/syncDnaTestWithPipeline.js [playerName]
//   node scripts/db_scripts/syncDnaTestWithPipeline.js --count 5 [playerName]
//   npm run dna-test:sync -- --count 5 IVANCHK

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const {
  getPlayer,
  getPlayerMatchList,
  getMatch,
  getTelemetry,
} = require('../../services/pubgApi');
const {
  dbDnaTest,
  insertMatchDnaTest,
  insertParticipantsDnaTest,
} = require('../../lib/db');
const { getPubgTelemetryPath } = require('../../src/backend/config/dataPaths');
const { ingestMatchFull } = require('../../src/backend/services/pubg/telemetryMetricsPipeline');

const TOURNAMENT_ID = 'DNA_TEST';
const SHARD = 'steam';
const DEFAULT_COUNT = 5;

function parseArgs() {
  const args = process.argv.slice(2);
  let count = DEFAULT_COUNT;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--count' || arg === '-n') {
      const next = args[i + 1];
      if (next != null && /^\d+$/.test(next)) {
        count = Math.max(1, parseInt(next, 10));
        i++;
      }
    } else if (arg.startsWith('--count=')) {
      const n = parseInt(arg.slice(8), 10);
      if (!isNaN(n) && n >= 1) count = n;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }
  const playerName = (positional[0] || 'IVANCHK').toUpperCase();
  return { count, playerName };
}

async function saveMatchToDnaTest(matchId, matchData, telemetry) {
  const { createdAt: played_at, mapName: map_name } = matchData.data.attributes;
  const existing = await dbDnaTest('matches').where({ match_id: matchId }).first('id');
  let matchRef;
  if (existing) {
    matchRef = existing.id;
    await dbDnaTest('matches')
      .where({ id: matchRef })
      .update({
        map_name,
        played_at,
        telemetry: telemetry ? JSON.stringify(telemetry) : null,
        processed: true,
      });
  } else {
    matchRef = await insertMatchDnaTest({
      tournament_id: TOURNAMENT_ID,
      match_id: matchId,
      shard: SHARD,
      map_name,
      played_at,
      telemetry: telemetry ? JSON.stringify(telemetry) : null,
      processed: true,
    });
  }
  await dbDnaTest('participants').where({ match_ref: matchRef }).del();
  const participantsData = (matchData.included || []).filter((i) => i.type === 'participant');
  if (participantsData.length) {
    const participantsToSave = participantsData.map((p) => ({
      match_ref: matchRef,
      player_id: p.attributes.stats.playerId,
      api_name: p.attributes.stats.name,
      player_name: p.attributes.stats.name,
      team_id: p.attributes.stats.teamId,
      kills: p.attributes.stats.kills,
      damage: p.attributes.stats.damageDealt,
      placement: p.attributes.stats.winPlace,
      stats: JSON.stringify({
        assists: p.attributes.stats.assists,
        timeSurvived: p.attributes.stats.timeSurvived,
        headshotKills: p.attributes.stats.headshotKills,
      }),
    }));
    await insertParticipantsDnaTest(participantsToSave);
  }
  return { matchRef, participantsCount: participantsData.length };
}

async function main() {
  const { count: lastN, playerName } = parseArgs();

  let playerId;
  try {
    const profileResp = await getPlayer(SHARD, playerName);
    const profileData = profileResp.data[0];
    playerId = profileData.attributes?.platformId || profileData.id;
    console.log(`→ Игрок "${playerName}" UUID: ${playerId}`);
  } catch (err) {
    console.error('Ошибка загрузки профиля:', err.message);
    process.exit(1);
  }

  let matchIds;
  try {
    const matches = await getPlayerMatchList(SHARD, playerName);
    if (!matches.length) {
      console.log(`Матчей не найдено для ${playerName}`);
      process.exit(0);
    }
    matchIds = matches.slice(0, lastN);
    console.log(`→ Последние ${lastN} матч(ей): ${matchIds.join(', ')}`);
  } catch (err) {
    console.error('Ошибка списка матчей:', err.message);
    process.exit(1);
  }

  // Очищаем тестовую БД: удаляем все матчи и участников
  const existingMatches = await dbDnaTest('matches').select('id', 'match_id');
  for (const row of existingMatches) {
    await dbDnaTest('participants').where({ match_ref: row.id }).del();
    await dbDnaTest('matches').where({ id: row.id }).del();
  }
  console.log(`→ Тестовая БД очищена (удалено матчей: ${existingMatches.length})\n`);

  const savedIds = [];
  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
    try {
      const matchData = await getMatch(SHARD, matchId);
      const asset = matchData.included?.find((x) => x.type === 'asset');
      const telemetry = asset?.attributes?.URL ? await getTelemetry(asset.attributes.URL) : null;

      const { matchRef, participantsCount } = await saveMatchToDnaTest(matchId, matchData, telemetry);
      savedIds.push(matchId);
      console.log(`  [${i + 1}/${lastN}] ${matchId} → dna_test (id ${matchRef}, участников: ${participantsCount})`);

      if (telemetry) {
        const telemetryPath = getPubgTelemetryPath(matchId);
        const dir = path.dirname(telemetryPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(telemetryPath, JSON.stringify(telemetry, null, 0), 'utf8');
      }

      const fullResult = await ingestMatchFull(matchId, SHARD);
      if (fullResult.success) {
        console.log(`         file store: OK (players: ${fullResult.coverage?.players ?? '-'})`);
      } else {
        console.log(`         file store: ${fullResult.error || 'fail'}`);
      }
    } catch (err) {
      console.error(`  [${i + 1}/${lastN}] Ошибка матча ${matchId}:`, err.message);
    }
  }

  await dbDnaTest.destroy();
  console.log(`\nГотово. В тестовой БД ${savedIds.length} матч(ей). В DNA Lab включите «Use test DB» — гены и карта подтянутся из этих матчей.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
