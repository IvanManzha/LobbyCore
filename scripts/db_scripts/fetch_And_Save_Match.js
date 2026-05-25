// scripts/db_scripts/fetch_And_Save_Match.js
// ⚠️ DEPRECATED: Этот скрипт устарел. Используйте автоматический мониторинг через MatchMonitorService.
// Мониторинг запускается автоматически при нажатии "Начать турнир" в UI.

// Скрипт который запоминает последний матч под определенным tournamentID

require('dotenv').config();
const path     = require('path');
const { execSync } = require('child_process');
const {
  getPlayer,
  getPlayerMatchList,
  getMatch,
  getTelemetry
} = require('../../services/pubgApi');
const {
  insertMatch,
  insertParticipants,
  db
} = require('../../lib/db');

async function main() {
  // Параметры вызова
  const tournamentId = process.argv[2] || 'Testtournament';
  const shard        = 'steam';
  const playerName   = process.argv[3] || 'IVANCHK';

  let playerId;
  try {
    // 1) Получаем профиль игрока, чтобы узнать его UUID
    const profileResp = await getPlayer(shard, playerName);
    const profileData = profileResp.data[0];
    // UUID хранится в platformId или в data.id, смотрите под каким ключом приходит
    playerId = profileData.attributes.platformId 
            || profileData.id;
    console.log(`→ Player "${playerName}" UUID: ${playerId}`);
  } catch (err) {
    console.error('Failed to fetch player profile:', err.message);
    process.exit(1);
  }

  // 2) Получаем список матчей и берём последний
  let latestMatchId;
  try {
    const matches = await getPlayerMatchList(shard, playerName);
    if (!matches.length) {
      console.log(`No matches found for ${playerName}`);
      process.exit(0);
    }
    latestMatchId = matches[0];
    console.log(`→ Latest match ID: ${latestMatchId}`);
  } catch (err) {
    console.error('Failed to fetch match list:', err.message);
    process.exit(1);
  }

  // 3) Загрузим данные матча
  let matchData;
  let matchRef;
  try {
    matchData = await getMatch(shard, latestMatchId);

    // Проверяем, есть ли matchId в БД
    const existing = await db('matches')
      .where({ match_id: latestMatchId })
      .first('id');

    if (existing) {
      matchRef = existing.id;
      console.log(`Match ${latestMatchId} exists with id ${matchRef}`);
    } else {
      const { createdAt: played_at, mapName: map_name } = matchData.data.attributes;
      const asset = matchData.included.find(i => i.type === 'asset');
      const telemetry = asset
        ? await getTelemetry(asset.attributes.URL)
        : null;

      matchRef = await insertMatch({
        tournament_id: tournamentId,
        match_id:      latestMatchId,
        shard,
        map_name,
        played_at,
        telemetry:    telemetry ? JSON.stringify(telemetry) : null,
        processed:     true
      });
      console.log(`Inserted match ${latestMatchId} with id ${matchRef}`);
    }
  } catch (err) {
    console.error('Error fetching or inserting match:', err.message);
    process.exit(1);
  }

  // 4) Собираем участников
  try {
    // Все объекты participant из included
    let participantsData = matchData.included.filter(i => i.type === 'participant');

    // Если турнир Testtournament — фильтруем только нашего игрока
    if (tournamentId === 'Testtournament') {
      participantsData = participantsData.filter(p =>
        p.attributes.stats.playerId === playerId
      );
    }

    // Готовим к вставке
    const participantsToSave = participantsData.map(p => ({
            match_ref:   matchRef,
            // UUID игрока из stats
            player_id:   p.attributes.stats.playerId,
            // ник прямо из API
            api_name:    p.attributes.stats.name,
            player_name: p.attributes.stats.name,
            team_id:     p.attributes.stats.teamId,
            kills:       p.attributes.stats.kills,
            damage:      p.attributes.stats.damageDealt,
            placement:   p.attributes.stats.winPlace,
            stats:       JSON.stringify({
              assists:       p.attributes.stats.assists,
              timeSurvived:  p.attributes.stats.timeSurvived,
              headshotKills:p.attributes.stats.headshotKills
            })
          }));

    if (!participantsToSave.length) {
      console.log('No participants to save.');
    } else {
      await insertParticipants(participantsToSave);
      console.log(`Saved ${participantsToSave.length} participant(s).`);
    }
  } catch (err) {
    console.error('Error inserting participants:', err.message);
    process.exit(1);
  } finally {
    // Закрываем соединение с БД
    await db.destroy();
  }
}

main();
