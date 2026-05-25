/**
 * DNA on tournament close: run pipeline for tournament matches, compute DNA rating per player,
 * update profiles and rating snapshots, then cleanup telemetry and features.
 */
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { knexForTournament, db } = require('../../../../lib/db');
const TournamentService = require('../TournamentService');
const PlayerService = require('../PlayerService');
const { runPipeline } = require('./pipeline');
const DnaService = require('./DnaService');
const dnaEngine = require('./dnaEngine');
const { persistDnaRating } = require('./dnaRatingPersistence');
const { getPubgTelemetryPath, snapshotsDir } = require('../../config/dataPaths');
const dnaStorage = require('./dnaStorage');
const { getFeaturesPath, featuresDir } = require('../../config/dataPaths');

const RUN_DNA_ON_CLOSE = process.env.RUN_DNA_ON_CLOSE !== 'false';
const { tournamentCountsInRating } = require('../../../shared/tournamentRatingPolicy');

/**
 * Get all player names (pubg nicks) from tournament table.
 * @param {Object} table - from getTournamentTable
 * @param {Object} tournament - from getTournamentById
 */
function getTournamentPlayerNames(table, tournament) {
  const players = new Set();
  if (!table.teams || !Array.isArray(table.teams)) return [];
  const isSolo = tournament.type === 'solo';
  for (const team of table.teams) {
    if (isSolo) {
      if (team.name) players.add(team.name);
    } else {
      if (team.players && Array.isArray(team.players)) {
        team.players.forEach(p => players.add(p));
      }
    }
  }
  return Array.from(players);
}

/**
 * Ensure telemetry file exists: if DB has telemetry, write to file.
 * @param {string} matchId
 * @param {string|null} telemetryJson - from matches.telemetry (string or null)
 */
async function ensureTelemetryFile(matchId, telemetryJson) {
  if (!telemetryJson) return false;
  const filePath = getPubgTelemetryPath(matchId);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const data = typeof telemetryJson === 'string' ? JSON.parse(telemetryJson) : telemetryJson;
  await fs.writeFile(filePath, JSON.stringify(data, null, 0), 'utf8');
  return true;
}

/**
 * Delete telemetry file and features dir for a match.
 */
async function cleanupMatchData(matchId) {
  const telemetryPath = getPubgTelemetryPath(matchId);
  try {
    await fs.unlink(telemetryPath);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn(`DnaOnClose: could not delete telemetry ${matchId}:`, e.message);
  }
  const featuresMatchDir = path.join(featuresDir, String(matchId));
  try {
    await fs.rm(featuresMatchDir, { recursive: true });
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn(`DnaOnClose: could not delete features dir ${matchId}:`, e.message);
  }
}

/**
 * Удалить телеметрию и артефакты матчей турнира (после успешного DNA-пайплайна).
 * @param {string} tournamentId
 */
async function cleanupTelemetryForTournament(tournamentId) {
  const k = (await db('tournaments').where({ id: tournamentId }).first('id')) ? db : await knexForTournament(tournamentId);
  const matchRows = await k('matches')
    .where({ tournament_id: tournamentId })
    .select('match_id');
  const matchIds = matchRows.map((r) => r.match_id);
  for (const matchId of matchIds) {
    await cleanupMatchData(matchId);
  }
  if (matchIds.length > 0) {
    await k('matches').where({ tournament_id: tournamentId }).update({ telemetry: null });
  }
}

/**
 * Run DNA pipeline and persist ratings when a tournament is closed.
 * Call after updatePlayerHistoriesAfterTournament.
 * @param {string} tournamentId
 * @param {{ skipCleanup?: boolean }} [options] — если skipCleanup: true, не удалять телеметрию (для шага перед автозакрытием)
 * @returns {Promise<{ ok: boolean, error?: string, stats?: Object }>}
 */
async function run(tournamentId, options = {}) {
  const { skipCleanup = false } = options || {};
  if (!RUN_DNA_ON_CLOSE) {
    return { ok: true, skipped: true, reason: 'RUN_DNA_ON_CLOSE is false' };
  }

  try {
    const tournament = await TournamentService.getTournamentById(tournamentId);
    if (!tournament) {
      return { ok: false, error: `Tournament ${tournamentId} not found` };
    }
    if (!tournamentCountsInRating(tournament)) {
      return { ok: true, skipped: true, reason: 'countInRating disabled' };
    }

    const table = await TournamentService.getTournamentTable(tournamentId).catch(() => null);
    if (!table) {
      return { ok: false, error: `Tournament table not found: ${tournamentId}` };
    }

    const inPrimary = await db('tournaments').where({ id: tournamentId }).first('id');
    if (!inPrimary) {
      return { ok: true, skipped: true, reason: 'tournament not in primary DB' };
    }

    const matchRows = await db('matches')
      .where({ tournament_id: tournamentId })
      .select('id', 'match_id', 'telemetry', 'played_at');

    const matchIds = matchRows
      .sort((a, b) => new Date(a.played_at || 0) - new Date(b.played_at || 0))
      .map(r => r.match_id);
    if (matchIds.length === 0) {
      return { ok: true, skipped: true, reason: 'No matches for tournament' };
    }

    const playerNames = getTournamentPlayerNames(table, tournament);
    if (playerNames.length === 0) {
      return { ok: true, skipped: true, reason: 'No players in table' };
    }

    const seasonId = (tournament.date && String(tournament.date).substring(0, 4)) || DnaService.DEFAULT_SEASON;

    for (const row of matchRows) {
      if (row.telemetry) {
        await ensureTelemetryFile(row.match_id, row.telemetry);
      }
    }

    const pipelineResult = await runPipeline(matchIds, playerNames, seasonId);

    const lastMatchRow = matchRows.length > 0 ? matchRows[matchRows.length - 1] : null;
    const persistContext = lastMatchRow
      ? {
          date: lastMatchRow.played_at,
          tournamentId: tournamentId,
          matchRef: lastMatchRow.id,
        }
      : { date: new Date(), tournamentId: tournamentId };

    const snapshotRecords = [];
    for (const playerName of playerNames) {
      try {
        const username = PlayerService.normalizeUsername(playerName);
        let profile = await PlayerService.getPlayerProfile(username);
        if (!profile) {
          const byPubg = await PlayerService.findPlayerByPubgNick(playerName);
          profile = byPubg?.profile || null;
        }
        const profileUsername = profile?.username || profile?.name || username;
        const oldRating = profile?.effectiveRating ?? 0;

        const persistResult = await persistDnaRating(
          playerName,
          seasonId,
          persistContext,
          playerName || profile?.username || profile?.name || username
        );
        const dnaRating = persistResult.rating ?? null;

        if (profile && dnaRating != null) {
          const updated = { ...profile, effectiveRating: dnaRating, dna_rating: dnaRating };
          const history = updated.history || [];
          const entry = history.find(h => h.tournamentId === tournamentId);
          if (entry) {
            entry.newRating = dnaRating;
            entry.oldRating = oldRating;
          }
          await PlayerService.updatePlayerProfile(profileUsername, updated);
        }

        snapshotRecords.push({
          player: playerName,
          ratingBefore: oldRating,
          ratingAfter: dnaRating ?? oldRating,
        });

        if (!persistResult.ok) {
          console.warn(`DnaOnClose: persist rating for ${playerName}:`, persistResult.error);
        }
      } catch (e) {
        console.warn(`DnaOnClose: skip player ${playerName}:`, e.message);
      }
    }

    if (!fsSync.existsSync(snapshotsDir)) {
      await fs.mkdir(snapshotsDir, { recursive: true });
    }
    const snapshotPath = path.join(snapshotsDir, `${tournamentId}.json`);
    await fs.writeFile(snapshotPath, JSON.stringify(snapshotRecords, null, 2), 'utf8');

    if (!skipCleanup) {
      await cleanupTelemetryForTournament(tournamentId);
    }

    return {
      ok: true,
      stats: {
        matchIds: matchIds.length,
        players: playerNames.length,
        ...pipelineResult,
      },
    };
  } catch (e) {
    console.error('DnaOnClose error:', e);
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = {
  run,
  cleanupTelemetryForTournament,
  getTournamentPlayerNames,
  ensureTelemetryFile,
  cleanupMatchData,
};
