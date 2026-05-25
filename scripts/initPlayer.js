// scripts/initPlayer.js
const fs = require('fs');
const path = require('path');

const [ , , playerName ] = process.argv;

if (!playerName) {
  console.error(`
Usage:
  node scripts/initPlayer.js <playerName>

Example:
  node scripts/initPlayer.js ILYA-DESTROYER
`);
  process.exit(1);
}

// Папка для хранения файлов игроков
const playersDir = path.join(__dirname, '..', 'data', 'players');

// Создаём директорию, если её нет
if (!fs.existsSync(playersDir)) {
  fs.mkdirSync(playersDir, { recursive: true });
}

const filePath = path.join(playersDir, `${playerName}.json`);

// Шаблон объекта игрока
const playerData = {
  name: playerName,
  history: [],
  calibrating: true,
  longAnchor: 0,
  effectiveRating: 0,
  ratingHistory: []
};

// Не перезаписывать, если файл уже существует
if (fs.existsSync(filePath)) {
  console.error(`❗ Файл уже существует: ${filePath}`);
  process.exit(1);
}

// Запись файла
fs.writeFileSync(filePath, JSON.stringify(playerData, null, 2), 'utf8');
console.log(`✅ Создан файл игрока: ${filePath}`);
