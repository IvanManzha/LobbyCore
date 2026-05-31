export {
  COSMETIC_CATALOG,
  resolveCosmeticId,
  getCosmeticById,
  listBadgeCosmetics,
  listBackgroundCosmetics,
  ACHIEVEMENT_CATALOG,
  MAX_PLAQUE_BADGES,
  DEFAULT_PLAQUE_LOADOUT,
  getAchievementById,
  listAchievements,
  listBadgeAchievements,
  listBackgroundAchievements,
  normalizeLoadout,
  getDemoLoadoutForPlayer,
  computeTop3Streak,
  countTop3Finishes,
  buildAchievementContext,
  evaluateAchievementCriteria,
  evaluateAllAchievements,
  getUnlockedCosmeticsFromStates,
  getAchievementStateForCosmetic,
  collectAchievementHistory,
} from '../../../../shared/achievement/index.js';

import { ACHIEVEMENT_CATALOG } from '../../../../shared/achievement/index.js';

/** @deprecated */
export function getUnlockedAchievementIds() {
  return Object.keys(ACHIEVEMENT_CATALOG);
}

export { usePlayerAchievements } from './model/usePlayerAchievements';
