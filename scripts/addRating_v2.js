#!/usr/bin/env node
// applyRatingV2.js
// Скрипт для расчёта rating_v2 (скользящее окно последних 5 турниров) для каждого игрока
// Учитывает разные шкалы очков для соло-режима и командных турниров
// Запуск: из корня проекта выполните `node scripts/applyRatingV2.js`

const fs = require('fs').promises;
const path = require('path');

// Путь к папке с профилями игроков (относительно скрипта)
const playersDir = path.join(__dirname, '../data/players');
// Путь к файлу с информацией о турнирах
const tournamentsFile = path.join(__dirname, '../data/tournaments.json');

// Очки за место для командных турниров (стандартная шкала)
const teamPlacePoints = {
  1: 100,
  2: 75,
  3: 50,
  4: 25,
  5: 20
};
// Очки за место для соло-режима
const soloPlacePoints = {
  1: 100,
  2: 90,
  3: 75,
  4: 65,
  5: 50,
  6: 40
};
// Очки для остальных мест
const defaultTeamPoints = 15;
const defaultSoloPoints = 25;

async function loadTournaments() {
  const content = await fs.readFile(tournamentsFile, 'utf-8');
  const tournaments = JSON.parse(content);
  // Преобразуем в объект по id для быстрого доступа
  return tournaments.reduce((map, t) => {
    map[t.id] = t.type;
    return map;
  }, {});
}

async function calculateRatingV2() {
  try {
    const tournamentTypes = await loadTournaments();
    const files = await fs.readdir(playersDir);

    for (const file of files) {
      if (path.extname(file) !== '.json') continue;
      const filePath = path.join(playersDir, file);
      const player = JSON.parse(await fs.readFile(filePath, 'utf-8'));

      const history = (player.history || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      const recent = history.filter(entry => entry.tournamentId !== 'HotDrop').slice(-5);  // <-- исключаем Hot Drop

      const ratingV2 = recent.reduce((sum, entry) => {
        const type = tournamentTypes[entry.tournamentId] || 'team';
        let points;
        if (type === 'solo') {
          points = soloPlacePoints[entry.place] || defaultSoloPoints;
        } else {
          points = teamPlacePoints[entry.place] || defaultTeamPoints;
        }
        return sum + points;
      }, 0);

      player.rating_v2 = ratingV2;
      await fs.writeFile(filePath, JSON.stringify(player, null, 2), 'utf-8');
      console.log(`Updated ${player.name}: rating_v2 = ${ratingV2}`);
    }

    console.log('Rating V2 calculation completed.');
  } catch (err) {
    console.error('Error calculating rating_v2:', err);
  }
}

calculateRatingV2();
