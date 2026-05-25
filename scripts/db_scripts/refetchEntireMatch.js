#!/usr/bin/env node
// scripts/db_scripts/refetchEntireMatch.js
// ⚠️ DEPRECATED: Этот скрипт устарел. Используйте автоматический мониторинг через MatchMonitorService.
// Оставлен для случаев, когда нужно вручную исправить данные матча.

/**
 * Полный рефетч конкретного матча по внешнему match_id и внутреннему matchRef.
 *
 * Usage:
 *   NODE_ENV=production node scripts/db_scripts/refetchEntireMatch.js \
 *     <tournamentId> <externalMatchId> <matchRef>
 */

require('dotenv').config();
const { getMatch, getTelemetry } = require('../../services/pubgApi');
const { insertMatch, insertParticipants, db } = require('../../lib/db');

async function main() {
  const [ , , tournamentId, externalMatchId, matchRefArg ] = process.argv;
  const shard = 'steam';

  if (!tournamentId || !externalMatchId || !matchRefArg) {
    console.error('Usage: node refetchEntireMatch.js <tournamentId> <externalMatchId> <matchRef>');
    process.exit(1);
  }
  const matchRef = Number(matchRefArg);

  console.log(`→ Re-fetching match ${externalMatchId} into slot #${matchRef} for tournament "${tournamentId}"`);

  // 1) Удаляем старые записи в рамках транзакции
  await db.transaction(async trx => {
    console.log('   • Deleting telemetry_events for this match...');
    const partIds = await trx('participants')
      .where({ match_ref: matchRef })
      .pluck('id');
    if (partIds.length) {
      await trx('telemetry_events')
        .whereIn('participant_ref', partIds)
        .del();
    }

    console.log('   • Deleting participants...');
    await trx('participants')
      .where({ match_ref: matchRef })
      .del();

    console.log('   • Deleting match row...');
    await trx('matches')
      .where({ id: matchRef })
      .del();
  });

  // 2) Фетчим матч из PUBG API
  let apiResp;
  try {
    apiResp = await getMatch(shard, externalMatchId);
    console.log('   • Fetched match data from API');
  } catch (err) {
    console.error('✗ Error fetching match:', err.message);
    process.exit(1);
  }

  // 3) Распаковываем data и included
  const matchObj    = apiResp.data;      // { id, type, attributes: {...} }
  const includedArr = apiResp.included;  // [ { type:'asset', ... }, {type:'participant', ...}, ... ]

  // 4) Телеметрия
  let telemetry = null;
  try {
    const asset = includedArr.find(i => i.type === 'asset');
    if (asset?.attributes?.URL) {
      const t = await getTelemetry(asset.attributes.URL);
      telemetry = JSON.stringify(t);
      console.log('   • Fetched telemetry');
    }
  } catch (err) {
    console.warn('! Warning: failed to fetch telemetry:', err.message);
  }

  // 5) Вставляем новую запись в matches (с принудительным id = matchRef)
  let newMatchRef;
  try {
    newMatchRef = await insertMatch({
      id:            matchRef,
      tournament_id: tournamentId,
      match_id:      externalMatchId,
      shard,
      map_name:      matchObj.attributes.mapName,
      played_at:     matchObj.attributes.createdAt,
      telemetry,
      processed:     true
    }, /* forceId = */ true);
    console.log(`   • Inserted match as id=${newMatchRef}`);
  } catch (err) {
    console.error('✗ Error insertMatch:', err.message);
    process.exit(1);
  }

  // 6) Вставляем участников
  try {
    const participants = includedArr
      .filter(i => i.type === 'participant')
      .map(p => {
        const s = p.attributes.stats;
        return {
          match_ref:   newMatchRef,
          player_id:   s.playerId,
          api_name:    s.name,
          player_name: s.name,
          team_id:     s.teamId,
          kills:       s.kills,
          damage:      s.damageDealt,
          placement:   s.winPlace,
          stats:       JSON.stringify({
                         assists:       s.assists,
                         timeSurvived:  s.timeSurvived,
                         headshotKills: s.headshotKills
                       })
        };
      });

    if (participants.length) {
      await insertParticipants(participants);
      console.log(`   • Saved ${participants.length} participants`);
    } else {
      console.log('   • No participants to save');
    }
  } catch (err) {
    console.error('✗ Error insertParticipants:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }

  console.log('✅ refetchEntireMatch complete');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
