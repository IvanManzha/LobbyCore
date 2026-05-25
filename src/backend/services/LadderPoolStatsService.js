/**
 * Пул Ladder за сезон (медиана, μ, σ, перцентили) — для автокапа составов без циклических зависимостей с TournamentService.
 */
const { db } = require('../../../lib/db');

const LADDER_START = 1200;
const DEFAULT_SIGMA = 200;
const DEFAULT_T_ELITE = 1600;
const STAR_T_DEFAULT = 1500;

function normalizeId(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/**
 * Сезон для капа: extra.ladderSeasonId или год из date турнира.
 */
function getSeasonIdForTeamCap(tournament) {
  if (!tournament) return String(new Date().getFullYear());
  const extra = tournament.extra || {};
  if (extra.ladderSeasonId != null && String(extra.ladderSeasonId).trim()) {
    return String(extra.ladderSeasonId).trim();
  }
  const d = tournament.date;
  if (d && String(d).length >= 4) return String(d).substring(0, 4);
  return String(new Date().getFullYear());
}

/**
 * Медиана, среднее, σ, T_elite (p90), T_star — по всем строкам player_ladder за сезон.
 */
async function getLadderPoolStats(seasonId) {
  const season = String(seasonId || new Date().getFullYear());
  const rows = await db('player_ladder').where('season_id', season).select('ladder_rating');
  const values = (rows || [])
    .map((r) => (r.ladder_rating != null ? Number(r.ladder_rating) : NaN))
    .filter((v) => Number.isFinite(v));

  if (values.length === 0) {
    return {
      median: LADDER_START,
      mu: LADDER_START,
      sigma: DEFAULT_SIGMA,
      T_elite: DEFAULT_T_ELITE,
      T_star: STAR_T_DEFAULT,
      count: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const mu = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mu) ** 2, 0) / n;
  const sigma = Math.sqrt(variance) || DEFAULT_SIGMA;
  const p90Idx = Math.min(Math.floor(0.9 * n), n - 1);
  const T_elite = sorted[p90Idx];
  const T_star = Math.min(mu + 0.5 * sigma, T_elite * 0.95);

  return { median, mu, sigma, T_elite, T_star, count: n };
}

/**
 * Текущий Ladder игроков; без записи — медиана пула (типичный «середняк»).
 */
async function getLadderPowers(playerIds, seasonId, fallbackRating) {
  const out = {};
  const season = String(seasonId || new Date().getFullYear());
  const fb = Number.isFinite(fallbackRating) ? fallbackRating : LADDER_START;
  const ids = [...new Set((playerIds || []).map(normalizeId).filter(Boolean))];
  for (const id of ids) {
    const row = await db('player_ladder')
      .whereRaw('LOWER(player_id) = ?', [id])
      .where('season_id', season)
      .first('ladder_rating');
    out[id] = row && row.ladder_rating != null ? Number(row.ladder_rating) : fb;
  }
  return out;
}

module.exports = {
  getLadderPoolStats,
  getLadderPowers,
  getSeasonIdForTeamCap,
  LADDER_START
};
