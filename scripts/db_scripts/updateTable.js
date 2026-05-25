#!/usr/bin/env node
// scripts/db_scripts/updateTable.js
/*
 Скрипт автоматически перезаполняет table.json для всех матчей турнира по порядку.
 NODE_ENV=test node scripts/db_scripts/updateTable.js <tournamentId>
*/

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');
const knexfile = require('../../knexfile');
const env      = process.env.NODE_ENV || 'development';
const db       = require('knex')(knexfile[env]);

async function main() {
  const tournamentId = process.argv[2];
  if (!tournamentId) {
    console.error('Usage: node updateTable.js <tournamentId>');
    process.exit(1);
  }

  // 1) Загрузка table.json
  const tablePath = path.join(__dirname, '..', '..', 'data', 'tournaments', tournamentId, 'table.json');
  if (!fs.existsSync(tablePath)) {
    console.error(`File not found: ${tablePath}`);
    process.exit(1);
  }
  const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

  // 2) Берём все матчи турнира по времени
  const matches = await db('matches')
    .where({ tournament_id: tournamentId })
    .orderBy('played_at', 'asc')
    .select('id as matchRef', 'match_id');

  if (matches.length === 0) {
    console.error('No matches found for tournament', tournamentId);
    process.exit(1);
  }

  // 3) Перезаполняем каждый раунд (roundIndex соответствует порядку матчей)
  for (let roundIndex = 0; roundIndex < matches.length; roundIndex++) {
    const { matchRef, match_id: matchId } = matches[roundIndex];

    // вытаскиваем игроко-килы и их placement
    const rows = await db('participants')
      .where({ match_ref: matchRef })
      .select('player_name', 'kills', 'placement');

    for (const team of table.teams) {
      const members  = team.players;
      const teamRows = rows.filter(r => members.includes(r.player_name));

      // суммарные килы
      const teamKills = teamRows.reduce((sum, r) => sum + (r.kills || 0), 0);
      // место команды — берём placement первого игрока (все в команде одинаково)
      const teamPlace = teamRows.length ? teamRows[0].placement : null;

      // записываем результат раунда
      if (!team.results[roundIndex]) {
        team.results[roundIndex] = { kills: null, placement: null };
      }
      team.results[roundIndex].kills     = teamKills;
      team.results[roundIndex].placement = teamPlace;

      // перезаписываем kills по каждому игроку
      for (let i = 0; i < members.length; i++) {
        const name = members[i];
        const rec  = teamRows.find(r => r.player_name === name);
        if (!team.playerKills[i]) {
          team.playerKills[i] = { kills: [] };
        }
        team.playerKills[i].kills[roundIndex] = rec ? rec.kills : 0;
      }
    }

    console.log(`→ Round ${roundIndex + 1} (match ${matchId}) recorded`);
  }

  // 4) Сохраняем обновлённый table.json
  fs.writeFileSync(tablePath, JSON.stringify(table, null, 2), 'utf8');
  console.log(`✅ Updated ${tablePath}`);

  // 5) Пересчёт лидерборда
  exec(`node scripts/calcLeaderboard.js ${tournamentId}`, err => {
    if (err) console.error('Error running calcLeaderboard:', err);
    else     console.log('✅ Leaderboard recalculated.');
    db.destroy();
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
