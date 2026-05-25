/**
 * Auto Team Cap: сила игрока и пул — только Ladder (player_ladder за сезон).
 * Авто: медиана/σ пула, потолок N×медиана + k×σ, штраф «звёзд»; ручной барьер: сумма Ladder ≤ barrier.
 */
const LadderPoolStatsService = require('./LadderPoolStatsService');

const DEFAULT_MU = 1200;
const DEFAULT_SIGMA = 200;
const DEFAULT_T_ELITE = 1600;
const STAR_T_DEFAULT = 1500;

const LAMBDA_DUO = 0.35;
const LAMBDA_SQUAD = 0.5;
const LAMBDA_MIXED = 0.42;
const K_DUO = 1.55;
const K_SQUAD = 2.6;
const K_MIXED = 2.0;

const ELITE_LIMIT_DUO = 1;
const ELITE_LIMIT_SQUAD = 2;
const ELITE_LIMIT_MIXED = 1;

function normalizeId(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/** Запасной рейтинг в формулах, если нет ключа в powers (не должно при нормальном getLadderPowers). */
function neutralRating() {
  return LadderPoolStatsService.LADDER_START;
}

/**
 * TeamBasePower, StarPenalty, TeamPower, eliteCount. mode: duo | squad | mixed.
 * powers — значения Ladder по игрокам.
 */
function computeTeamPower(players, powers, mode, poolStats) {
  const stats = poolStats || {
    mu: DEFAULT_MU,
    sigma: DEFAULT_SIGMA,
    T_elite: DEFAULT_T_ELITE,
    T_star: STAR_T_DEFAULT
  };
  const T = stats.T_star != null ? stats.T_star : STAR_T_DEFAULT;
  const T_elite = stats.T_elite != null ? stats.T_elite : DEFAULT_T_ELITE;

  const powerList = (players || []).map((id) => powers[normalizeId(id)] ?? neutralRating());
  const teamBasePower = powerList.reduce((s, p) => s + p, 0);
  const starExcess = powerList.map((p) => Math.max(p - T, 0));
  const lambda = getLambda(mode);
  const starPenalty = lambda * starExcess.reduce((s, e) => s + e, 0);
  const teamPower = teamBasePower + starPenalty;
  const eliteCount = powerList.filter((p) => p > T_elite).length;
  const teamSize = powerList.length;

  return {
    teamBasePower,
    starPenalty,
    teamPower,
    eliteCount,
    teamSize,
    powerList
  };
}

function getLambda(mode) {
  const m = (mode || '').toLowerCase();
  if (m === 'duo') return LAMBDA_DUO;
  if (m === 'squad') return LAMBDA_SQUAD;
  return LAMBDA_MIXED;
}

function getK(mode, teamSize) {
  const m = (mode || '').toLowerCase();
  if (m === 'duo') return K_DUO;
  if (m === 'squad') return K_SQUAD;
  if (m === 'mixed' && teamSize != null) return K_MIXED;
  return K_MIXED;
}

function getEliteLimit(mode, teamSize) {
  const m = (mode || '').toLowerCase();
  if (m === 'duo') return ELITE_LIMIT_DUO;
  if (m === 'squad') return ELITE_LIMIT_SQUAD;
  return ELITE_LIMIT_MIXED;
}

/**
 * Кап по пулу Ladder: центр — медиана лидерборда сезона, σ — разброс.
 */
function getCapFromLadderPool(mode, ladderPoolStats, teamSize = null) {
  const stats = ladderPoolStats || {};
  const median = stats.median != null ? stats.median : stats.mu != null ? stats.mu : LadderPoolStatsService.LADDER_START;
  const sigma = stats.sigma != null ? stats.sigma : DEFAULT_SIGMA;
  const m = (mode || '').toLowerCase();

  if (m === 'duo') {
    const k = getK('duo');
    return 2 * median + k * sigma;
  }
  if (m === 'squad') {
    const k = getK('squad');
    return 4 * median + k * sigma;
  }
  const size = teamSize != null ? teamSize : 4;
  const k = getK('mixed', size);
  return size * median + k * sigma;
}

/**
 * Валидация состава. tournament: { type, teamCapMode, barrier, extra?.teamCapMode }.
 * Режимы auto и ladder (устар.) — одинаково: только Ladder.
 */
async function validateTeamPower(players, tournament) {
  if (!tournament || !Array.isArray(players)) return { allowed: true };

  const type = (tournament.type || '').toLowerCase();
  if (type === 'solo') return { allowed: true };

  const rawMode = tournament.teamCapMode || tournament.extra?.teamCapMode || 'auto';
  const teamCapMode = String(rawMode).toLowerCase();
  const barrier = tournament.barrier != null ? Number(tournament.barrier) : null;

  const mode = type === 'mixed' ? 'mixed' : type;
  const teamSize = players.length;

  const seasonId = LadderPoolStatsService.getSeasonIdForTeamCap(tournament);
  const ladderPoolStats = await LadderPoolStatsService.getLadderPoolStats(seasonId);
  const powers = await LadderPoolStatsService.getLadderPowers(
    players,
    seasonId,
    ladderPoolStats.median
  );

  if (teamCapMode === 'manual' && barrier != null && Number.isFinite(barrier)) {
    const { teamPower, eliteCount } = computeTeamPower(players, powers, mode, ladderPoolStats);
    const eliteLimit = getEliteLimit(mode, teamSize);
    if (eliteCount > eliteLimit) {
      return {
        allowed: false,
        code: 'ELITE_LIMIT_EXCEEDED',
        teamPower,
        eliteCount,
        eliteLimit
      };
    }
    const sumPower = (players || []).reduce(
      (s, id) => s + (powers[normalizeId(id)] ?? ladderPoolStats.median),
      0
    );
    if (sumPower > barrier) {
      return {
        allowed: false,
        code: 'TEAM_POWER_EXCEEDED_MANUAL',
        teamPower: sumPower,
        cap: barrier
      };
    }
    return { allowed: true };
  }

  const { teamPower, eliteCount } = computeTeamPower(players, powers, mode, ladderPoolStats);
  const eliteLimit = getEliteLimit(mode, teamSize);

  if (eliteCount > eliteLimit) {
    return {
      allowed: false,
      code: 'ELITE_LIMIT_EXCEEDED',
      teamPower,
      eliteCount,
      eliteLimit
    };
  }

  const cap = getCapFromLadderPool(mode, ladderPoolStats, teamSize);
  if (teamPower > cap) {
    return {
      allowed: false,
      code: 'TEAM_POWER_EXCEEDED',
      teamPower,
      cap,
      eliteCount,
      eliteLimit
    };
  }

  return { allowed: true };
}

module.exports = {
  computeTeamPower,
  getCapFromLadderPool,
  validateTeamPower,
  normalizeId,
  /** @deprecated используйте LadderPoolStatsService.LADDER_START; оставлено для совместимости */
  DNA_NEUTRAL: LadderPoolStatsService.LADDER_START,
  DEFAULT_MU,
  DEFAULT_SIGMA
};
