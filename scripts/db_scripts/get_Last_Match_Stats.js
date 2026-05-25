// scripts/db_scripts/getMatchStats.js
/**
 * Скрипт для логирования статистики всех игроков последнего матча турнира
 */

require('dotenv').config();
const { db } = require('../../lib/db');

async function main() {
  const tournamentId = process.argv[2] || 'Testtournament';

  // 1) Найти последний матч этого турнира
  const match = await db('matches')
    .where({ tournament_id: tournamentId })
    .orderBy('played_at', 'desc')
    .first('id', 'match_id', 'map_name', 'played_at');

  if (!match) {
    console.log(`Турнир "${tournamentId}" не содержит ни одного матча.`);
    process.exit(0);
  }

  console.log(`\n=== Статистика последнего матча турнира "${tournamentId}" ===`);
  console.log(`Матч ID: ${match.match_id}`);
  console.log(`Карта:   ${match.map_name}`);
  console.log(`Дата:    ${match.played_at}\n`);

  // 2) Забрать всех участников этого матча
  const rows = await db('participants')
    .where({ match_ref: match.id })
    .select('player_id', 'player_name', 'kills', 'damage', 'placement', 'stats');

  if (!rows.length) {
    console.log('В этом матче нет участников.');
    process.exit(0);
  }

  // 3) Вывести по каждому
  for (const r of rows) {
    console.log(`Игрок:    ${r.player_name} (${r.player_id})`);
    console.log(`  Убийств:     ${r.kills}`);
    console.log(`  Урона:       ${r.damage}`);
    console.log(`  Место:       ${r.placement}`);
    console.log('  Дополнительно:');
    const extra = JSON.parse(r.stats || '{}');
    for (const [k, v] of Object.entries(extra)) {
      console.log(`    ${k}: ${v}`);
    }
    console.log('-----------------------------------');
  }

  await db.destroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
