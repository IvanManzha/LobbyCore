// scripts/db_scripts/rewrite_dna_test_all_ivanchk_matches.js
// Перезаписывает тестовую БД (pubg_dna_test.db) матчами игрока (по умолчанию IVANCHK).
// В БД пишется: матч, участники с полной статистикой API; по умолчанию телеметрия сохраняется ПОЛНОСТЬЮ.
// Legacy-режим "только игрок" можно включить флагом --player-telemetry.
//
// Usage:
//   node scripts/db_scripts/rewrite_dna_test_all_ivanchk_matches.js              # перезаписать всё
//   node scripts/db_scripts/rewrite_dna_test_all_ivanchk_matches.js [playerName]
//   node scripts/db_scripts/rewrite_dna_test_all_ivanchk_matches.js [playerName] [limit]   # например 100 матчей
//   node scripts/db_scripts/rewrite_dna_test_all_ivanchk_matches.js --add-missing   # добавить только отсутствующие
//   node scripts/db_scripts/rewrite_dna_test_all_ivanchk_matches.js -a [playerName]
//   node scripts/db_scripts/rewrite_dna_test_all_ivanchk_matches.js --player-telemetry [playerName] [limit]

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

const TOURNAMENT_ID = process.env.DNA_TEST_TOURNAMENT_ID || 'DNA_TEST';
const SHARD = 'steam';
const DEFAULT_PLAYER = 'IVANCHK';
const MAX_TELEMETRY_TOURNAMENTS = Number(process.env.DNA_TEST_MAX_TELEMETRY_TOURNAMENTS || 4);
const MAX_TELEMETRY_MATCHES = Number(process.env.DNA_TEST_MAX_TELEMETRY_MATCHES || 20);

/** Типы событий без привязки к игроку — нужны для контекста матча (время, режим). */
const GLOBAL_EVENT_TYPES = new Set([
  'logmatchstart',
  'logmatchdefinition',
  'logmatchend',
  'loggamestateperiodic'
]);

function isSameCharacter(obj, accountId, playerName) {
  if (!obj) return false;
  const id = (obj.accountId ?? obj.account_id ?? obj.AccountId ?? '').toString().trim();
  const name = (obj.name ?? obj.Name ?? '').toString().toLowerCase().trim();
  if (accountId && id && (id === accountId || id.toLowerCase() === accountId.toLowerCase())) return true;
  if (playerName && name && name.includes(playerName.toLowerCase())) return true;
  return false;
}

/**
 * Оставляет в телеметрии только события, связанные с игроком (accountId/playerName),
 * плюс глобальные события матча. В тестовой БД хранится только телеметрия одного игрока.
 */
function filterTelemetryForPlayer(telemetry, accountId, playerName) {
  if (!telemetry) return null;
  let events = Array.isArray(telemetry) ? telemetry : (telemetry.events || telemetry.Telemetry || []);
  if (!Array.isArray(events) || events.length === 0) return telemetry;

  const typeNorm = (t) => (t ? String(t).toLowerCase() : '');
  const filtered = events.filter((evt) => {
    const type = typeNorm(evt._T ?? evt.eventType ?? evt.event_type);
    if (GLOBAL_EVENT_TYPES.has(type)) return true;
    const char = evt.character ?? evt.Character;
    const attacker = evt.attacker ?? evt.Attacker;
    const victim = evt.victim ?? evt.Victim;
    const killer = evt.killer ?? evt.Killer;
    const reviver = evt.reviver ?? evt.Reviver;
    const assistant = evt.assistant ?? evt.Assistant;
    if (isSameCharacter(char, accountId, playerName)) return true;
    if (isSameCharacter(attacker, accountId, playerName)) return true;
    if (isSameCharacter(victim, accountId, playerName)) return true;
    if (isSameCharacter(killer, accountId, playerName)) return true;
    if (isSameCharacter(reviver, accountId, playerName)) return true;
    if (isSameCharacter(assistant, accountId, playerName)) return true;
    return false;
  });

  if (Array.isArray(telemetry)) return filtered;
  return { ...telemetry, events: filtered };
}

/**
 * Сохраняет один матч в dna_test с полным паком:
 * - матч (match_id, map_name, played_at, telemetry JSON — только события выбранного игрока)
 * - участники с полной статистикой (все поля attributes.stats в stats JSON)
 * @param {string} [filterPlayerAccountId] - если задан, в БД пишется только отфильтрованная телеметрия этого игрока
 * @param {string} [filterPlayerName] - имя игрока для фильтра (IVANCHK)
 */
async function saveMatchWithFullPack(matchId, matchData, telemetry, filterPlayerAccountId, filterPlayerName) {
  const attrs = matchData.data?.attributes || {};
  const played_at = attrs.createdAt;
  const map_name = attrs.mapName;

  let telemetryToSave = telemetry;
  if (telemetryToSave && filterPlayerAccountId != null) {
    telemetryToSave = filterTelemetryForPlayer(telemetryToSave, filterPlayerAccountId, filterPlayerName || '');
  }

  const existing = await dbDnaTest('matches')
    .where({ match_id: matchId })
    .first('id');

  let matchRef;
  if (existing) {
    matchRef = existing.id;
    await dbDnaTest('matches')
      .where({ id: matchRef })
      .update({
        tournament_id: TOURNAMENT_ID,
        map_name,
        played_at,
        telemetry: telemetryToSave ? JSON.stringify(telemetryToSave) : null,
        processed: true
      });
  } else {
    matchRef = await insertMatchDnaTest({
      tournament_id: TOURNAMENT_ID,
      match_id: matchId,
      shard: SHARD,
      map_name,
      played_at,
      telemetry: telemetryToSave ? JSON.stringify(telemetryToSave) : null,
      processed: true
    });
  }

  await dbDnaTest('participants').where({ match_ref: matchRef }).del();

  const participantsData = (matchData.included || []).filter(i => i.type === 'participant');
  if (participantsData.length) {
    const participantsToSave = participantsData.map(p => {
      const s = p.attributes?.stats || {};
      return {
        match_ref: matchRef,
        player_id: s.playerId,
        api_name: s.name,
        player_name: s.name,
        team_id: s.teamId,
        kills: s.kills ?? 0,
        damage: s.damageDealt ?? 0,
        placement: s.winPlace ?? 0,
        stats: JSON.stringify({
          assists: s.assists,
          timeSurvived: s.timeSurvived,
          headshotKills: s.headshotKills,
          DBNOs: s.DBNOs,
          heals: s.heals,
          boosts: s.boosts,
          killPlace: s.killPlace,
          killStreaks: s.killStreaks,
          longestKill: s.longestKill,
          revives: s.revives,
          roadKills: s.roadKills,
          teamKills: s.teamKills,
          vehicleDestroys: s.vehicleDestroys,
          walkDistance: s.walkDistance,
          rideDistance: s.rideDistance,
          swimDistance: s.swimDistance,
          weaponsAcquired: s.weaponsAcquired,
          deathType: s.deathType
        })
      };
    });
    await insertParticipantsDnaTest(participantsToSave);
  }

  return { matchRef, participantsCount: participantsData.length };
}

/**
 * Keep full telemetry only for latest tournaments/matches.
 * Old rows keep participants/stats but telemetry column becomes NULL.
 */
async function applyTelemetryRetention(knexDb, opts = {}) {
  const maxTournaments = Number(opts.maxTournaments || MAX_TELEMETRY_TOURNAMENTS);
  const maxMatches = Number(opts.maxMatches || MAX_TELEMETRY_MATCHES);
  if (maxTournaments <= 0 || maxMatches <= 0) return;

  const tourRows = await knexDb('matches')
    .whereNotNull('telemetry')
    .select('tournament_id')
    .max({ latest: 'played_at' })
    .groupBy('tournament_id')
    .orderBy('latest', 'desc');

  const keepTournamentIds = new Set(
    (tourRows || [])
      .slice(0, maxTournaments)
      .map((r) => (r.tournament_id != null ? String(r.tournament_id) : ''))
      .filter(Boolean)
  );

  const allWithTelemetry = await knexDb('matches')
    .whereNotNull('telemetry')
    .select('id', 'tournament_id', 'played_at')
    .orderBy('played_at', 'desc');

  const keepIds = [];
  for (const row of allWithTelemetry) {
    const tid = row.tournament_id != null ? String(row.tournament_id) : '';
    if (!keepTournamentIds.has(tid)) continue;
    if (keepIds.length >= maxMatches) break;
    keepIds.push(row.id);
  }

  if (keepIds.length === 0) {
    await knexDb('matches').whereNotNull('telemetry').update({ telemetry: null });
    return;
  }

  await knexDb('matches')
    .whereNotNull('telemetry')
    .whereNotIn('id', keepIds)
    .update({ telemetry: null });
}

function parseArgs() {
  const args = process.argv.slice(2);
  let addMissing = false;
  let playerTelemetryOnly = false;
  const positional = [];
  for (const arg of args) {
    if (arg === '--add-missing' || arg === '-a') addMissing = true;
    else if (arg === '--player-telemetry') playerTelemetryOnly = true;
    else if (!arg.startsWith('-')) positional.push(arg);
  }
  const playerName = (positional[0] || DEFAULT_PLAYER).toUpperCase();
  const limitRaw = positional[1];
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10)) : null;
  return { addMissing, playerName, limit, playerTelemetryOnly };
}

async function main() {
  const { addMissing, playerName, limit, playerTelemetryOnly } = parseArgs();

  let playerId;
  try {
    const profileResp = await getPlayer(SHARD, playerName);
    const profileData = profileResp.data[0];
    playerId = profileData?.attributes?.platformId || profileData?.id;
    console.log(`→ Игрок "${playerName}" UUID: ${playerId}`);
    console.log(
      playerTelemetryOnly
        ? '→ Режим: в БД сохраняется только телеметрия этого игрока (legacy).'
        : '→ Режим: в БД сохраняется ПОЛНАЯ телеметрия матча.'
    );
  } catch (err) {
    console.error('Ошибка загрузки профиля:', err.message);
    process.exit(1);
  }

  let matchIdsFromApi;
  try {
    const list = await getPlayerMatchList(SHARD, playerName);
    if (!list.length) {
      console.log(`Матчей не найдено для ${playerName}`);
      process.exit(0);
    }
    matchIdsFromApi = list;
    console.log(`→ Доступно матчей в API: ${matchIdsFromApi.length}`);
  } catch (err) {
    console.error('Ошибка загрузки списка матчей:', err.message);
    process.exit(1);
  }

  let matchIdsToProcess = matchIdsFromApi;
  if (limit != null) {
    matchIdsToProcess = matchIdsFromApi.slice(0, limit);
    console.log(`→ Лимит: ${limit} матчей (всего доступно: ${matchIdsFromApi.length})\n`);
  }
  if (addMissing) {
    const existingRows = await dbDnaTest('matches').select('match_id');
    const existingSet = new Set(existingRows.map((r) => r.match_id));
    matchIdsToProcess = matchIdsFromApi.filter((id) => !existingSet.has(id));
    if (limit != null) matchIdsToProcess = matchIdsToProcess.slice(0, limit);
    console.log(`→ В тестовой БД уже есть: ${existingSet.size}, добавим отсутствующих: ${matchIdsToProcess.length}`);
    if (matchIdsToProcess.length === 0) {
      await dbDnaTest.destroy();
      console.log('Добавлять нечего. Выход.');
      return;
    }
  } else {
    const existingMatches = await dbDnaTest('matches').select('id', 'match_id');
    for (const row of existingMatches) {
      await dbDnaTest('participants').where({ match_ref: row.id }).del();
    }
    await dbDnaTest('matches').del();
    console.log('→ Тестовая БД очищена.\n');
  }

  const savedIds = [];
  for (let i = 0; i < matchIdsToProcess.length; i++) {
    const matchId = matchIdsToProcess[i];
    try {
      const matchData = await getMatch(SHARD, matchId);
      const asset = matchData.included?.find(x => x.type === 'asset');
      const telemetry = asset?.attributes?.URL
        ? await getTelemetry(asset.attributes.URL)
        : null;
      const { matchRef, participantsCount } = await saveMatchWithFullPack(
        matchId,
        matchData,
        telemetry,
        playerTelemetryOnly ? playerId : null,
        playerTelemetryOnly ? playerName : null
      );
      savedIds.push(matchId);
      console.log(`  [${i + 1}/${matchIdsToProcess.length}] ${matchId} → id ${matchRef}, участников: ${participantsCount}, телеметрия: ${telemetry ? 'да' : 'нет'}`);
    } catch (err) {
      console.error(`  [${i + 1}/${matchIdsToProcess.length}] Ошибка матча ${matchId}:`, err.message);
    }
  }

  await applyTelemetryRetention(dbDnaTest, {
    maxTournaments: MAX_TELEMETRY_TOURNAMENTS,
    maxMatches: MAX_TELEMETRY_MATCHES,
  });
  await dbDnaTest.destroy();
  if (addMissing) {
    console.log(`\nГотово: добавлено ${savedIds.length} матч(ей) игрока ${playerName} с полным пакетом данных.`);
  } else {
    console.log(`\nГотово: в тестовой БД (pubg_dna_test.db) записано ${savedIds.length} матч(ей) игрока ${playerName} с полным пакетом данных (статистика + телеметрия).`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
