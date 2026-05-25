#!/usr/bin/env node
// scripts/initialize_metric_records.js
// Скрипт для инициализации рекордов метрик для всех существующих игроков

require('dotenv').config();
require('ts-node/register');

const PlayerService = require('../src/backend/services/PlayerService');
const TournamentService = require('../src/backend/services/TournamentService');
const MetricRecordsService = require('../src/backend/services/MetricRecordsService');
const { buildPlayerStats } = require('../src/stats');

async function initializeMetricRecords() {
  console.log('🚀 Начало инициализации рекордов метрик...\n');

  try {
    // Получаем всех игроков
    const players = await PlayerService.getAllPlayers();
    console.log(`📊 Найдено игроков: ${players.length}\n`);

    // Получаем все турниры
    const tournaments = await TournamentService.getAllTournaments();
    console.log(`🏆 Найдено турниров: ${tournaments.length}\n`);

    // Загружаем таблицы для всех турниров
    const tablesById = {};
    console.log('📥 Загрузка таблиц турниров...');
    await Promise.all(
      tournaments.map(async (tournament) => {
        const tournamentId = tournament?.id || tournament?._id;
        if (!tournamentId) return;
        try {
          tablesById[tournamentId] = await TournamentService.getTournamentTable(tournamentId);
        } catch (err) {
          tablesById[tournamentId] = null;
        }
      })
    );
    console.log(`✅ Загружено таблиц: ${Object.keys(tablesById).length}\n`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    // Обрабатываем каждого игрока
    for (const playerName of players) {
      try {
        const profile = await PlayerService.getPlayerProfile(playerName);
        if (!profile) {
          console.log(`⚠️  Профиль не найден: ${playerName}`);
          errors++;
          continue;
        }

        const playerId = profile.pubgNick || profile.username || playerName;
        const pubgNick = profile.pubgNick || profile.username || playerName;

        // Вычисляем статистику для all_time
        const stats = buildPlayerStats(
          pubgNick,
          { profile, tournaments, tablesById },
          { scope: 'all_time', includeLive: false, modeFilter: 'all' }
        );

        // Обновляем рекорды
        await MetricRecordsService.updateAllRecordsForPlayer(playerId, stats, 'all_time');
        
        processed++;
        if (processed % 10 === 0) {
          console.log(`⏳ Обработано: ${processed}/${players.length}`);
        }
      } catch (error) {
        console.error(`❌ Ошибка для ${playerName}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ Инициализация завершена!`);
    console.log(`   Обработано: ${processed}`);
    console.log(`   Ошибок: ${errors}`);
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeMetricRecords()
    .then(() => {
      console.log('\n🎉 Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Фатальная ошибка:', error);
      process.exit(1);
    });
}

module.exports = { initializeMetricRecords };
