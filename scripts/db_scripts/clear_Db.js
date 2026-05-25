// scripts/db_scripts/clearDb.js
// Скрипт для полной очистки всех данных из БД (SQLite через knex)
require('dotenv').config();
const { db } = require('../../lib/db');

async function clearDatabase() {
  try {
    // Удаляем сначала зависимости (foreign keys)
    await db('telemetry_events').del();
    console.log('Cleared table telemetry_events');

    await db('participants').del();
    console.log('Cleared table participants');

    await db('matches').del();
    console.log('Cleared table matches');

    console.log('Database successfully cleared.');
  } catch (err) {
    console.error('Error clearing database:', err);
    process.exit(1);
  } finally {
    // Завершаем соединение
    await db.destroy();
  }
}

clearDatabase();
