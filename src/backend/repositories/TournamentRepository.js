/**
 * DB access for tournaments and tournament_teams.
 * Чтение: актуальная БД + архив (pubg.db). Запись новых турниров — только актуальная БД.
 */
const { db, dbLegacy, knexForTournament, clearTournamentDbCache } = require('../../../lib/db');

function rowToTournament(row) {
  if (!row) return null;
  const extra = row.extra ? (typeof row.extra === 'string' ? JSON.parse(row.extra) : row.extra) : {};
  const t = {
    id: row.id,
    name: row.name,
    date: row.date,
    type: row.type,
    state: row.state,
    startAt: row.start_at ? (row.start_at instanceof Date ? row.start_at.toISOString() : row.start_at) : null,
    price: row.price != null ? row.price : null,
    rounds: row.rounds != null ? row.rounds : 5,
    playedRounds: row.played_rounds != null ? row.played_rounds : 0,
    barrier: row.barrier != null ? row.barrier : null,
    rules: row.rules || '',
    ratingRules: row.rating_rules ? (typeof row.rating_rules === 'string' ? JSON.parse(row.rating_rules) : row.rating_rules) : null,
    registration: row.registration ? (typeof row.registration === 'string' ? JSON.parse(row.registration) : row.registration) : null,
    extra
  };
  if (extra.finance != null) t.finance = extra.finance;
  const capMode = extra.teamCapMode;
  t.teamCapMode = capMode === 'manual' ? 'manual' : 'auto';
  return t;
}

function rowToTeam(row) {
  if (!row) return null;
  return {
    name: row.name,
    players: row.players ? (typeof row.players === 'string' ? JSON.parse(row.players) : row.players) : [],
    budget: row.budget ? (typeof row.budget === 'string' ? JSON.parse(row.budget) : row.budget) : [],
    results: row.results ? (typeof row.results === 'string' ? JSON.parse(row.results) : row.results) : [],
    playerKills: row.player_kills ? (typeof row.player_kills === 'string' ? JSON.parse(row.player_kills) : row.player_kills) : [],
    playerDeaths: row.player_deaths ? (typeof row.player_deaths === 'string' ? JSON.parse(row.player_deaths) : row.player_deaths) : [],
    totalPoints: row.total_points != null ? row.total_points : 0,
    rank: row.rank != null ? row.rank : 0
  };
}

function tournamentToRow(t) {
  const row = {
    id: t.id,
    name: t.name || '',
    date: t.date || '',
    type: t.type || 'solo',
    state: t.state || 'Запланирован',
    start_at: t.startAt ? (typeof t.startAt === 'string' ? new Date(t.startAt) : t.startAt) : null,
    price: t.price != null ? t.price : null,
    rounds: t.rounds != null ? t.rounds : 5,
    played_rounds: t.playedRounds != null ? t.playedRounds : 0,
    barrier: t.barrier != null ? t.barrier : null,
    rules: t.rules || '',
    rating_rules: t.ratingRules ? JSON.stringify(t.ratingRules) : null,
    registration: t.registration ? JSON.stringify(t.registration) : null
  };
  if (t.scoring != null) row.scoring = JSON.stringify(t.scoring);
  const extra = { ...(t.extra || {}) };
  if (t.finance != null) extra.finance = t.finance;
  if (t.teamCapMode != null) extra.teamCapMode = t.teamCapMode;
  if (Object.keys(extra).length > 0) row.extra = JSON.stringify(extra);
  return row;
}

function teamToRow(tournamentId, team) {
  return {
    tournament_id: tournamentId,
    name: team.name || '',
    rank: team.rank != null ? team.rank : 0,
    total_points: team.totalPoints != null ? team.totalPoints : 0,
    players: team.players ? JSON.stringify(team.players) : null,
    budget: team.budget ? JSON.stringify(team.budget) : null,
    results: team.results ? JSON.stringify(team.results) : null,
    player_kills: team.playerKills ? JSON.stringify(team.playerKills) : null,
    player_deaths: team.playerDeaths ? JSON.stringify(team.playerDeaths) : null
  };
}

function sortRowsByDateDesc(rows) {
  return rows.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db_ = b.date ? new Date(b.date).getTime() : 0;
    return db_ - da;
  });
}

async function getAll() {
  const primaryRows = await db('tournaments').select('*');
  let legacyRows = [];
  if (dbLegacy) {
    legacyRows = await dbLegacy('tournaments').select('*');
  }
  const byId = new Map();
  for (const row of legacyRows) byId.set(row.id, row);
  for (const row of primaryRows) byId.set(row.id, row);
  return sortRowsByDateDesc([...byId.values()]).map(rowToTournament);
}

async function getById(id) {
  const row = await db('tournaments').where({ id }).first();
  if (row) return rowToTournament(row);
  if (!dbLegacy) return null;
  const legacyRow = await dbLegacy('tournaments').where({ id }).first();
  return rowToTournament(legacyRow);
}

async function getTableByTournamentId(tournamentId) {
  const k = await knexForTournament(tournamentId);
  const row = await k('tournaments').where({ id: tournamentId }).first();
  if (!row) return null;

  const scoring = row.scoring ? (typeof row.scoring === 'string' ? JSON.parse(row.scoring) : row.scoring) : { placement: {}, per_kill: 2 };
  const tournamentMeta = {
    id: tournamentId,
    name: row.name,
    type: row.type,
    rounds: row.rounds,
    scoring
  };

  const teamRows = await k('tournament_teams').where({ tournament_id: tournamentId }).orderBy('rank', 'asc');
  const teams = teamRows.map(rowToTeam);

  const maxRoundsFromTeams = teams.reduce((max, t) => {
    const len = Array.isArray(t.results) ? t.results.length : 0;
    return len > max ? len : max;
  }, 0);
  const metaRounds = row.rounds != null ? Number(row.rounds) : 0;
  tournamentMeta.rounds = Math.max(metaRounds, maxRoundsFromTeams);

  return { tournament: tournamentMeta, teams };
}

async function saveTable(tournamentId, tableData) {
  const k = await knexForTournament(tournamentId);
  const { tournament: meta, teams } = tableData;
  if (meta && meta.scoring != null) {
    await k('tournaments').where({ id: tournamentId }).update({
      scoring: JSON.stringify(meta.scoring)
    });
  }
  await k('tournament_teams').where({ tournament_id: tournamentId }).del();
  if (teams && teams.length > 0) {
    const rows = teams.map(t => teamToRow(tournamentId, t));
    await k('tournament_teams').insert(rows);
  }
}

async function create(t) {
  const row = tournamentToRow(t);
  if (t.scoring) row.scoring = JSON.stringify(t.scoring);
  await db('tournaments').insert(row);
  clearTournamentDbCache(t.id);
  return rowToTournament({ ...row, id: t.id });
}

async function update(id, patch) {
  const k = await knexForTournament(id);
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.state !== undefined) row.state = patch.state;
  if (patch.startAt !== undefined) row.start_at = patch.startAt ? new Date(patch.startAt) : null;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.rounds !== undefined) row.rounds = patch.rounds;
  if (patch.playedRounds !== undefined) row.played_rounds = patch.playedRounds;
  if (patch.barrier !== undefined) row.barrier = patch.barrier;
  if (patch.rules !== undefined) row.rules = patch.rules;
  if (patch.ratingRules !== undefined) row.rating_rules = JSON.stringify(patch.ratingRules);
  if (patch.registration !== undefined) row.registration = JSON.stringify(patch.registration);
  if (patch.scoring !== undefined) row.scoring = JSON.stringify(patch.scoring);
  if (patch.extra !== undefined) row.extra = JSON.stringify(patch.extra);

  const updated = await k('tournaments').where({ id }).update(row);
  if (updated === 0) return null;
  clearTournamentDbCache(id);
  return getById(id);
}

async function updatePlayedRounds(id, playedRounds) {
  const k = await knexForTournament(id);
  await k('tournaments').where({ id }).update({ played_rounds: playedRounds });
  clearTournamentDbCache(id);
}

async function deleteById(id) {
  const k = await knexForTournament(id);
  if (k === dbLegacy) {
    const err = new Error('Нельзя удалить турнир из архивной БД');
    err.code = 'LEGACY_TOURNAMENT_READONLY';
    throw err;
  }
  await k('tournament_teams').where({ tournament_id: id }).del();
  const deleted = await k('tournaments').where({ id }).del();
  clearTournamentDbCache(id);
  return deleted > 0;
}

module.exports = {
  getAll,
  getById,
  getTableByTournamentId,
  saveTable,
  create,
  update,
  updatePlayedRounds,
  deleteById,
  rowToTournament,
  tournamentToRow,
  teamToRow,
  rowToTeam
};
