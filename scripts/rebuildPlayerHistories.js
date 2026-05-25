#!/usr/bin/env node
// scripts/db_scripts/rebuildPlayerHistories.js

const fs   = require('fs');
const path = require('path');

const tournamentsPath   = path.join(__dirname, '..', 'data', 'tournaments.json');
const tournamentsFolder = path.join(__dirname, '..', 'data', 'tournaments');
const playersFolder     = path.join(__dirname, '..', 'data', 'players');
const snapshotsFolder   = path.join(__dirname, '..', 'data', 'ratingSnapshots');

// Убедимся, что папка профилей существует
if (!fs.existsSync(playersFolder)) {
  fs.mkdirSync(playersFolder, { recursive: true });
}

async function rebuildPlayerHistories() {
  // 1) Загрузим весь список турниров
  const allTournaments = JSON.parse(fs.readFileSync(tournamentsPath, 'utf8'));

  // 2) Оставим только завершённые и без "test" в ID
  const tournaments = allTournaments
    .filter(t =>
      t.state === 'Турнир окончен' &&
      !t.id.toLowerCase().includes('test')
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // 3) Предзагрузим все снапшоты для quick lookup: existingRH[tournamentId][player] = {oldRating, newRating}
  const existingRH = {};
  for (const t of tournaments) {
    const snapPath = path.join(snapshotsFolder, `${t.id}.json`);
    if (!fs.existsSync(snapPath)) continue;
    const recs = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    existingRH[t.id] = {};
    for (const r of recs) {
      existingRH[t.id][r.player] = {
        oldRating: r.ratingBefore  ?? 0,
        newRating: r.ratingAfter   ?? 0
      };
    }
  }

  // Будем собирать новые профили тут
  const newProfiles = {};

  // 4) Для каждого турнира по порядку формируем запись в истории игроков
  for (const tournament of tournaments) {
    const tablePath = path.join(tournamentsFolder, tournament.id, 'table.json');
    if (!fs.existsSync(tablePath)) continue;
    const tableData = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

    // определяем, в процессе ли турнир
    const roundsCount = tableData.tournament.rounds
      || tableData.teams[0].results.length;
    const isFirst = tournament.id === 'first_tournament';
    const inProgress = !isFirst && tableData.teams.some(team =>
      team.results.length < roundsCount ||
      team.results.some(r => r.placement == null)
    );

    // Для каждой команды / игрока
    for (const team of tableData.teams) {
      const players = tournament.type === 'solo'
        ? [team.name]
        : (team.players || []);

      players.forEach((playerName, idx) => {
        // инициализируем, если ещё нет
        if (!newProfiles[playerName]) {
          newProfiles[playerName] = { name: playerName, history: [] };
        }

        // считаем личные киллы
        let personalKills = 'Не учитывались';
        if (!isFirst) {
          if (tournament.type !== 'solo' && team.playerKills && team.playerKills[idx]) {
            personalKills = team.playerKills[idx].kills.reduce((a,b) => a + b, 0);
          } else if (tournament.type === 'solo') {
            personalKills = team.results.reduce((sum, r) => sum + (r.kills||0), 0);
          }
        }

        // базовая запись
        const entry = {
          tournamentId:   tournament.id,
          tournamentName: tournament.name,
          date:           tournament.date,
          place:          inProgress ? 'Турнир ещё идёт' : team.rank,
          points:         inProgress ? 'Турнир ещё идёт' : team.totalPoints,
          personalKills:  inProgress ? 'Турнир ещё идёт' : personalKills,
        };

        // подставляем рейтинги из снапшота
        const rhMap = existingRH[tournament.id] || {};
        if (rhMap[playerName]) {
          entry.oldRating = rhMap[playerName].oldRating;
          entry.newRating = rhMap[playerName].newRating;
        } else {
          entry.oldRating = 0;
          entry.newRating = 0;
        }

        newProfiles[playerName].history.push(entry);
      });
    }
  }

  // 5) Сохраняем полученные истории в data/players/*.json
  for (const [playerName, profile] of Object.entries(newProfiles)) {
    const outFile = path.join(playersFolder, `${playerName}.json`);
    fs.writeFileSync(outFile, JSON.stringify(profile, null, 2), 'utf8');
    console.log(`✅ Профиль обновлён: ${playerName}`);
  }

  console.log('🎉 Истории игроков полностью пересобраны из таблиц турниров и снапшотов.');
}

if (require.main === module) {
  rebuildPlayerHistories().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
