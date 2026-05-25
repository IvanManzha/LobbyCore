// scripts/addRating.js
//Просто добавляет поле rating после пересборки профилей
const fs = require('fs');
const path = require('path');

// Папка с профилями игроков
const playersFolder = path.join(__dirname, '..', 'data', 'players');

function addRatingToProfiles() {
  if (!fs.existsSync(playersFolder)) {
    console.error('Папка игроков не найдена:', playersFolder);
    process.exit(1);
  }

  const files = fs.readdirSync(playersFolder).filter(f => f.endsWith('.json'));
  console.log(`Найдено профилей: ${files.length}`);

  files.forEach(file => {
    const filePath = path.join(playersFolder, file);
    const raw     = fs.readFileSync(filePath, 'utf8');
    let profile;
    try {
      profile = JSON.parse(raw);
    } catch (e) {
      console.error(`Ошибка парсинга ${file}:`, e);
      return;
    }

    if (profile.rating == null) {
      profile.rating = 0;
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf8');
      console.log(`Добавлено rating=0 в ${file}`);
    } else {
      console.log(`Пропущено ${file} (rating уже есть)`);
    }
  });

  console.log('Готово.');
}

if (require.main === module) {
  addRatingToProfiles();
}
