// services/pubgApi.js
require('dotenv').config();
const axios = require('axios');

// Создаём axios-инстанс для PUBG API
const PUBG = axios.create({
  baseURL: 'https://api.pubg.com',
  headers: {
    Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
    Accept: 'application/vnd.api+json',
  },
  timeout: 10000,
});

/**
 * Получить профиль игрока по нику или по UUID
 * @param {string} shard - регион/платформа ("steam", "kakao" и т.д.)
 * @param {string} identifier - либо ник (filter[playerNames]=), либо UUID игрока
 * @param {boolean} byName - если true, ищем по нику, иначе по UUID
 * @returns {Promise<Object>} - JSON-ответ с данными игрока и списком матчей
 */
async function getPlayer(shard, identifier, byName = true) {
  try {
    const url = byName
      ? `/shards/${shard}/players?filter[playerNames]=${encodeURIComponent(identifier)}`
      : `/shards/${shard}/players/${identifier}`;
    const response = await PUBG.get(url);
    return response.data;
  } catch (err) {
    console.error(`Error fetching player ${identifier}:`, err.message);
    throw err;
  }
}

/**
 * Получить список последних матчей игрока (массив UUID)
 * @param {string} shard
 * @param {string} playerName
 * @returns {Promise<string[]>}
 */
async function getPlayerMatchList(shard, playerName) {
  const data = await getPlayer(shard, playerName, true);
  // Если приходит массив data.data, берём первый элемент
  const player = Array.isArray(data.data) ? data.data[0] : data.data;
  const matches = player.relationships?.matches?.data || [];
  return matches.map(m => m.id);
}

/**
 * Получить данные матча по ID
 */
async function getMatch(shard, matchId) {
  try {
    const response = await PUBG.get(`/shards/${shard}/matches/${matchId}`);
    return response.data;
  } catch (err) {
    console.error(`Error fetching match ${matchId}:`, err.message);
    throw err;
  }
}

/**
 * Скачать полную телеметрию по URL из ответа match
 */
async function getTelemetry(telemetryUrl) {
  try {
    const response = await axios.get(telemetryUrl);
    return response.data;
  } catch (err) {
    console.error(`Error fetching telemetry from ${telemetryUrl}:`, err.message);
    throw err;
  }
}

module.exports = {
  getPlayer,
  getPlayerMatchList,
  getMatch,
  getTelemetry,
};
