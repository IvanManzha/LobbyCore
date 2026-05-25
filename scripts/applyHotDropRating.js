// scripts/applyHotDropRating.js
// Точечное начисление рейтинга игрокам за турнир HotDrop,
// без пересчёта всех турниров и без сброса рейтинга.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tournamentsListPath = path.join(ROOT, 'data', 'tournaments.json');
const tournamentsDir = path.join(ROOT, 'data', 'tournaments');
const playersDir = path.join(ROOT, 'data', 'players');

const HOT_DROP_ID = 'HotDrop';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function applyHotDropRating() {
  console.log('🏁 Начинаем точечное начисление рейтинга за HotDrop…');

  const tournaments = readJson(tournamentsListPath);
  const tournament = tournaments.find((t) => t.id === HOT_DROP_ID);
  if (!tournament) {
    console.error(`❌ Турнир ${HOT_DROP_ID} не найден в tournaments.json`);
    process.exit(1);
  }

  const tableFile = path.join(tournamentsDir, HOT_DROP_ID, 'table.json');
  if (!fs.existsSync(tableFile)) {
    console.error(`❌ Файл таблицы турнира не найден: ${tableFile}`);
    process.exit(1);
  }

  const table = readJson(tableFile);

  // ratingRules ищем аналогично applyRatings.js
  const rules =
    (table.tournament && table.tournament.ratingRules) ||
    tournament.ratingRules ||
    null;

  if (!rules || !rules.placement) {
    console.error(`❌ Для турнира ${HOT_DROP_ID} нет ratingRules. Прерываемся.`);
    process.exit(1);
  }

  console.log(
    `🏆 Турнир ${HOT_DROP_ID} («${table.tournament.name}») — начисляем рейтинг только за этот турнир`
  );

  let updatedPlayers = 0;

  for (const team of table.teams) {
    const placeStr = String(team.rank);
    const delta =
      rules.placement[placeStr] != null ? rules.placement[placeStr] : rules.default || 0;

    // Определяем список участников: для solo — имя команды, иначе список игроков
    const participants =
      table.tournament.type === 'solo'
        ? [team.name]
        : Array.isArray(team.players) && team.players.length > 0
        ? team.players
        : [team.name];

    const totalKills = (team.results || []).reduce(
      (sum, r) => sum + (r.kills || 0),
      0
    );

    for (const nick of participants) {
      const playerFile = path.join(playersDir, `${nick}.json`);
      if (!fs.existsSync(playerFile)) {
        console.warn(`   – профиль ${nick} не найден, пропускаем`);
        continue;
      }

      const profile = readJson(playerFile);
      const history = Array.isArray(profile.history) ? profile.history : [];

      let entry = history.find((h) => h.tournamentId === HOT_DROP_ID);

      // Если запись уже есть и место числовое – считаем, что рейтинг уже учтён
      if (entry && typeof entry.place === 'number') {
        console.log(
          `   ⏭ ${nick}: запись о HotDrop уже с числовым place (${entry.place}), рейтинг не трогаем`
        );
        continue;
      }

      const oldRating = profile.rating || 0;
      const newRating = oldRating + delta;

      if (!entry) {
        // Создаём новую запись, если её не было
        entry = {
          tournamentId: HOT_DROP_ID,
          tournamentName: tournament.name,
          date: tournament.date,
          place: team.rank,
          points: team.totalPoints,
          personalKills: totalKills,
          oldRating: oldRating,
          newRating: newRating
        };
        history.push(entry);
      } else {
        // Обновляем существующую "полу-пустую" запись
        entry.place = team.rank;
        entry.points = team.totalPoints;
        entry.personalKills = totalKills;
        entry.oldRating = entry.oldRating != null ? entry.oldRating : oldRating;
        entry.newRating = newRating;
      }

      profile.history = history;
      profile.rating = newRating;

      writeJson(playerFile, profile);
      updatedPlayers += 1;
      console.log(
        `   ✅ ${nick}: place=${team.rank}, pts=${team.totalPoints}, kills=${totalKills}, рейтинг: ${oldRating} → ${newRating} (Δ=${delta})`
      );
    }
  }

  if (updatedPlayers === 0) {
    console.log('ℹ️  Не найдено игроков, которым нужно обновлять рейтинг за HotDrop.');
  } else {
    console.log(`\n✅ Рейтинг за HotDrop обновлён для ${updatedPlayers} игроков.`);
  }
}

if (require.main === module) {
  applyHotDropRating();
}

module.exports = { applyHotDropRating };

