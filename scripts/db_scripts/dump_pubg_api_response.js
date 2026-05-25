/**
 * Скачивает последний матч игрока из PUBG API и сохраняет сырой ответ в JSON.
 * Используется для анализа структуры API и создания моков для тестов.
 *
 * Запуск: node scripts/db_scripts/dump_pubg_api_response.js [playerName] [shard]
 * Пример: node scripts/db_scripts/dump_pubg_api_response.js IVANCHK steam
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  getPlayer,
  getPlayerMatchList,
  getMatch,
} = require('../../services/pubgApi');

const PLAYER_NAME = process.argv[2] || 'IVANCHK';
const SHARD = process.argv[3] || 'steam';
const OUT_DIR = path.join(__dirname, '../../test/fixtures/pubg-api');

async function main() {
  if (!process.env.PUBG_API_KEY) {
    console.error('PUBG_API_KEY не задан в .env');
    process.exit(1);
  }

  console.log(`Запрос игрока: ${PLAYER_NAME}, shard: ${SHARD}\n`);

  let playerResponse;
  try {
    playerResponse = await getPlayer(SHARD, PLAYER_NAME, true);
    console.log('✓ getPlayer — получен ответ');
  } catch (err) {
    console.error('Ошибка getPlayer:', err.message);
    if (err.response?.data) console.error('Ответ API:', JSON.stringify(err.response.data).slice(0, 500));
    process.exit(1);
  }

  const player = Array.isArray(playerResponse.data) ? playerResponse.data[0] : playerResponse.data;
  if (!player) {
    console.error('Игрок не найден в ответе');
    process.exit(1);
  }

  const matchIds = (player.relationships?.matches?.data || []).map((m) => m.id);
  if (!matchIds.length) {
    console.error('У игрока нет матчей в ответе');
    process.exit(1);
  }

  const latestMatchId = matchIds[0];
  console.log(`✓ Список матчей: последний ID = ${latestMatchId}\n`);

  let matchResponse;
  try {
    matchResponse = await getMatch(SHARD, latestMatchId);
    console.log('✓ getMatch — получен ответ');
  } catch (err) {
    console.error('Ошибка getMatch:', err.message);
    if (err.response?.data) console.error('Ответ API:', JSON.stringify(err.response.data).slice(0, 500));
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const playerPath = path.join(OUT_DIR, 'player-response.json');
  const matchPath = path.join(OUT_DIR, 'match-response.json');
  const metaPath = path.join(OUT_DIR, 'meta.json');

  fs.writeFileSync(playerPath, JSON.stringify(playerResponse, null, 2), 'utf8');
  fs.writeFileSync(matchPath, JSON.stringify(matchResponse, null, 2), 'utf8');
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        playerName: PLAYER_NAME,
        shard: SHARD,
        latestMatchId,
        dumpedAt: new Date().toISOString(),
        description: 'Сырые ответы PUBG API: getPlayer и getMatch для последнего матча игрока',
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\nСохранено:`);
  console.log(`  ${playerPath}`);
  console.log(`  ${matchPath}`);
  console.log(`  ${metaPath}`);

  // Краткая выжимка структуры матча для документации
  const matchData = matchResponse.data;
  const included = matchResponse.included || [];
  const participants = included.filter((i) => i.type === 'participant');
  const asset = included.find((i) => i.type === 'asset');
  const rosters = included.filter((i) => i.type === 'roster');

  console.log('\n--- Структура ответа getMatch ---');
  console.log('data.id:', matchData?.id);
  console.log('data.type:', matchData?.type);
  console.log('data.attributes:', matchData?.attributes ? Object.keys(matchData.attributes) : []);
  if (matchData?.attributes) {
    console.log('  createdAt:', matchData.attributes.createdAt);
    console.log('  mapName:', matchData.attributes.mapName);
    console.log('  gameMode:', matchData.attributes.gameMode);
    console.log('  duration:', matchData.attributes.duration);
  }
  console.log('included: participant count =', participants.length);
  console.log('included: roster count =', rosters.length);
  console.log('included: asset =', asset ? 'есть (URL телеметрии)' : 'нет');

  if (participants.length > 0) {
    const firstStats = participants[0].attributes?.stats || {};
    console.log('\nПоля participant.attributes.stats (первый участник):', Object.keys(firstStats));
    const ivanchk = participants.find(
      (p) => (p.attributes?.stats?.name || '').toUpperCase() === PLAYER_NAME.toUpperCase()
    );
    if (ivanchk) {
      console.log(`\nУчастник ${PLAYER_NAME}:`, JSON.stringify(ivanchk.attributes.stats, null, 2));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
