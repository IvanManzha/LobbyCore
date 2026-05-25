#!/usr/bin/env node
/**
 * Регистрирует test_bot_1..8 в турнир Test_Last_2 (testlast2_816160) разными командами.
 * Подбор составов проходит TeamPowerCapService (автокап по Ladder): test_bot_8 не может соло.
 *
 * Usage: node scripts/register_test_bots_test_last_2.js
 */
require('dotenv').config();
const TournamentService = require('../src/backend/services/TournamentService');
const TeamPowerCapService = require('../src/backend/services/TeamPowerCapService');

const TOURNAMENT_ID = 'testlast2_816160';

/** Разные размеры: 2+3+2+1 игрока; имена случайные, уникальные. */
const TEAMS = [
  { captain: 'test_bot_8', members: ['test_bot_8', 'test_bot_1'] },
  { captain: 'test_bot_7', members: ['test_bot_7', 'test_bot_6', 'test_bot_3'] },
  { captain: 'test_bot_5', members: ['test_bot_5', 'test_bot_2'] },
  { captain: 'test_bot_4', members: ['test_bot_4'] }
];

function randomTeamName() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `MixRnd${n}`.slice(0, 24);
}

async function main() {
  const tournament = await TournamentService.getTournamentById(TOURNAMENT_ID);
  if (!tournament) {
    console.error('Турнир не найден:', TOURNAMENT_ID);
    process.exit(1);
  }
  console.log('Турнир:', tournament.name, tournament.id, tournament.type);

  const existing = tournament.registration?.entries || [];
  const takenNames = new Set(existing.map((e) => (e.kind === 'team' ? e.name : e.playerId)).filter(Boolean));

  for (const team of TEAMS) {
    let teamName = randomTeamName();
    let guard = 0;
    while (takenNames.has(teamName) && guard++ < 50) {
      teamName = randomTeamName();
    }
    takenNames.add(teamName);

    const v = await TeamPowerCapService.validateTeamPower(team.members, tournament);
    if (!v.allowed) {
      console.error('Кап не проходит до регистрации:', teamName, team.members, v);
      process.exit(1);
    }

    await TournamentService.register(TOURNAMENT_ID, team.captain, {
      kind: 'team',
      teamName,
      members: team.members
    });
    console.log('OK:', teamName, '→', team.members.join(', '));
  }

  const updated = await TournamentService.getTournamentById(TOURNAMENT_ID);
  console.log('Всего записей:', (updated.registration?.entries || []).length);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
