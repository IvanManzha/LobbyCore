// scripts/db_scripts/clearTestDb.js
require('dotenv').config();
const Knex = require('knex');

const testDb = Knex({
  client: 'sqlite3',
  connection: { filename: './data/pubg_test.db' },
  useNullAsDefault: true
});

async function main() {
  try {
    await testDb('telemetry_events').del();
    await testDb('participants').del();
    await testDb('matches').del();
    // Если есть профили — тоже очищаем
    await testDb('player_profiles').del();
    console.log('✅ Test DB cleared.');
  } catch (err) {
    console.error('Error clearing test DB:', err);
  } finally {
    await testDb.destroy();
  }
}

main();
