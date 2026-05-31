const { ACHIEVEMENT_CATALOG } = require('./catalog');
const { collectAchievementHistory } = require('./history');

function getPlacement(entry) {
  if (!entry) return null;
  const raw = entry.placement ?? entry.place;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function computeTop3Streak(history) {
  if (!Array.isArray(history) || history.length === 0) return 0;
  const sorted = [...history].sort((a, b) => {
    const da = a?.date || a?.startedAt || '';
    const db = b?.date || b?.startedAt || '';
    return String(da).localeCompare(String(db));
  });
  let best = 0;
  let current = 0;
  for (const entry of sorted) {
    const place = getPlacement(entry);
    if (place != null && place <= 3) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function countTop3Finishes(history) {
  if (!Array.isArray(history)) return 0;
  return history.filter((entry) => {
    const place = getPlacement(entry);
    return place != null && place <= 3;
  }).length;
}

function buildAchievementContext(profile, championships = null, historyOverride = null) {
  const history = historyOverride ?? collectAchievementHistory(profile);
  return {
    tournamentsPlayed: history.length,
    championshipsTotal: championships?.total ?? 0,
    top3Finishes: countTop3Finishes(history),
    top3Streak: computeTop3Streak(history),
    dnaTier: Number(profile?.dnaTier) || 0,
    ladderRating: Number(profile?.ladder_rating) || 0,
  };
}

function evaluateAchievementCriteria(achievement, ctx) {
  const { criteria } = achievement;
  const target = criteria.target ?? 1;

  switch (criteria.type) {
    case 'always':
      return { unlocked: true, current: 1, target: 1, progressRatio: 1 };
    case 'championships': {
      const current = ctx.championshipsTotal;
      return {
        unlocked: current >= target,
        current,
        target,
        progressRatio: Math.min(1, current / target),
      };
    }
    case 'tournaments_played': {
      const current = ctx.tournamentsPlayed;
      return {
        unlocked: current >= target,
        current,
        target,
        progressRatio: Math.min(1, current / target),
      };
    }
    case 'top3_finishes': {
      const current = ctx.top3Finishes;
      return {
        unlocked: current >= target,
        current,
        target,
        progressRatio: Math.min(1, current / target),
      };
    }
    case 'top3_streak': {
      const current = ctx.top3Streak;
      return {
        unlocked: current >= target,
        current,
        target,
        progressRatio: Math.min(1, current / target),
      };
    }
    case 'dna_tier': {
      const current = ctx.dnaTier;
      return {
        unlocked: current >= target,
        current,
        target,
        progressRatio: Math.min(1, current / target),
      };
    }
    case 'ladder_rating': {
      const current = ctx.ladderRating;
      return {
        unlocked: current >= target,
        current,
        target,
        progressRatio: Math.min(1, current / target),
      };
    }
    default:
      return { unlocked: false, current: 0, target, progressRatio: 0 };
  }
}

function evaluateAllAchievements(ctx) {
  return Object.values(ACHIEVEMENT_CATALOG)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
    .map((achievement) => ({
      achievement,
      ...evaluateAchievementCriteria(achievement, ctx),
    }));
}

function getUnlockedCosmeticsFromStates(states) {
  const badgeIds = new Set();
  const backgroundIds = new Set();

  for (const state of states) {
    if (!state.unlocked) continue;
    const { grants } = state.achievement;
    if (grants.badgeId) badgeIds.add(grants.badgeId);
    if (grants.backgroundId) backgroundIds.add(grants.backgroundId);
  }

  return { badgeIds, backgroundIds };
}

function getAchievementStateForCosmetic(states, cosmeticId) {
  return (
    states.find((state) => {
      const { grants } = state.achievement;
      return grants.badgeId === cosmeticId || grants.backgroundId === cosmeticId;
    }) || null
  );
}

module.exports = {
  computeTop3Streak,
  countTop3Finishes,
  buildAchievementContext,
  evaluateAchievementCriteria,
  evaluateAllAchievements,
  getUnlockedCosmeticsFromStates,
  getAchievementStateForCosmetic,
  collectAchievementHistory,
};
