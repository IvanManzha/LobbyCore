// src/backend/services/ChampionshipsService.js
const fs = require('fs');
const path = require('path');
const TournamentService = require('./TournamentService');
const PlayerService = require('./PlayerService');
const { playerStatsPath } = require('../config/dataPaths');

const DONE_STATES = ['Турнир окончен', 'DONE'];

function isTournamentDone(state) {
  return state && DONE_STATES.includes(state);
}

function normalizeMode(type) {
  if (!type) return 'mixed';
  const t = String(type).toLowerCase();
  if (['solo', 'duo', 'squad', 'mixed', 'team'].includes(t)) return t;
  return 'mixed';
}

/**
 * Определить чемпионов по таблице турнира (топ-1).
 * Solo: один игрок. Team: список игроков команды (если состав известен).
 * @returns { { playerIds: string[], kind: 'solo'|'team', teamName?: string } | null }
 */
function getChampionsFromTable(tournamentMeta, table) {
  if (!table || !table.teams || !Array.isArray(table.teams)) return null;
  const winner = table.teams.find(t => t.rank === 1);
  if (!winner) return null;

  const type = (tournamentMeta.type || '').toLowerCase();
  const isSolo = type === 'solo';

  if (isSolo) {
    const playerId = winner.players && winner.players[0] ? winner.players[0] : winner.name;
    return { playerIds: [playerId], kind: 'solo' };
  }

  const players = winner.players && Array.isArray(winner.players) ? winner.players : null;
  if (!players || players.length === 0) {
    return null;
  }
  return {
    playerIds: [...players],
    kind: 'team',
    teamName: winner.name
  };
}

function ensurePlayerStatsFile() {
  const dir = path.dirname(playerStatsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(playerStatsPath)) {
    fs.writeFileSync(playerStatsPath, JSON.stringify({}, null, 2), 'utf8');
  }
}

function loadPlayerStats() {
  ensurePlayerStatsFile();
  try {
    const data = fs.readFileSync(playerStatsPath, 'utf8');
    return data.trim() ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

function savePlayerStats(data) {
  ensurePlayerStatsFile();
  fs.writeFileSync(playerStatsPath, JSON.stringify(data, null, 2), 'utf8');
}

function canonicalPlayerId(name) {
  return PlayerService.normalizeUsername(name || '');
}

/**
 * Пересчитать чемпионства для игрока по всем завершённым турнирам (backfill).
 * @param {string} playerId - имя/ник игрока (будет нормализован для ключа)
 * @returns {Promise<{{ total: number, solo: number, team: number, items: Array<{tournamentId:string,tournamentName:string,date:string,mode:string,kind:string,teamName?:string}>, updatedAt: string }}>}
 */
async function rebuildChampionshipsForPlayer(playerId) {
  const tournaments = await TournamentService.getAllTournaments();
  const doneTournaments = (tournaments || []).filter(t => isTournamentDone(t.state));
  const items = [];
  const seen = new Set();

  for (const meta of doneTournaments) {
    const tournamentId = meta.id || meta._id;
    if (!tournamentId) continue;
    let table;
    try {
      table = await TournamentService.getTournamentTable(tournamentId);
    } catch (e) {
      continue;
    }
    const champ = getChampionsFromTable(meta, table);
    if (!champ) continue;

    const key = canonicalPlayerId(playerId);
    const champIdsNormalized = champ.playerIds.map(p => canonicalPlayerId(p));
    if (!champIdsNormalized.includes(key)) continue;

    const dedupeKey = `${tournamentId}:${champ.kind}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const mode = normalizeMode(meta.type);
    items.push({
      tournamentId,
      tournamentName: meta.name || tournamentId,
      date: meta.date || '',
      mode,
      kind: champ.kind,
      teamName: champ.teamName
    });
  }

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const solo = items.filter(i => i.kind === 'solo').length;
  const team = items.filter(i => i.kind === 'team').length;

  return {
    total: items.length,
    solo,
    team,
    items,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Убедиться, что у игрока есть актуальные данные чемпионств (при отсутствии — пересчёт).
 * @param {string} playerId - имя/ник игрока
 * @returns {Promise<{{ total: number, solo: number, team: number, items: Array, updatedAt: string }}>}
 */
async function ensureChampionships(playerId) {
  const key = canonicalPlayerId(playerId);
  const all = loadPlayerStats();
  const existing = all[key] && all[key].championships;

  if (existing && existing.items && Array.isArray(existing.items)) {
    return existing;
  }

  const data = await rebuildChampionshipsForPlayer(playerId);
  if (!all[key]) all[key] = {};
  all[key].championships = data;
  savePlayerStats(all);
  return data;
}

/**
 * Обновить чемпионства при завершении турнира: добавить запись всем чемпионам.
 * @param {string} tournamentId
 */
async function updateChampionshipsForTournament(tournamentId) {
  let meta;
  try {
    meta = await TournamentService.getTournamentById(tournamentId);
  } catch (e) {
    return;
  }
  if (!meta || !isTournamentDone(meta.state)) return;

  let table;
  try {
    table = await TournamentService.getTournamentTable(tournamentId);
  } catch (e) {
    return;
  }

  const champ = getChampionsFromTable(meta, table);
  if (!champ || !champ.playerIds.length) return;

  const mode = normalizeMode(meta.type);
  const newItem = {
    tournamentId,
    tournamentName: meta.name || tournamentId,
    date: meta.date || '',
    mode,
    kind: champ.kind,
    teamName: champ.teamName
  };

  const all = loadPlayerStats();
  for (const name of champ.playerIds) {
    const key = canonicalPlayerId(name);
    if (!key) continue;
    if (!all[key]) all[key] = {};
    let c = all[key].championships;
    if (!c || !Array.isArray(c.items)) {
      c = await rebuildChampionshipsForPlayer(name);
      all[key].championships = c;
    }
    const dedupeKey = `${tournamentId}:${champ.kind}`;
    if (c.items.some(i => `${i.tournamentId}:${i.kind}` === dedupeKey)) continue;
    c.items.unshift(newItem);
    c.total = c.items.length;
    c.solo = c.items.filter(i => i.kind === 'solo').length;
    c.team = c.items.filter(i => i.kind === 'team').length;
    c.updatedAt = new Date().toISOString();
  }
  savePlayerStats(all);
}

/**
 * Получить чемпионства игрока (с backfill при отсутствии).
 * @param {string} playerId - имя/ник
 * @returns {Promise<{{ total: number, solo: number, team: number, items: Array, updatedAt: string }}>}
 */
async function getChampionships(playerId) {
  return await ensureChampionships(playerId);
}

module.exports = {
  getChampionsFromTable,
  rebuildChampionshipsForPlayer,
  ensureChampionships,
  updateChampionshipsForTournament,
  getChampionships,
  loadPlayerStats,
  savePlayerStats,
  isTournamentDone
};
