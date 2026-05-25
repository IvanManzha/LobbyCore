/**
 * Учёт турнира в Ladder и DNA Lab.
 * Хранится в tournaments.extra.countInRating (boolean).
 * По умолчанию true — учитывается.
 */

function parseExtra(tournament) {
  if (!tournament) return {};
  const raw = tournament.extra;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function tournamentCountsInRating(tournament) {
  const extra = parseExtra(tournament);
  if (extra.countInRating === false) return false;
  return true;
}

module.exports = {
  parseExtra,
  tournamentCountsInRating,
};
