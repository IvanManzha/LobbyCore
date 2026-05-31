/**
 * Полная история турниров для ачивок: текущая history + архив yearSnapshots.
 * Без фильтра countInRating — любой сыгранный турнир учитывается.
 * @param {object | null | undefined} profile
 * @returns {Array<object>}
 */
function collectAchievementHistory(profile) {
  if (!profile) return [];

  /** @type {Array<object>} */
  const entries = [];
  const seen = new Set();

  const push = (entry) => {
    if (!entry || typeof entry !== 'object') return;
    const id = entry.tournamentId != null ? String(entry.tournamentId) : null;
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    entries.push(entry);
  };

  (profile.history || []).forEach(push);

  const snapshots = profile.yearSnapshots || {};
  Object.keys(snapshots)
    .sort()
    .forEach((year) => {
      (snapshots[year]?.history || []).forEach(push);
    });

  return entries;
}

module.exports = {
  collectAchievementHistory,
};
