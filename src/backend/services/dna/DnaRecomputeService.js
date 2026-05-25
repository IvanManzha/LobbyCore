/**
 * Пересчёт DNA по матчам из актуальной БД (pubg_app.db), только турниры с countInRating !== false.
 */
const { db } = require('../../../../lib/db');
const TournamentService = require('../TournamentService');
const { tournamentCountsInRating } = require('../../../shared/tournamentRatingPolicy');
const { isTestTournament } = require('../../../shared/testDataFilters');
const DnaOnCloseService = require('./DnaOnCloseService');
const { runPipeline } = require('./pipeline');
const DnaService = require('./DnaService');
const { persistDnaRating } = require('./dnaRatingPersistence');

function normalizePlayerId(name) {
  return String(name || '').trim();
}

function seasonFromTournament(tournament) {
  return (tournament?.date && String(tournament.date).substring(0, 4)) || DnaService.DEFAULT_SEASON;
}

function seasonFromPlayedAt(playedAt) {
  if (!playedAt) return DnaService.DEFAULT_SEASON;
  const d = new Date(playedAt);
  if (Number.isNaN(d.getTime())) return DnaService.DEFAULT_SEASON;
  return String(d.getFullYear());
}

/**
 * Все match_id игрока за сезон из актуальной БД, только турниры с учётом в рейтинге.
 */
async function getPlayerDnaMatchIds(playerId, seasonId) {
  const normalized = normalizePlayerId(playerId).toLowerCase();
  if (!normalized) return [];

  const rows = await db('participants as p')
    .join('matches as m', 'm.id', 'p.match_ref')
    .whereRaw('LOWER(p.player_name) = ? OR LOWER(p.player_id) = ?', [normalized, normalized])
    .select('m.match_id as matchId', 'm.played_at as playedAt', 'm.tournament_id as tournamentId')
    .orderBy('m.played_at', 'asc');

  if (!rows.length) return [];

  const tournamentIds = [...new Set(rows.map((r) => r.tournamentId).filter(Boolean))];
  const tournamentRows = await db('tournaments').whereIn('id', tournamentIds).select('id', 'name', 'date', 'extra');
  const ratingOk = new Set();
  for (const t of tournamentRows) {
    if (isTestTournament(t)) continue;
    if (tournamentCountsInRating(t)) ratingOk.add(t.id);
  }

  return rows
    .filter((r) => ratingOk.has(r.tournamentId) && seasonFromPlayedAt(r.playedAt) === String(seasonId))
    .map((r) => r.matchId)
    .filter(Boolean);
}

/**
 * Участники матча (ники) из актуальной БД.
 */
async function getMatchParticipantNames(tournamentId, matchId) {
  const rows = await db('participants as p')
    .join('matches as m', 'm.id', 'p.match_ref')
    .where({ 'm.tournament_id': tournamentId, 'm.match_id': matchId })
    .select('p.player_name as playerName', 'p.player_id as playerId');

  const names = new Set();
  for (const r of rows) {
    const n = normalizePlayerId(r.playerName || r.playerId);
    if (n) names.add(n);
  }
  return Array.from(names);
}

/**
 * После сохранения матча: пересчёт DNA всех игроков этого матча (полный сезонный срез матчей).
 */
async function recomputePlayersAfterMatch(tournamentId, matchId, telemetry) {
  const tournament = await TournamentService.getTournamentById(tournamentId);
  if (!tournament) {
    return { ok: false, error: 'Tournament not found' };
  }
  if (!tournamentCountsInRating(tournament)) {
    return { ok: true, skipped: true, reason: 'countInRating disabled' };
  }
  if (isTestTournament(tournament)) {
    return { ok: true, skipped: true, reason: 'test tournament' };
  }

  const inPrimary = await db('tournaments').where({ id: tournamentId }).first('id');
  if (!inPrimary) {
    return { ok: true, skipped: true, reason: 'tournament not in primary DB' };
  }

  if (telemetry) {
    const telemetryJson = typeof telemetry === 'string' ? telemetry : JSON.stringify(telemetry);
    await DnaOnCloseService.ensureTelemetryFile(matchId, telemetryJson);
  }

  const playerNames = await getMatchParticipantNames(tournamentId, matchId);
  if (!playerNames.length) {
    return { ok: true, skipped: true, reason: 'no participants' };
  }

  const seasonId = seasonFromTournament(tournament);
  let recomputed = 0;
  const errors = [];

  for (const playerId of playerNames) {
    try {
      const matchIds = await getPlayerDnaMatchIds(playerId, seasonId);
      if (!matchIds.length) continue;
      await runPipeline(matchIds, [playerId], seasonId);
      const matchRow = await db('matches')
        .where({ tournament_id: tournamentId, match_id: matchId })
        .first('id', 'played_at');
      await persistDnaRating(playerId, seasonId, {
        date: matchRow?.played_at || new Date(),
        tournamentId,
        matchId,
        matchRef: matchRow?.id,
      });
      recomputed += 1;
    } catch (e) {
      errors.push({ playerId, error: e.message || String(e) });
    }
  }

  return {
    ok: errors.length === 0,
    recomputed,
    players: playerNames.length,
    errors: errors.length ? errors : undefined,
  };
}

module.exports = {
  getPlayerDnaMatchIds,
  getMatchParticipantNames,
  recomputePlayersAfterMatch,
};
