const {
  getCosmeticById,
  listBadgeCosmetics,
  listBackgroundCosmetics,
  resolveCosmeticId,
} = require('./cosmetics');

/** @type {Record<string, object>} */
const ACHIEVEMENT_CATALOG = {
  'ach-be-yourself': {
    id: 'ach-be-yourself',
    titleKey: 'achievements.beYourself.title',
    descriptionKey: 'achievements.beYourself.description',
    progressKey: 'achievements.beYourself.progress',
    grants: { badgeId: 'badge-yourself', backgroundId: 'bg-yourself' },
    criteria: { type: 'always' },
    sortOrder: 0,
  },
  'ach-champion': {
    id: 'ach-champion',
    titleKey: 'achievements.champion.title',
    descriptionKey: 'achievements.champion.description',
    progressKey: 'achievements.champion.progress',
    grants: { badgeId: 'badge-champion', backgroundId: 'bg-gold' },
    criteria: { type: 'championships', target: 1 },
    sortOrder: 10,
  },
  'ach-veteran': {
    id: 'ach-veteran',
    titleKey: 'achievements.veteran.title',
    descriptionKey: 'achievements.veteran.description',
    progressKey: 'achievements.veteran.progress',
    grants: { badgeId: 'badge-veteran' },
    criteria: { type: 'tournaments_played', target: 10 },
    sortOrder: 20,
  },
  'ach-clutch': {
    id: 'ach-clutch',
    titleKey: 'achievements.clutch.title',
    descriptionKey: 'achievements.clutch.description',
    progressKey: 'achievements.clutch.progress',
    grants: { badgeId: 'badge-clutch' },
    criteria: { type: 'top3_finishes', target: 1 },
    sortOrder: 30,
  },
  'ach-streak': {
    id: 'ach-streak',
    titleKey: 'achievements.streak.title',
    descriptionKey: 'achievements.streak.description',
    progressKey: 'achievements.streak.progress',
    grants: { badgeId: 'badge-streak' },
    criteria: { type: 'top3_streak', target: 3 },
    sortOrder: 40,
  },
  'ach-dna': {
    id: 'ach-dna',
    titleKey: 'achievements.dna.title',
    descriptionKey: 'achievements.dna.description',
    progressKey: 'achievements.dna.progress',
    grants: { badgeId: 'badge-dna' },
    criteria: { type: 'dna_tier', target: 6 },
    sortOrder: 50,
  },
  'ach-ladder': {
    id: 'ach-ladder',
    titleKey: 'achievements.ladder.title',
    descriptionKey: 'achievements.ladder.description',
    progressKey: 'achievements.ladder.progress',
    grants: { badgeId: 'badge-ladder' },
    criteria: { type: 'ladder_rating', target: 1800 },
    sortOrder: 60,
  },
  'ach-nebula': {
    id: 'ach-nebula',
    titleKey: 'achievements.nebula.title',
    descriptionKey: 'achievements.nebula.description',
    progressKey: 'achievements.nebula.progress',
    grants: { backgroundId: 'bg-nebula' },
    criteria: { type: 'tournaments_played', target: 5 },
    sortOrder: 70,
  },
  'ach-ember': {
    id: 'ach-ember',
    titleKey: 'achievements.ember.title',
    descriptionKey: 'achievements.ember.description',
    progressKey: 'achievements.ember.progress',
    grants: { backgroundId: 'bg-ember' },
    criteria: { type: 'tournaments_played', target: 20 },
    sortOrder: 80,
  },
  'ach-aurora': {
    id: 'ach-aurora',
    titleKey: 'achievements.aurora.title',
    descriptionKey: 'achievements.aurora.description',
    progressKey: 'achievements.aurora.progress',
    grants: { backgroundId: 'bg-aurora' },
    criteria: { type: 'championships', target: 2 },
    sortOrder: 90,
  },
};

const MAX_PLAQUE_BADGES = 3;

const DEFAULT_PLAQUE_LOADOUT = {
  backgroundId: 'bg-yourself',
  badgeIds: ['badge-yourself'],
};

function getAchievementById(id) {
  if (!id) return null;
  return ACHIEVEMENT_CATALOG[id] || null;
}

function listAchievements() {
  return Object.values(ACHIEVEMENT_CATALOG).sort(
    (a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99),
  );
}

function normalizeLoadout(raw, unlockedCosmetics = null) {
  const badgeIds = Array.isArray(raw?.badgeIds)
    ? raw.badgeIds
        .map(resolveCosmeticId)
        .filter((id) => getCosmeticById(id)?.type === 'badge')
        .filter((id) => !unlockedCosmetics || unlockedCosmetics.badgeIds.has(id))
        .slice(0, MAX_PLAQUE_BADGES)
    : [];

  const bgCandidate = resolveCosmeticId(raw?.backgroundId);
  let backgroundId = DEFAULT_PLAQUE_LOADOUT.backgroundId;
  if (bgCandidate && getCosmeticById(bgCandidate)?.type === 'background') {
    if (!unlockedCosmetics || unlockedCosmetics.backgroundIds.has(bgCandidate)) {
      backgroundId = bgCandidate;
    }
  }

  return { backgroundId, badgeIds };
}

function getDemoLoadoutForPlayer() {
  return { ...DEFAULT_PLAQUE_LOADOUT };
}

module.exports = {
  ACHIEVEMENT_CATALOG,
  MAX_PLAQUE_BADGES,
  DEFAULT_PLAQUE_LOADOUT,
  getAchievementById,
  listAchievements,
  listBadgeAchievements: listBadgeCosmetics,
  listBackgroundAchievements: listBackgroundCosmetics,
  normalizeLoadout,
  getDemoLoadoutForPlayer,
};
