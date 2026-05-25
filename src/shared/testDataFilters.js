/**
 * Фильтры тестовых сущностей (турниры, игроки) — общие правила для UI и API.
 */

const TEST_TOURNAMENT_ID_PATTERNS = [
  /^test/i,
  /^sync_reg_/i,
  /_test_/i,
  /^payout_test/i,
  /^fin_/i,
  /^fixture_cup$/i,
  /^live_cup$/i,
  /^t[12]$/i,
];

const TEST_PLAYER_PATTERNS = [
  /^test_bot_/i,
  /^testbot/i,
  /^bot_/i,
  /^player(one|two)$/i,
  /^alice$/i,
  /^bob$/i,
];

function matchesAny(str, patterns) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return patterns.some((re) => re.test(s));
}

function isTestTournament(t) {
  if (!t) return false;
  const id = t.id || t._id || '';
  const name = t.name || '';
  return matchesAny(id, TEST_TOURNAMENT_ID_PATTERNS) || /^test[\s_]/i.test(name);
}

function isTestPlayerName(name) {
  return matchesAny(name, TEST_PLAYER_PATTERNS);
}

function filterTournaments(list) {
  return (list || []).filter((t) => !isTestTournament(t));
}

module.exports = {
  TEST_TOURNAMENT_ID_PATTERNS,
  TEST_PLAYER_PATTERNS,
  isTestTournament,
  isTestPlayerName,
  filterTournaments,
};
