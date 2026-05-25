#!/usr/bin/env node
// scripts/calcLeaderboard.js
// Пересчёт лидерборда напрямую из data/.../table.json

const fs   = require('fs');
const path = require('path');

const [ , , tournamentId ] = process.argv;
if (!tournamentId) {
  console.error(`
Usage:
  node scripts/calcLeaderboard.js <tournamentId>

Example:
  node scripts/calcLeaderboard.js HotDrop
  `);
  process.exit(1);
}

function calcLeaderboard() {
  const filePath = path.join(__dirname, '..', 'data', 'tournaments', tournamentId, 'table.json');
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Tournament table not found at ${filePath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const { tournament, teams } = data;
  const placementMap = tournament.scoring.placement;
  const perKill      = tournament.scoring.per_kill;
  const isHotDrop    = tournamentId === 'HotDrop';

  // 1) Считаем totalPoints и сохраняем
  teams.forEach(team => {
    const teamSize = Array.isArray(team.players) ? team.players.length : 1;
    const modifier = isHotDrop
      ? (teamSize === 2 ? 0.8 : teamSize === 3 ? 0.6 : 1)
      : 1;

    let total = 0;
    team.results.forEach(r => {
      let pts = 0;
      if (r.placement != null) pts += placementMap[r.placement] || 0;
      if (r.kills     != null) pts += r.kills * perKill;
      total += pts * modifier;
    });

    team.totalPoints = total;
  });

  // 2) Сортируем и присваиваем rank
  teams.sort((a, b) => b.totalPoints - a.totalPoints);
  teams.forEach((team, idx) => {
    team.rank = idx + 1;
  });

  // 3) Записываем обратно
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ Leaderboard recalculated for tournament "${tournamentId}".`);
}

if (require.main === module) {
  calcLeaderboard();
}

module.exports = calcLeaderboard;
