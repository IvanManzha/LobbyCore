#!/usr/bin/env node
// scripts/db_scripts/clearAllDuplicates.js

require('dotenv').config();
const Knex = require('knex');

// Если вы запустите с NODE_ENV=test — попадёт в тестовую БД,
// иначе — в «обычную» (development/production) из knexfile.js
const env = process.env.NODE_ENV || 'development';
const knexConfig = require('../../knexfile')[env];
const db = Knex(knexConfig);

async function main() {
  console.log(`→ Cleaning participants duplicates in "${env}" DB...`);

  // Participants: оставляем по одному (минимальный id) на (match_ref, player_name)
  await db.raw(`
    DELETE FROM participants
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM participants
      GROUP BY match_ref, player_name
    );
  `);

  // Matches: по одному на match_id
  await db.raw(`
    DELETE FROM matches
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM matches
      GROUP BY match_id
    );
  `);

  console.log('✅ Done.');
  await db.destroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
