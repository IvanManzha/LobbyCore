#!/usr/bin/env node
/**
 * Пересчёт истории, кеша статов и DNA для игрока в основной БД (SQLITE_PATH / pubg_app.db).
 *
 * Usage: node scripts/recalculate_player_main_db.js [playerId]
 * Example: node scripts/recalculate_player_main_db.js IVANCHK
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db } = require('../lib/db');
const { filterTournaments, isTestTournament } = require('../src/shared/testDataFilters');
const { tournamentCountsInRating } = require('../src/shared/tournamentRatingPolicy');
const DnaRecomputeService = require('../src/backend/services/dna/DnaRecomputeService');
const TournamentService = require('../src/backend/services/TournamentService');
const StatsService = require('../src/backend/services/StatsService');
const PlayerStatsCacheService = require('../src/backend/services/PlayerStatsCacheService');
const PlayerService = require('../src/backend/services/PlayerService');
const DnaOnCloseService = require('../src/backend/services/dna/DnaOnCloseService');
const { runPipeline } = require('../src/backend/services/dna/pipeline');
const DnaService = require('../src/backend/services/dna/DnaService');
const { persistDnaRating } = require('../src/backend/services/dna/dnaRatingPersistence');

const PLAYER_ID = (process.argv[2] || 'IVANCHK').trim();
const EXTRA_YEARS = ['2025', '2026'];

function playerInTable(table, tournament, playerName) {
  const needle = playerName.trim().toLowerCase();
  for (const team of table?.teams || []) {
    if (tournament?.type === 'solo') {
      if ((team.name || '').trim().toLowerCase() === needle) return true;
    } else {
      for (const p of team.players || []) {
        if (String(p).trim().toLowerCase() === needle) return true;
      }
    }
  }
  return false;
}

async function findIvanchkTournaments() {
  const all = filterTournaments(await TournamentService.getAllTournaments());
  const done = all.filter(
    (t) => t.state === 'Турнир окончен' || t.state === 'DONE'
  );
  const withPlayer = [];
  for (const t of done) {
    if (isTestTournament(t)) continue;
    if (!tournamentCountsInRating(t)) continue;
    try {
      const table = await TournamentService.getTournamentTable(t.id);
      if (playerInTable(table, t, PLAYER_ID)) {
        withPlayer.push(t);
      }
    } catch (_e) {
      /* skip */
    }
  }
  return withPlayer.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
}

async function getPlayerMatchRows(seasonId) {
  const matchIds = await DnaRecomputeService.getPlayerDnaMatchIds(PLAYER_ID, seasonId);
  if (!matchIds.length) return [];

  const rows = await db('matches')
    .whereIn('match_id', matchIds)
    .select(
      'id as matchRef',
      'match_id as matchId',
      'tournament_id as tournamentId',
      'telemetry',
      'played_at as playedAt',
      'map_name as mapName'
    )
    .orderBy('played_at', 'asc');

  return rows;
}

function groupMatchIdsBySeason(rows) {
  const bySeason = new Map();
  for (const row of rows) {
    const season =
      (row.playedAt && String(row.playedAt).substring(0, 4)) || DnaService.DEFAULT_SEASON;
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season).push(row);
  }
  return bySeason;
}

async function main() {
  console.log(`\n=== Пересчёт ${PLAYER_ID} (основная БД) ===\n`);
  console.log('SQLITE_PATH:', process.env.SQLITE_PATH || '(default pubg_app.db)');
  console.log('(только актуальная БД, турниры с countInRating и без test)');

  const profile = await PlayerService.getPlayerProfile(PLAYER_ID);
  if (!profile) {
    const byNick = await PlayerService.findPlayerByPubgNick(PLAYER_ID);
    if (!byNick?.profile) {
      console.error('Профиль не найден:', PLAYER_ID);
      process.exit(1);
    }
  }

  const tournaments = await findIvanchkTournaments();
  console.log(`\n1) История турниров: ${tournaments.length} завершённых турниров с участием ${PLAYER_ID}`);
  for (const t of tournaments) {
    await StatsService.updatePlayerHistoriesAfterTournament(t.id);
    console.log(`   ✓ ${t.id} — ${t.name}`);
  }

  console.log('\n2) Кеш статистики (player_stats_cache)');
  await PlayerStatsCacheService.invalidateStats(PLAYER_ID);
  const profileForStats = await PlayerService.getPlayerProfile(PLAYER_ID);
  await PlayerStatsCacheService.calculateAndSaveStats(PLAYER_ID, 'all_time', null, profileForStats);
  const years = new Set([...EXTRA_YEARS, new Date().getFullYear().toString()]);
  for (const year of [...years].sort()) {
    try {
      await PlayerStatsCacheService.calculateAndSaveStats(PLAYER_ID, 'year', year, profileForStats);
      console.log(`   ✓ year ${year}`);
    } catch (e) {
      console.warn(`   ⚠ year ${year}:`, e.message);
    }
  }
  await PlayerStatsCacheService.recalculateAllPeriods(PLAYER_ID);
  console.log('   ✓ all_time + текущий год/квартал');

  const seasons = [...EXTRA_YEARS, new Date().getFullYear().toString()];
  const matchRows = [];
  for (const seasonId of seasons) {
    const rows = await getPlayerMatchRows(seasonId);
    for (const r of rows) {
      if (!matchRows.some((x) => x.matchId === r.matchId)) matchRows.push(r);
    }
  }
  matchRows.sort((a, b) => new Date(a.playedAt || 0) - new Date(b.playedAt || 0));
  console.log(`\n3) DNA: ${matchRows.length} матчей (app DB, countInRating, без test)`);

  if (matchRows.length === 0) {
    console.log('   Нет матчей — DNA пропущен.');
    return;
  }

  let telemetryFiles = 0;
  for (const row of matchRows) {
    if (row.telemetry) {
      const ok = await DnaOnCloseService.ensureTelemetryFile(row.matchId, row.telemetry);
      if (ok) telemetryFiles += 1;
    }
  }
  console.log(`   Телеметрия в файлы: ${telemetryFiles}/${matchRows.length}`);

  const bySeason = groupMatchIdsBySeason(matchRows);
  for (const [seasonId, rows] of bySeason) {
    const matchIds = rows.map((r) => r.matchId);
    console.log(`\n   Сезон ${seasonId}: pipeline для ${matchIds.length} матч(ей)…`);
    const result = await runPipeline(matchIds, [PLAYER_ID], seasonId);
    console.log(
      `   ingest=${result.ingested}, failed=${result.failed?.length || 0}, extract=${result.extracted}, recompute=${result.recomputed}`
    );

    for (const row of rows) {
      await persistDnaRating(PLAYER_ID, seasonId, {
        date: row.playedAt,
        tournamentId: row.tournamentId,
        matchId: row.matchId,
        matchRef: row.matchRef,
      });
    }
  }

  try {
    const ChampionshipsService = require('../src/backend/services/ChampionshipsService');
    for (const t of tournaments) {
      ChampionshipsService.updateChampionshipsForTournament(t.id);
    }
    console.log('\n4) Чемпионства пересчитаны для затронутых турниров');
  } catch (e) {
    console.warn('\n4) Чемпионства:', e.message);
  }

  console.log(`\n✅ Готово: ${PLAYER_ID}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
