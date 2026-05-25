// scripts/addTeam.js

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const TOURN_PATH = path.join(DATA, 'tournaments.json');
const PLAYERS_DIR = path.join(DATA, 'players');

// Запуск: 
// solo или mixed-solo:
//   node scripts/addTeam.js <tournamentId> "PlayerName"
// команда:
//   node scripts/addTeam.js <tournamentId> "TeamName" "Player1,Player2,..."

const [ tournamentId, ...rest ] = process.argv.slice(2);
if (!tournamentId || rest.length < 1) {
  console.error('Usage:');
  console.error('  node scripts/addTeam.js <tournamentId> "PlayerName"');
  console.error('  node scripts/addTeam.js <tournamentId> "TeamName" "Player1,Player2,..."');
  process.exit(1);
}

const tournaments = JSON.parse(fs.readFileSync(TOURN_PATH,'utf8'));
const tournamentInfo = tournaments.find(t => t.id === tournamentId);
if (!tournamentInfo) {
  console.error(`Error: Tournament "${tournamentId}" not found.`);
  process.exit(1);
}

const tablePath = path.join(DATA, 'tournaments', tournamentId, 'table.json');
if (!fs.existsSync(tablePath)) {
  console.error(`Error: Table not found at ${tablePath}`);
  process.exit(1);
}

const table = JSON.parse(fs.readFileSync(tablePath,'utf8'));
const rounds = table.tournament.rounds || 0;

// Определяем режим: solo (1 ник) или команда (название + список)
let isSoloMode = false;
let teamName = '';
let players = [];

if (rest.length === 1) {
  // solo или mixed-solo
  players = [ rest[0].trim() ];
  isSoloMode = true;
} else {
  teamName = rest[0].trim();
  players  = rest[1].split(',').map(s => s.trim()).filter(Boolean);
}

// Проверяем для команды количество игроков
if (!isSoloMode && (players.length < 2 || players.length > 4)) {
  console.error('Error: Team must have 2–4 players.');
  process.exit(1);
}

// SOLO/MIXED-SOLO
if (isSoloMode) {
  const playerName = players[0];
  if (table.teams.some(t => t.name === playerName)) {
    console.error(`Warning: Player "${playerName}" already registered.`);
    process.exit(0);
  }

  const newTeam = {
    name: playerName,
    budget: [1],
    players: [playerName],
    results: Array.from({length: rounds}, () => ({placement:null,kills:null})),
    playerKills: [{kills:Array.from({length:rounds},()=>null)}],
    totalPoints: 0,
    rank: table.teams.length + 1
  };
  table.teams.push(newTeam);
  console.log(`✅ Solo: added "${playerName}" with rank ${newTeam.rank}.`);

} else {
  // Командная регистрация
  if (table.teams.some(t => t.name === teamName)) {
    console.error(`Error: Team "${teamName}" already exists.`);
    process.exit(1);
  }

  // Получаем рейтинги игроков
  const budgets = players.map(nick => {
    const pfile = path.join(PLAYERS_DIR, `${nick}.json`);
    if (!fs.existsSync(pfile)) {
      console.error(`Error: Player profile "${nick}" not found.`);
      process.exit(1);
    }
    const prof = JSON.parse(fs.readFileSync(pfile,'utf8'));
    return (typeof prof.rating === 'number' && prof.rating > 0) ? prof.rating : 1;
  });

  const sum = budgets.reduce((a,b)=>a+b,0);
  if (tournamentInfo.barrier != null && sum > tournamentInfo.barrier) {
    console.error(`Error: Total rating ${sum} exceeds barrier ${tournamentInfo.barrier}.`);
    process.exit(1);
  }

  const newTeam = {
    name: teamName,
    budget: budgets,
    players,
    results: Array.from({length: rounds}, () => ({placement:null,kills:null})),
    playerKills: players.map(() => ({kills:Array.from({length:rounds},()=>null)})),
    totalPoints: 0,
    rank: table.teams.length + 1
  };
  table.teams.push(newTeam);
  console.log(`✅ Team "${teamName}" added with rank ${newTeam.rank} and budgets [${budgets.join(',')}].`);
}

// Сохраняем обновлённую таблицу
fs.writeFileSync(tablePath, JSON.stringify(table,null,2),'utf8');
console.log(`🎉 Updated: ${tablePath}`);
