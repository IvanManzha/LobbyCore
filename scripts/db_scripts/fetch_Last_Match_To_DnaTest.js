// scripts/db_scripts/fetch_Last_Match_To_DnaTest.js
// Fetches the latest match for a player via PUBG API and saves it to bd_dna_test (pubg_dna_test.db).
// Usage: node scripts/db_scripts/fetch_Last_Match_To_DnaTest.js [playerName]
// Default playerName: IVANCHK

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
const MAX_TELEMETRY_TOURNAMENTS = Number(process.env.DNA_TEST_MAX_TELEMETRY_TOURNAMENTS || 4);
const MAX_TELEMETRY_MATCHES = Number(process.env.DNA_TEST_MAX_TELEMETRY_MATCHES || 20);

async function applyTelemetryRetention(knexDb, maxTournaments = MAX_TELEMETRY_TOURNAMENTS, maxMatches = MAX_TELEMETRY_MATCHES) {
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

async function main() {
  const playerName = process.argv[2] || 'IVANCHK';

  let playerId;
  try {
    const profileResp = await getPlayer(SHARD, playerName);
    const profileData = profileResp.data[0];
    playerId = profileData.attributes?.platformId || profileData.id;
    console.log(`→ Player "${playerName}" UUID: ${playerId}`);
  } catch (err) {
    console.error('Failed to fetch player profile:', err.message);
    process.exit(1);
  }

  let latestMatchId;
  try {
    const matches = await getPlayerMatchList(SHARD, playerName);
    if (!matches.length) {
      console.log(`No matches found for ${playerName}`);
      process.exit(0);
    }
    latestMatchId = matches[0];
    console.log(`→ Latest match ID: ${latestMatchId}`);
  } catch (err) {
    console.error('Failed to fetch match list:', err.message);
    process.exit(1);
  }

  let matchData;
  let matchRef;
  try {
    matchData = await getMatch(SHARD, latestMatchId);

    const { createdAt: played_at, mapName: map_name } = matchData.data.attributes;
    const asset = matchData.included?.find(i => i.type === 'asset');
    const telemetry = asset?.attributes?.URL
      ? await getTelemetry(asset.attributes.URL)
      : null;

    const existing = await dbDnaTest('matches')
      .where({ match_id: latestMatchId })
      .first('id');

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
      console.log(`Overwrote match ${latestMatchId} in dna_test (id ${matchRef})`);
    } else {
      matchRef = await insertMatchDnaTest({
        tournament_id: TOURNAMENT_ID,
        match_id: latestMatchId,
        shard: SHARD,
        map_name,
        played_at,
        telemetry: telemetry ? JSON.stringify(telemetry) : null,
        processed: true
      });
      console.log(`Inserted match ${latestMatchId} into dna_test with id ${matchRef}`);
    }
  } catch (err) {
    console.error('Error fetching or inserting match:', err.message);
    process.exit(1);
  }

  try {
    const participantsData = (matchData.included || []).filter(i => i.type === 'participant');
    if (!participantsData.length) {
      console.log('No participants in match.');
    } else {
      await dbDnaTest('participants').where({ match_ref: matchRef }).del();
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
      console.log(`Saved ${participantsToSave.length} participant(s) to dna_test.`);
    }
  } catch (err) {
    console.error('Error inserting participants:', err.message);
    process.exit(1);
  } finally {
    await applyTelemetryRetention(dbDnaTest);
    await dbDnaTest.destroy();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
