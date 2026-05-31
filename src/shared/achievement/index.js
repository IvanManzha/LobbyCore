const cosmetics = require('./cosmetics');
const catalog = require('./catalog');
const evaluate = require('./evaluateAchievements');
const history = require('./history');

module.exports.COSMETIC_CATALOG = cosmetics.COSMETIC_CATALOG;
module.exports.resolveCosmeticId = cosmetics.resolveCosmeticId;
module.exports.getCosmeticById = cosmetics.getCosmeticById;
module.exports.listBadgeCosmetics = cosmetics.listBadgeCosmetics;
module.exports.listBackgroundCosmetics = cosmetics.listBackgroundCosmetics;

module.exports.ACHIEVEMENT_CATALOG = catalog.ACHIEVEMENT_CATALOG;
module.exports.MAX_PLAQUE_BADGES = catalog.MAX_PLAQUE_BADGES;
module.exports.DEFAULT_PLAQUE_LOADOUT = catalog.DEFAULT_PLAQUE_LOADOUT;
module.exports.getAchievementById = catalog.getAchievementById;
module.exports.listAchievements = catalog.listAchievements;
module.exports.listBadgeAchievements = catalog.listBadgeAchievements;
module.exports.listBackgroundAchievements = catalog.listBackgroundAchievements;
module.exports.normalizeLoadout = catalog.normalizeLoadout;
module.exports.getDemoLoadoutForPlayer = catalog.getDemoLoadoutForPlayer;

module.exports.computeTop3Streak = evaluate.computeTop3Streak;
module.exports.countTop3Finishes = evaluate.countTop3Finishes;
module.exports.buildAchievementContext = evaluate.buildAchievementContext;
module.exports.evaluateAchievementCriteria = evaluate.evaluateAchievementCriteria;
module.exports.evaluateAllAchievements = evaluate.evaluateAllAchievements;
module.exports.getUnlockedCosmeticsFromStates = evaluate.getUnlockedCosmeticsFromStates;
module.exports.getAchievementStateForCosmetic = evaluate.getAchievementStateForCosmetic;
module.exports.collectAchievementHistory = history.collectAchievementHistory;
