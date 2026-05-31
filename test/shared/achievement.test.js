const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAchievementContext,
  evaluateAllAchievements,
  normalizeLoadout,
  DEFAULT_PLAQUE_LOADOUT,
  getUnlockedCosmeticsFromStates,
} = require('../../src/shared/achievement');

describe('achievement evaluation', () => {
  it('be-yourself is always unlocked', () => {
    const ctx = buildAchievementContext({ history: [] }, { total: 0 });
    const states = evaluateAllAchievements(ctx);
    const starter = states.find((s) => s.achievement.id === 'ach-be-yourself');
    assert.equal(starter?.unlocked, true);
  });

  it('history place field counts for top3', () => {
    const ctx = buildAchievementContext(
      {
        history: [{ place: 2, date: '2025-01-01' }, { place: 5, date: '2025-02-01' }],
      },
      { total: 0 },
    );
    assert.equal(ctx.top3Finishes, 1);
    const clutch = evaluateAllAchievements(ctx).find((s) => s.achievement.id === 'ach-clutch');
    assert.equal(clutch?.unlocked, true);
  });

  it('normalizeLoadout strips locked cosmetics', () => {
    const states = evaluateAllAchievements(buildAchievementContext({ history: [] }, { total: 0 }));
    const unlocked = getUnlockedCosmeticsFromStates(states);
    const loadout = normalizeLoadout(
      { backgroundId: 'bg-gold', badgeIds: ['badge-champion', 'badge-yourself'] },
      unlocked,
    );
    assert.equal(loadout.backgroundId, DEFAULT_PLAQUE_LOADOUT.backgroundId);
    assert.deepEqual(loadout.badgeIds, ['badge-yourself']);
  });

  it('merges yearSnapshots into tournaments played count', () => {
    const profile = {
      history: [{ tournamentId: 't3', place: 5, date: '2026-03-01' }],
      yearSnapshots: {
        '2025': {
          history: [
            { tournamentId: 't1', place: 2, date: '2025-06-01' },
            { tournamentId: 't2', place: 8, date: '2025-09-01' },
          ],
        },
      },
    };
    const ctx = buildAchievementContext(profile, { total: 0 });
    assert.equal(ctx.tournamentsPlayed, 3);
    assert.equal(ctx.top3Finishes, 1);
  });

  it('collectAchievementHistory dedupes by tournamentId', () => {
    const profile = {
      history: [{ tournamentId: 't1', place: 1 }],
      yearSnapshots: {
        '2025': { history: [{ tournamentId: 't1', place: 1 }, { tournamentId: 't2', place: 3 }] },
      },
    };
    const { collectAchievementHistory } = require('../../src/shared/achievement/history');
    assert.equal(collectAchievementHistory(profile).length, 2);
  });
});
