/**
 * Ladder Rating: турнирный соревновательный прогресс (отдельно от DNA).
 * Обновляется один раз после завершения турнира.
 * Не подключаем PlayerService, чтобы избежать циклической зависимости (PlayerService -> LadderService).
 */
const { db } = require('../../../lib/db');
const TournamentService = require('./TournamentService');

function normalizeUsername(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

const LADDER_MIN = 0;
const LADDER_MAX = 2500;
const LADDER_START = 1200;
const GAMMA = 0.7;
const BETA = 8;
const BONUS_CLAMP = 5;
const K_TOUR_DEFAULT = 30;
const DNA_NEUTRAL = 1200;

/** Seasonal soft reset: Base + resetFactor * (old - Base) */
const SEASONAL_RESET_BASE = 1200;
const SEASONAL_RESET_FACTOR = 0.5;

/**
 * ActualScore = (1 - (place - 1) / (N - 1))^gamma
 * place = 1..N, N >= 1. При N=1 возвращаем 1.0.
 */
function actualScore(place, N) {
  if (N <= 1) return 1;
  const p = Number(place);
  const rank = !Number.isFinite(p) || p < 1 ? N : Math.min(p, N);
  const x = 1 - (rank - 1) / (N - 1);
  return Math.pow(Math.max(0, Math.min(1, x)), GAMMA);
}

/**
 * ExpectedScore = 1 - (expectedRank - 1) / (N - 1)
 */
function expectedScore(expectedRank, N) {
  if (N <= 1) return 1;
  return 1 - (expectedRank - 1) / (N - 1);
}

/**
 * Ladder rank label by rating (без подуровней в первой версии).
 */
function getLadderRankLabel(rating) {
  const r = Number(rating);
  if (r < 1000) return 'Bronze';
  if (r < 1200) return 'Silver';
  if (r < 1400) return 'Gold';
  if (r < 1600) return 'Platinum';
  if (r < 1800) return 'Diamond';
  return 'Master';
}

/**
 * Упрощённый бонус по результатам команды в турнире: нормализованный перформанс 0..1 из placement/kills.
 * Bonus = beta * (normalized - 0.5), clamp [-BONUS_CLAMP, BONUS_CLAMP].
 */
function computeBonus(team) {
  const results = team.results || [];
  const completed = results.filter((r) => r != null && (r.placement != null || r.kills != null));
  if (completed.length === 0) return 0;
  let sumPlace = 0;
  let sumKills = 0;
  let countPlace = 0;
  let countKills = 0;
  completed.forEach((r) => {
    if (r.placement != null) {
      sumPlace += Number(r.placement);
      countPlace++;
    }
    if (r.kills != null) {
      sumKills += Number(r.kills);
      countKills++;
    }
  });
  const avgPlace = countPlace > 0 ? sumPlace / countPlace : 12;
  const avgKills = countKills > 0 ? sumKills / countKills : 2;
  const placeNorm = Math.max(0, 1 - (avgPlace - 1) / 11);
  const killsNorm = Math.min(1, avgKills / 10);
  const normalized = 0.6 * placeNorm + 0.4 * killsNorm;
  const bonus = BETA * (normalized - 0.5);
  return Math.max(-BONUS_CLAMP, Math.min(BONUS_CLAMP, bonus));
}

/**
 * Получить dna_rating по списку ников из player_profiles (нормализованный player_id).
 */
async function getDnaRatings(playerNicks) {
  const out = {};
  for (const nick of playerNicks) {
    const id = normalizeUsername(nick);
    if (!id) continue;
    const row = await db('player_profiles').whereRaw('LOWER(player_id) = ?', [id]).first('dna_rating');
    out[id] = row && typeof row.dna_rating === 'number' && row.dna_rating > 0 ? row.dna_rating : DNA_NEUTRAL;
  }
  return out;
}

/**
 * TeamStrength = среднее DNA по составу. players = ники.
 */
function teamStrength(players, dnaByPlayer) {
  if (!players || players.length === 0) return DNA_NEUTRAL;
  let sum = 0;
  let count = 0;
  for (const nick of players) {
    const id = normalizeUsername(nick);
    const dna = dnaByPlayer[id] ?? DNA_NEUTRAL;
    sum += dna;
    count++;
  }
  return count > 0 ? sum / count : DNA_NEUTRAL;
}

/**
 * Обновить Ladder после завершения турнира.
 * Вызывать после updatePlayerHistoriesAfterTournament и DnaOnCloseService.run.
 */
async function updateAfterTournament(tournamentId) {
  const tournament = await TournamentService.getTournamentById(tournamentId);
  if (!tournament) return { ok: false, error: 'Tournament not found' };

  const { tournamentCountsInRating } = require('../../shared/tournamentRatingPolicy');
  if (!tournamentCountsInRating(tournament)) {
    return { ok: true, updated: 0, skipped: true, reason: 'countInRating disabled' };
  }

  let table;
  try {
    table = await TournamentService.getTournamentTable(tournamentId);
  } catch (e) {
    return { ok: false, error: e.message || 'Table not found' };
  }

  const teams = table.teams || [];
  const N = teams.length;
  if (N === 0) return { ok: true, updated: 0, reason: 'No teams' };

  const seasonId = (tournament.date && String(tournament.date).substring(0, 4)) || String(new Date().getFullYear());
  const K_tour = (tournament.extra && tournament.extra.tournamentWeight) ?? (tournament.tournamentWeight) ?? K_TOUR_DEFAULT;

  const allPlayers = new Set();
  teams.forEach((t) => (t.players || []).forEach((p) => allPlayers.add(p)));
  const dnaByPlayer = await getDnaRatings(Array.from(allPlayers));

  teams.forEach((t) => {
    t._strength = teamStrength(t.players || [], dnaByPlayer);
  });

  const byStrength = [...teams].sort((a, b) => {
    const diff = (b._strength || 0) - (a._strength || 0);
    if (diff !== 0) return diff;
    return (a.name || '').localeCompare(b.name || '');
  });
  byStrength.forEach((t, idx) => {
    t._expectedRank = idx + 1;
  });

  const now = new Date();
  let updated = 0;

  for (const team of teams) {
    const place = team.rank != null ? Number(team.rank) : 0;
    const expectedRank = team._expectedRank || N;
    const actual = actualScore(place, N);
    const expected = expectedScore(expectedRank, N);
    const bonus = computeBonus(team);
    const deltaLadder = K_tour * (actual - expected) + bonus;
    const players = team.players || (team.name ? [team.name] : []);

    for (const playerNick of players) {
      const playerId = normalizeUsername(playerNick);
      if (!playerId) continue;

      let row = await db('player_ladder').whereRaw('LOWER(player_id) = ?', [playerId]).where('season_id', seasonId).first();
      const ladderBefore = row ? Number(row.ladder_rating) : LADDER_START;
      let ladderAfter = ladderBefore + deltaLadder;
      ladderAfter = Math.round(Math.max(LADDER_MIN, Math.min(LADDER_MAX, ladderAfter)));

      if (!row) {
        await db('player_ladder').insert({
          player_id: playerId,
          season_id: seasonId,
          ladder_rating: ladderAfter,
          ladder_rank_label: getLadderRankLabel(ladderAfter),
          last_tournament_id: tournamentId,
          last_delta: Math.round(deltaLadder * 10) / 10,
          updated_at: now
        });
      } else {
        const lifetimeBest = row.lifetime_best != null ? Math.max(row.lifetime_best, ladderAfter) : ladderAfter;
        await db('player_ladder').where('id', row.id).update({
          ladder_rating: ladderAfter,
          ladder_rank_label: getLadderRankLabel(ladderAfter),
          last_tournament_id: tournamentId,
          last_delta: Math.round(deltaLadder * 10) / 10,
          lifetime_best: lifetimeBest,
          updated_at: now
        });
      }

      await db('player_ladder_history').insert({
        player_id: playerId,
        tournament_id: tournamentId,
        season_id: seasonId,
        ladder_before: ladderBefore,
        ladder_after: ladderAfter,
        delta: Math.round(deltaLadder * 10) / 10,
        actual_score: Math.round(actual * 1000) / 1000,
        expected_score: Math.round(expected * 1000) / 1000,
        bonus: Math.round(bonus * 100) / 100,
        occurred_at: now
      });
      updated++;
    }
  }

  return { ok: true, updated, seasonId, K_tour };
}

/**
 * Получить текущий Ladder по player_id (нормализованный) и сезону.
 */
async function getLadderForPlayer(playerId, seasonId) {
  const id = normalizeUsername(playerId);
  if (!id) return null;
  const season = seasonId || String(new Date().getFullYear());
  const row = await db('player_ladder').whereRaw('LOWER(player_id) = ?', [id]).where('season_id', season).first();
  if (!row) return { ladder_rating: null, ladder_rank_label: null, last_delta: null, last_tournament_id: null, lifetime_best: null, previous_season_rating: null };
  return {
    ladder_rating: row.ladder_rating,
    ladder_rank_label: row.ladder_rank_label || getLadderRankLabel(row.ladder_rating),
    last_delta: row.last_delta,
    last_tournament_id: row.last_tournament_id,
    lifetime_best: row.lifetime_best,
    previous_season_rating: row.previous_season_rating
  };
}

/**
 * Лидерборд по сезону: игроки, отсортированные по ladder_rating по убыванию.
 * Подмешивает dna_rating из player_profiles для отображения DNA Tier.
 */
async function getLadderLeaderboard(seasonId, limit = 100) {
  const season = seasonId || String(new Date().getFullYear());
  const rows = await db('player_ladder')
    .leftJoin('player_profiles', db.raw('LOWER(player_ladder.player_id) = LOWER(player_profiles.player_id)'))
    .where('player_ladder.season_id', season)
    .orderBy('player_ladder.ladder_rating', 'desc')
    .limit(limit)
    .select(
      'player_ladder.player_id',
      'player_ladder.ladder_rating',
      'player_ladder.ladder_rank_label',
      'player_ladder.last_delta',
      'player_ladder.last_tournament_id',
      'player_ladder.lifetime_best',
      'player_profiles.dna_rating',
      'player_profiles.dominant_trait'
    );
  return rows.map((r, i) => ({
    place: i + 1,
    player_id: r.player_id,
    ladder_rating: r.ladder_rating,
    ladder_rank_label: r.ladder_rank_label || getLadderRankLabel(r.ladder_rating),
    last_delta: r.last_delta,
    last_tournament_id: r.last_tournament_id,
    lifetime_best: r.lifetime_best,
    dna_rating: r.dna_rating != null ? r.dna_rating : null,
    dominant_trait: r.dominant_trait != null ? r.dominant_trait : null
  }));
}

/**
 * Get last ladder change breakdown for a player (for UI: old, new, delta, actual/expected, bonus).
 */
async function getLadderChangeBreakdown(playerId, seasonId) {
  const id = normalizeUsername(playerId);
  if (!id) return null;
  const season = seasonId || String(new Date().getFullYear());
  const row = await db('player_ladder_history')
    .whereRaw('LOWER(player_id) = ?', [id])
    .where('season_id', season)
    .orderBy('occurred_at', 'desc')
    .first();
  if (!row) return null;
  return {
    ladder_before: row.ladder_before,
    ladder_after: row.ladder_after,
    delta: row.delta,
    actual_score: row.actual_score,
    expected_score: row.expected_score,
    bonus: row.bonus,
    tournament_id: row.tournament_id,
    occurred_at: row.occurred_at
  };
}

/**
 * Seasonal soft reset: for each player in oldSeason, save previous_season_rating, compute
 * newRating = Base + resetFactor * (old - Base), write to newSeason.
 * Call at season end (e.g. cron or admin action).
 */
async function runSeasonalSoftReset(oldSeasonId, newSeasonId) {
  const rows = await db('player_ladder').where('season_id', oldSeasonId).select('*');
  const now = new Date();
  let processed = 0;
  for (const row of rows) {
    const oldRating = Number(row.ladder_rating) || LADDER_START;
    const newRating = Math.round(
      Math.max(LADDER_MIN, Math.min(LADDER_MAX,
        SEASONAL_RESET_BASE + SEASONAL_RESET_FACTOR * (oldRating - SEASONAL_RESET_BASE)
      ))
    );
    const newRankLabel = getLadderRankLabel(newRating);
    const existing = await db('player_ladder')
      .whereRaw('LOWER(player_id) = ?', [row.player_id])
      .where('season_id', newSeasonId)
      .first();
    if (existing) {
      await db('player_ladder').where('id', existing.id).update({
        ladder_rating: newRating,
        ladder_rank_label: newRankLabel,
        previous_season_rating: oldRating,
        updated_at: now
      });
    } else {
      await db('player_ladder').insert({
        player_id: row.player_id,
        season_id: newSeasonId,
        ladder_rating: newRating,
        ladder_rank_label: newRankLabel,
        previous_season_rating: oldRating,
        last_tournament_id: null,
        last_delta: null,
        updated_at: now
      });
    }
    processed++;
  }
  return { ok: true, processed, oldSeasonId, newSeasonId };
}

/**
 * Get ladder rating history for a player (all seasons), for the rating chart.
 * @returns {Promise<Array<{ occurred_at: string, rating: number, tournament_id: string, season_id: string }>>}
 */
async function getLadderHistoryForPlayer(playerId) {
  const id = normalizeUsername(playerId);
  if (!id) return [];
  const rows = await db('player_ladder_history')
    .whereRaw('LOWER(player_id) = ?', [id])
    .orderBy('occurred_at', 'asc')
    .select('occurred_at', 'ladder_after as rating', 'tournament_id', 'season_id');
  return (rows || []).map((r) => ({
    occurred_at: r.occurred_at,
    rating: Number(r.rating ?? r.ladder_after ?? 0),
    tournament_id: r.tournament_id || '',
    season_id: r.season_id || ''
  }));
}

module.exports = {
  updateAfterTournament,
  getLadderForPlayer,
  getLadderLeaderboard,
  getLadderChangeBreakdown,
  getLadderHistoryForPlayer,
  runSeasonalSoftReset,
  getLadderRankLabel,
  LADDER_START,
  LADDER_MIN,
  LADDER_MAX,
  SEASONAL_RESET_BASE,
  SEASONAL_RESET_FACTOR
};
