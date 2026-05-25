// scripts/updateResult.js
// ⚠️ DEPRECATED: Этот скрипт устарел. Результаты теперь обновляются автоматически через MatchMonitorService.
// Оставлен для случаев, когда нужно вручную исправить данные.

const fs = require('fs');
const path = require('path');

// Получаем аргументы
const [ , , tournamentId, ...params ] = process.argv;

if (!tournamentId || params.length % 4 !== 0) {
  console.error(`
Usage:
  node updateResult.js <TournamentId> "Team Name" <matchNumber> <placement> <kills> ["Team2" m p k ...]

Example:
  node updateResult.js budget_srazhenie "Alpha" 2 3 5 "Bravo" 1 1 4
`);
  process.exit(1);
}

// Путь к файлу турнира
const tablePath = path.join(__dirname, '..', 'data', 'tournaments', tournamentId, 'table.json');

// Проверяем существование файла турнира
if (!fs.existsSync(tablePath)) {
  console.error(`❌ Турнир с ID "${tournamentId}" не найден.`);
  process.exit(1);
}

// Загружаем данные турнира
const tableData = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

// Обрабатываем каждый блок по 4 параметра
for (let i = 0; i < params.length; i += 4) {
  const teamName = params[i];
  const matchNumber = parseInt(params[i + 1], 10);
  const placement = parseInt(params[i + 2], 10);
  const kills = parseInt(params[i + 3], 10);

  const team = tableData.teams.find(t => t.name === teamName);

  if (!team) {
    console.error(`❌ Команда "${teamName}" не найдена в турнире "${tournamentId}"`);
    continue;
  }

  if (matchNumber < 1 || matchNumber > tableData.tournament.rounds) {
    console.error(`❌ Неверный номер матча для команды "${teamName}": матч ${matchNumber}`);
    continue;
  }

  if (!team.results[matchNumber - 1]) {
    console.error(`❌ Матч ${matchNumber} не существует в команде "${teamName}"`);
    continue;
  }

  team.results[matchNumber - 1] = { placement, kills };

  console.log(`✅ Обновлено для "${teamName}": матч ${matchNumber}, место ${placement}, киллы ${kills}`);
}

// Сохраняем изменения обратно
fs.writeFileSync(tablePath, JSON.stringify(tableData, null, 2), 'utf8');
console.log('✅ Все результаты успешно обновлены.');
