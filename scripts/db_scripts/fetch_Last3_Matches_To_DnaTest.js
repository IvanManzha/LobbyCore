// scripts/db_scripts/fetch_Last3_Matches_To_DnaTest.js
// Загружает последние N матчей игрока через PUBG API и записывает в тестовую БД (pubg_dna_test.db).
// Существующие матчи перезаписываются; в тестовой БД остаются только эти N матчей.
//
// Usage:
//   node scripts/db_scripts/fetch_Last3_Matches_To_DnaTest.js [playerName]
//   node scripts/db_scripts/fetch_Last3_Matches_To_DnaTest.js --count 5 [playerName]
//   node scripts/db_scripts/fetch_Last3_Matches_To_DnaTest.js -n 5 Ivanchk
//
// Опции:
//   --count N, -n N   сколько матчей сохранять (по умолчанию 1)
//
// Порядок: первый матч в списке API считается последним (самым новым); остальные — по убыванию давности.

require('dotenv').config();
const {
  getPlayer,
  getPlayerMatchList,
  getMatch,
  getTelemetry
} = require('../../services/pubgApi');
const {
  dbDnaTest,
  insertMatchDnaTest,
  insertParticipantsDnaTest
} = require('../../lib/db');

const TOURNAMENT_ID = 'DNA_TEST';
const SHARD = 'steam';
const DEFAULT_COUNT = 1;

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
  const existing = await dbDnaTest('matches')
    .where({ match_id: matchId })
    .first('id');

  let matchRef;
  if (existing) {
    matchRef = existing.id;
    await dbDnaTest('matches')
      .where({ id: matchRef })
      .update({
        map_name,
        played_at,
        telemetry: telemetry ? JSON.stringify(telemetry) : null,
        processed: true
      });
  } else {
    matchRef = await insertMatchDnaTest({
      tournament_id: TOURNAMENT_ID,
      match_id: matchId,
      shard: SHARD,
      map_name,
      played_at,
      telemetry: telemetry ? JSON.stringify(telemetry) : null,
      processed: true
    });
  }

  await dbDnaTest('participants').where({ match_ref: matchRef }).del();
  const participantsData = (matchData.included || []).filter(i => i.type === 'participant');
  if (participantsData.length) {
    const participantsToSave = participantsData.map(p => ({
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
        headshotKills: p.attributes.stats.headshotKills
      })
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
    // Первый в списке API = последний по времени (самый новый)
    matchIds = matches.slice(0, lastN);
    console.log(`→ Последние ${lastN} матч(ей) (первый = последний по времени): ${matchIds.join(', ')}`);
  } catch (err) {
    console.error('Ошибка загрузки списка матчей:', err.message);
    process.exit(1);
  }

  const savedIds = [];
  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
    try {
      const matchData = await getMatch(SHARD, matchId);
      const asset = matchData.included?.find(i => i.type === 'asset');
      const telemetry = asset?.attributes?.URL
        ? await getTelemetry(asset.attributes.URL)
        : null;
      const { matchRef, participantsCount } = await saveMatchToDnaTest(matchId, matchData, telemetry);
      savedIds.push(matchId);
      console.log(`  [${i + 1}/${lastN}] Матч ${matchId} → dna_test (id ${matchRef}, участников: ${participantsCount})`);
    } catch (err) {
      console.error(`  [${i + 1}/${LAST_N}] Ошибка матча ${matchId}:`, err.message);
    }
  }

  // В тестовой БД оставляем только эти матчи — остальные удаляем
  const toDelete = await dbDnaTest('matches')
    .whereNotIn('match_id', savedIds)
    .select('id', 'match_id');
  for (const row of toDelete) {
    await dbDnaTest('participants').where({ match_ref: row.id }).del();
    await dbDnaTest('matches').where({ id: row.id }).del();
    console.log(`  Удалён старый матч из dna_test: ${row.match_id}`);
  }

  await dbDnaTest.destroy();
  console.log(`\nГотово: в тестовой БД записаны последние ${savedIds.length} матч(ей) игрока ${playerName}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
