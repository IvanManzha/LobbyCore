// scripts/applyRatings.js
const fs   = require('fs');
const path = require('path');

// Пути
const tournamentsList = path.join(__dirname, '..', 'data', 'tournaments.json');
const tournamentsDir  = path.join(__dirname, '..', 'data', 'tournaments');
const playersDir      = path.join(__dirname, '..', 'data', 'players');

function applyRatings() {
  // Сначала зануляем рейтинг всех игроков
  console.log('🔄 Сбрасываем все рейтинги в 0...');
  const playerFiles = fs.readdirSync(playersDir).filter(f => f.endsWith('.json'));
  for (const file of playerFiles) {
    const pfFile = path.join(playersDir, file);
    try {
      const profile = JSON.parse(fs.readFileSync(pfFile, 'utf8'));
      profile.rating = 0;
      fs.writeFileSync(pfFile, JSON.stringify(profile, null, 2), 'utf8');
      console.log(`   ✏️  ${file.replace('.json', '')}: рейтинг = 0`);
    } catch (err) {
      console.warn(`   ⚠️  Не удалось сбросить рейтинг для ${file}:`, err.message);
    }
  }

  // Читаем глобальный список турниров с датами и правилами
  const tournaments = JSON.parse(fs.readFileSync(tournamentsList, 'utf8'))
    .filter(t => t.id !== 'HotDrop')  // <-- исключаем Hot Drop из расчета рейтинга
    .sort((a, b) => a.date.localeCompare(b.date)); // по дате

  for (const t of tournaments) {
    const tableFile = path.join(tournamentsDir, t.id, 'table.json');
    if (!fs.existsSync(tableFile)) continue;

    const table = JSON.parse(fs.readFileSync(tableFile, 'utf8'));

    // Ищем ratingRules в приоритетном порядке:
    // 1) внутри table.json
    // 2) в записи tournaments.json → t.ratingRules
    // 3) если там нет, но есть поля t.placement / t.default
    let rules = table.tournament.ratingRules
      || t.ratingRules
      || (t.placement
          ? { placement: t.placement, default: t.default || 0 }
          : null);

    if (!rules) {
      console.warn(`⚠️ Для турнира ${t.id} нет ratingRules — пропускаем`);
      continue;
    }

    console.log(`\n🏆 Турнир ${t.id} («${table.tournament.name}») — начисляем рейтинг:`);

    for (const team of table.teams) {
      const placeStr = String(team.rank);
      // дельта по занятию места или default
      const delta = rules.placement[placeStr] != null
        ? rules.placement[placeStr]
        : (rules.default || 0);

      // список ников: для соло — единственный, иначе team.players
      const participants = table.tournament.type === 'solo'
        ? [ team.name ]
        : (team.players || []);

      for (const nick of participants) {
        const pfFile = path.join(playersDir, `${nick}.json`);
        if (!fs.existsSync(pfFile)) {
          console.warn(`   – профиль ${nick} не найден, пропускаем`);
          continue;
        }
        const profile = JSON.parse(fs.readFileSync(pfFile, 'utf8'));
        profile.rating = (profile.rating || 0) + delta;
        fs.writeFileSync(pfFile, JSON.stringify(profile, null, 2), 'utf8');
        console.log(`   +${delta} → ${nick} (новый рейтинг: ${profile.rating})`);
      }
    }
  }

  console.log('\n✅ Рейтинг обновлён по всем турнирам.');
}

if (require.main === module) applyRatings();