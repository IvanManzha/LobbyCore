/** @typedef {'badge' | 'background'} CosmeticType */

/** @type {Record<string, object>} */
const COSMETIC_CATALOG = {
  'badge-yourself': {
    id: 'badge-yourself',
    type: 'badge',
    labelKey: 'achievements.beYourself.badgeLabel',
    icon: '✨',
    achievementId: 'ach-be-yourself',
  },
  'badge-champion': {
    id: 'badge-champion',
    type: 'badge',
    labelKey: 'achievements.champion.badgeLabel',
    icon: '🏆',
    achievementId: 'ach-champion',
  },
  'badge-veteran': {
    id: 'badge-veteran',
    type: 'badge',
    labelKey: 'achievements.veteran.badgeLabel',
    icon: '⚔️',
    achievementId: 'ach-veteran',
  },
  'badge-clutch': {
    id: 'badge-clutch',
    type: 'badge',
    labelKey: 'achievements.clutch.badgeLabel',
    icon: '🎯',
    achievementId: 'ach-clutch',
  },
  'badge-streak': {
    id: 'badge-streak',
    type: 'badge',
    labelKey: 'achievements.streak.badgeLabel',
    icon: '🔥',
    achievementId: 'ach-streak',
  },
  'badge-dna': {
    id: 'badge-dna',
    type: 'badge',
    labelKey: 'achievements.dna.badgeLabel',
    icon: '🧬',
    achievementId: 'ach-dna',
  },
  'badge-ladder': {
    id: 'badge-ladder',
    type: 'badge',
    labelKey: 'achievements.ladder.badgeLabel',
    icon: '💎',
    achievementId: 'ach-ladder',
  },
  'bg-yourself': {
    id: 'bg-yourself',
    type: 'background',
    labelKey: 'achievements.beYourself.backgroundLabel',
    background: 'linear-gradient(135deg, #1e293b 0%, #334155 45%, #475569 100%)',
    achievementId: 'ach-be-yourself',
  },
  'bg-gold': {
    id: 'bg-gold',
    type: 'background',
    labelKey: 'achievements.champion.backgroundLabel',
    background: 'linear-gradient(135deg, #1a1508 0%, #5c4a1f 40%, #c9a227 85%, #f4e4a6 100%)',
    achievementId: 'ach-champion',
  },
  'bg-nebula': {
    id: 'bg-nebula',
    type: 'background',
    labelKey: 'achievements.nebula.backgroundLabel',
    background: 'linear-gradient(135deg, #1a1033 0%, #3d2a6e 45%, #0d7377 100%)',
    achievementId: 'ach-nebula',
  },
  'bg-ember': {
    id: 'bg-ember',
    type: 'background',
    labelKey: 'achievements.ember.backgroundLabel',
    background: 'linear-gradient(135deg, #2d0a0a 0%, #8b2500 50%, #ff6b35 100%)',
    achievementId: 'ach-ember',
  },
  'bg-aurora': {
    id: 'bg-aurora',
    type: 'background',
    labelKey: 'achievements.aurora.backgroundLabel',
    background: 'linear-gradient(135deg, #0f2027 0%, #203a43 40%, #2c5364 70%, #4fd1c5 100%)',
    achievementId: 'ach-aurora',
  },
};

const LEGACY_COSMETIC_IDS = {
  'bg-default': 'bg-yourself',
};

function resolveCosmeticId(id) {
  if (!id) return null;
  return LEGACY_COSMETIC_IDS[id] || id;
}

function getCosmeticById(id) {
  const resolved = resolveCosmeticId(id);
  if (!resolved) return null;
  return COSMETIC_CATALOG[resolved] || null;
}

function listBadgeCosmetics() {
  return Object.values(COSMETIC_CATALOG).filter((c) => c.type === 'badge');
}

function listBackgroundCosmetics() {
  return Object.values(COSMETIC_CATALOG).filter((c) => c.type === 'background');
}

module.exports = {
  COSMETIC_CATALOG,
  resolveCosmeticId,
  getCosmeticById,
  listBadgeCosmetics,
  listBackgroundCosmetics,
};
