const fs = require('fs');
const path = require('path');

function updateActiveTournament() {
  const tournamentsPath = path.join(__dirname, '..', 'data', 'tournaments.json');
  const tournaments = JSON.parse(fs.readFileSync(tournamentsPath, 'utf8'));

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let found = false;
  tournaments.forEach(t => {
    if (t.date === today) {
      t.active = true;
      found = true;
    } else {
      t.active = false;
    }
  });

  fs.writeFileSync(tournamentsPath, JSON.stringify(tournaments, null, 2), 'utf8');

  if (found) {
    console.log('✅ Активный турнир обновлен.');
  } else {
    console.log('⚠️ Сегодня нет турнира.');
  }
}

if (require.main === module) {
  updateActiveTournament();
}
