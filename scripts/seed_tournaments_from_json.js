/**
 * One-time script: import all tournaments from data/tournaments.json
 * and data/tournaments/<id>/table.json into the DB (tournaments + tournament_teams).
 * Run from project root: node scripts/seed_tournaments_from_json.js
 */
const path = require('path');
const fs = require('fs');
const { db } = require('../lib/db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOURNAMENTS_JSON = path.join(DATA_DIR, 'tournaments.json');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');

const defaultScoring = {
  placement: { 1: 25, 2: 20, 3: 17, 4: 15, 5: 13, 6: 11, 7: 10, 8: 9, 9: 8, 10: 7, 11: 6, 12: 5 },
  per_kill: 2
};

function loadTable(tournamentId) {
  const tablePath = path.join(TOURNAMENTS_DIR, tournamentId, 'table.json');
  if (!fs.existsSync(tablePath)) return null;
  try {
    const data = fs.readFileSync(tablePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.warn(`Could not read table for ${tournamentId}:`, e.message);
    return null;
  }
}

function tournamentToRow(t) {
  return {
    id: t.id,
    name: t.name || '',
    date: t.date || '',
    type: t.type || 'solo',
    state: t.state || 'Запланирован',
    start_at: t.startAt ? new Date(t.startAt) : null,
    price: t.price != null ? t.price : null,
    rounds: t.rounds != null ? t.rounds : 5,
    played_rounds: t.playedRounds != null ? t.playedRounds : 0,
    barrier: t.barrier != null ? t.barrier : null,
    rules: t.rules || '',
    rating_rules: t.ratingRules ? JSON.stringify(t.ratingRules) : null,
    registration: t.registration ? JSON.stringify(t.registration) : null,
    scoring: null,
    extra: null
  };
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

async function run() {
  if (!fs.existsSync(TOURNAMENTS_JSON)) {
    console.error('Not found:', TOURNAMENTS_JSON);
    process.exit(1);
  }

  const list = JSON.parse(fs.readFileSync(TOURNAMENTS_JSON, 'utf8'));
  if (!Array.isArray(list)) {
    console.error('tournaments.json must be an array');
    process.exit(1);
  }

  await db('tournament_teams').del();
  await db('tournaments').del();

  for (const t of list) {
    const table = loadTable(t.id);
    const scoring = table?.tournament?.scoring || defaultScoring;
    const row = tournamentToRow(t);
    row.scoring = JSON.stringify(scoring);
    // rounds из table.json приоритетнее (у HotDrop в tournaments.json нет rounds, в table.json — 15)
    if (table?.tournament?.rounds != null) {
      row.rounds = Number(table.tournament.rounds);
    }

    await db('tournaments').insert(row);
    console.log('Inserted tournament:', t.id);

    if (table && Array.isArray(table.teams) && table.teams.length > 0) {
      const teamRows = table.teams.map(team => teamToRow(t.id, team));
      await db('tournament_teams').insert(teamRows);
      console.log('  teams:', teamRows.length);
    }
  }

  console.log('Done. Tournaments in DB:', (await db('tournaments').count('id as c').first()).c);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
