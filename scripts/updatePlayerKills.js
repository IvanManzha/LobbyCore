// scripts/updatePlayerKills.js
// ⚠️ DEPRECATED: Этот скрипт устарел. Киллы игроков теперь обновляются автоматически через MatchMonitorService.
// Оставлен для случаев, когда нужно вручную исправить данные.

const fs   = require('fs');
const path = require('path');

// Аргументы: <tournamentId> "Team Name" "Player Name" <matchNumber> <kills>
const [ , , tournamentId, teamName, playerName, matchStr, killsStr ] = process.argv;

if (!tournamentId || !teamName || !playerName || !matchStr || !killsStr) {
  console.error('Usage: node updatePlayerKills.js <TournamentId> "Team Name" "Player Name" <matchNumber> <kills>');
  process.exit(1);
}

const matchNum = parseInt(matchStr, 10);
const kills    = parseInt(killsStr,   10);

const tablePath = path.join(__dirname, '..', 'data', 'tournaments', tournamentId, 'table.json');
if (!fs.existsSync(tablePath)) {
  console.error(`❌ Tournament not found: ${tournamentId}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
const rounds = data.tournament.rounds;

// Валидация
if (isNaN(matchNum) || matchNum < 1 || matchNum > rounds) {
  console.error(`❌ matchNumber must be between 1 and ${rounds}`);
  process.exit(1);
}
if (isNaN(kills) || kills < 0) {
  console.error(`❌ kills must be a non-negative integer`);
  process.exit(1);
}

// Находим команду
const team = data.teams.find(t => t.name === teamName);
if (!team) {
  console.error(`❌ Team "${teamName}" not found`);
  process.exit(1);
}

// Находим игрока в команде
const idx = (team.players || []).indexOf(playerName);
if (idx === -1) {
  console.error(`❌ Player "${playerName}" not in team "${teamName}"`);
  process.exit(1);
}

// Инициализируем массив playerKills, если нужно
if (!Array.isArray(team.playerKills) || team.playerKills.length !== team.players.length) {
  team.playerKills = team.players.map(() => ({ kills: Array(rounds).fill(null) }));
}

// Гарантируем длину каждого kills[]
team.playerKills.forEach(pk => {
  if (!Array.isArray(pk.kills) || pk.kills.length !== rounds) {
    pk.kills = Array(rounds).fill(null);
  }
});

// Записываем только одну ячейку
team.playerKills[idx].kills[matchNum - 1] = kills;

console.log(`✅ ${teamName} -> ${playerName} [match ${matchNum}] = ${kills} kills`);

// Сохраняем весь JSON одним write
fs.writeFileSync(tablePath,
  JSON.stringify(data, null, 2) + '\n',
  'utf8'
);

console.log(`✅ updatePlayerKills applied to tournament "${tournamentId}".`);
