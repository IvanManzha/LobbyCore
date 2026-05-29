/**
 * Фильтры тестовых турниров и игроков для UI.
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

export function isTestTournament(t) {
  if (!t) return false;
  const id = t.id || t._id || '';
  const name = t.name || '';
  return matchesAny(id, TEST_TOURNAMENT_ID_PATTERNS) || /^test[\s_]/i.test(name);
}

export function isTestPlayerName(name) {
  return matchesAny(name, TEST_PLAYER_PATTERNS);
}

export function filterTournaments(list) {
  return (list || []).filter((t) => !isTestTournament(t));
}

/** Победитель выглядит как тестовый бот/команда */
export function isTestChampionTeam(team) {
  if (!team) return true;
  const name = team.name || '';
  if (isTestPlayerName(name)) return true;
  const players = team.players || [];
  if (players.length && players.every((p) => isTestPlayerName(p))) return true;
  return false;
}
