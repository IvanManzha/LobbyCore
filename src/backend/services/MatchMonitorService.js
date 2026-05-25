// src/backend/services/MatchMonitorService.js
require('dotenv').config();
const { getPlayer, getPlayerMatchList, getMatch, getTelemetry } = require('../../../services/pubgApi');
const { insertMatch, insertParticipants, db } = require('../../../lib/db');
const TournamentService = require('./TournamentService');
const DnaRecomputeService = require('./dna/DnaRecomputeService');

/** Единственный «живой» статус турнира для опроса матчей */
const LIVE_TOURNAMENT_STATE = 'В процессе';

/** Не переводить в «В процессе» повторно / из финальных статусов */
const SKIP_PROMOTE_STATES = new Set([
  LIVE_TOURNAMENT_STATE,
  'Турнир окончен',
  'DONE',
  'Турнир отменен',
]);

class MatchMonitorService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.checkIntervalMs = 2 * 60 * 1000; // Проверка каждые 2 минуты
    this.processedMatches = new Set(); // Кеш обработанных матчей
    this.autoClosingIds = new Set(); // защита от повторного автозакрытия
    this.shard = 'steam';
  }

  /**
   * Турниры в статусе «В процессе».
   */
  async countLiveTournaments() {
    const tournaments = await TournamentService.getAllTournaments();
    return tournaments.filter((t) => t.state === LIVE_TOURNAMENT_STATE).length;
  }

  /**
   * Перевести турниры с наступившим startAt/date в «В процессе» (без PUBG-опроса).
   */
  async promoteDueTournaments() {
    const tournaments = await TournamentService.getAllTournaments();
    const now = new Date();

    for (const t of tournaments) {
      if (SKIP_PROMOTE_STATES.has(t.state)) {
        continue;
      }
      const startWhen = t.startAt || t.date;
      if (!startWhen) continue;
      const start = new Date(startWhen);
      if (isNaN(start.getTime()) || now < start) continue;
      try {
        await TournamentService.startTournament(t.id);
        console.log(
          `▶️ Турнир ${t.id} автоматически переведён в «${LIVE_TOURNAMENT_STATE}» (${t.startAt ? 'startAt' : 'date'}: ${startWhen})`
        );
      } catch (err) {
        if (!/already in progress/i.test(err.message)) {
          console.warn(`⚠️ Не удалось авто-старт турнира ${t.id}:`, err.message);
        }
      }
    }
  }

  /**
   * Включить MatchMonitor, если есть хотя бы один турнир «В процессе»; иначе выключить.
   * Вызывается при старте/закрытии турнира и при старте сервера.
   */
  async syncWithActiveTournaments() {
    await this.promoteDueTournaments();
    const liveCount = await this.countLiveTournaments();

    if (liveCount > 0) {
      if (!this.isRunning) {
        this.start();
      }
    } else if (this.isRunning) {
      this.stop();
    }

    return { liveCount, isRunning: this.isRunning };
  }

  /**
   * Запустить мониторинг активных турниров
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  MatchMonitor уже запущен');
      return;
    }

    this.isRunning = true;
    console.log('🔍 MatchMonitor запущен. Проверка каждые 2 минуты...');
    
    // Первая проверка сразу
    this.checkActiveTournaments();

    // Затем периодически
    this.checkInterval = setInterval(() => {
      this.checkActiveTournaments();
    }, this.checkIntervalMs);
  }

  /**
   * Остановить мониторинг
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 MatchMonitor остановлен');
  }

  /**
   * Проверить все активные турниры (только при запущенном мониторе).
   */
  async checkActiveTournaments() {
    try {
      await this.promoteDueTournaments();

      const freshList = await TournamentService.getAllTournaments();
      const activeAfter = freshList.filter((t) => t.state === LIVE_TOURNAMENT_STATE);

      if (activeAfter.length === 0) {
        await this.syncWithActiveTournaments();
        return;
      }

      console.log(`📊 Проверка ${activeAfter.length} активных турниров...`);

      for (const tournament of activeAfter) {
        await this.checkTournamentMatches(tournament);
      }

      const stillActive = (await TournamentService.getAllTournaments()).filter(
        (t) => t.state === LIVE_TOURNAMENT_STATE
      );
      for (const tournament of stillActive) {
        await this.checkAutoCloseTournament(tournament.id);
      }

      await this.syncWithActiveTournaments();
    } catch (error) {
      console.error('❌ Ошибка при проверке турниров:', error.message);
      await this.syncWithActiveTournaments().catch(() => {});
    }
  }

  /**
   * Проверить матчи конкретного турнира
   */
  async checkTournamentMatches(tournament) {
    try {
      const table = await TournamentService.getTournamentTable(tournament.id);
      const allPlayers = this.getAllTournamentPlayers(table);

      if (allPlayers.length === 0) {
        return;
      }

      console.log(`  🔍 Турнир "${tournament.name}": проверка ${allPlayers.length} игроков...`);

      // Получаем последние матчи для каждого игрока
      const recentMatches = await this.getRecentMatchesForPlayers(allPlayers);

      // Группируем матчи по времени и составу участников
      const tournamentMatches = await this.identifyTournamentMatches(
        recentMatches,
        allPlayers,
        tournament
      );

      // Сохраняем новые матчи
      for (const matchInfo of tournamentMatches) {
        await this.saveTournamentMatch(tournament.id, matchInfo);
      }

      // Обновляем table.json если были новые матчи
      if (tournamentMatches.length > 0) {
        await this.updateTournamentTable(tournament.id);
      }
    } catch (error) {
      console.error(`  ❌ Ошибка при проверке турнира ${tournament.id}:`, error.message);
    }
  }

  /**
   * Получить всех игроков турнира из table.json
   */
  getAllTournamentPlayers(table) {
    const players = new Set();
    
    if (!table.teams) return [];

    for (const team of table.teams) {
      if (team.players && Array.isArray(team.players)) {
        team.players.forEach(p => players.add(p));
      } else if (team.name) {
        // Solo турнир
        players.add(team.name);
      }
    }

    return Array.from(players);
  }

  /**
   * Получить последние матчи для списка игроков
   */
  async getRecentMatchesForPlayers(playerNames) {
    const matchesMap = new Map(); // matchId -> { matchId, players, timestamp }

    for (const playerName of playerNames) {
      try {
        const matchIds = await getPlayerMatchList(this.shard, playerName);
        
        // Берем последние 5 матчей каждого игрока
        for (const matchId of matchIds.slice(0, 5)) {
          if (!matchesMap.has(matchId)) {
            matchesMap.set(matchId, {
              matchId,
              players: new Set(),
              timestamp: null
            });
          }
          matchesMap.get(matchId).players.add(playerName);
        }
      } catch (error) {
        console.error(`    ⚠️  Не удалось получить матчи для ${playerName}:`, error.message);
      }
    }

    return Array.from(matchesMap.values());
  }

  /**
   * Определить, какие матчи относятся к турниру
   */
  async identifyTournamentMatches(recentMatches, tournamentPlayers, tournament) {
    const tournamentMatches = [];
    const tournamentDate = new Date(tournament.date);
    const startRaw = tournament.startAt || tournament.startedAt || tournament.date;
    const tournamentStartTime = startRaw ? new Date(startRaw) : tournamentDate;
    
    // Проверяем только матчи, сыгранные после начала турнира
    const now = new Date();

    for (const matchInfo of recentMatches) {
      // Пропускаем уже обработанные
      if (this.processedMatches.has(matchInfo.matchId)) {
        continue;
      }

      // Проверяем, сколько участников турнира играло в этом матче
      const tournamentPlayersInMatch = Array.from(matchInfo.players).filter(p =>
        tournamentPlayers.includes(p)
      );

      // Если >= 50% участников турнира играли в матче - проверяем время
      const participationRate = tournamentPlayersInMatch.length / tournamentPlayers.length;
      
      if (participationRate >= 0.5) {
        // Получаем время матча для проверки
        try {
          const matchData = await getMatch(this.shard, matchInfo.matchId);
          const matchTime = new Date(matchData.data.attributes.createdAt);
          
          // Пропускаем матчи, сыгранные до начала турнира
          if (matchTime < tournamentStartTime) {
            continue;
          }
          
          tournamentMatches.push({
            matchId: matchInfo.matchId,
            players: tournamentPlayersInMatch,
            participationRate,
            matchTime: matchTime.toISOString(),
            matchData: matchData // Сохраняем данные, чтобы не запрашивать повторно
          });
        } catch (error) {
          console.warn(`    ⚠️  Не удалось проверить матч ${matchInfo.matchId}:`, error.message);
          continue;
        }
      }
    }

    return tournamentMatches;
  }

  /**
   * Сохранить матч турнира в БД
   */
  async saveTournamentMatch(tournamentId, matchInfo) {
    const { matchId, matchData } = matchInfo;

    // Проверяем, не сохранен ли уже этот матч
    const existing = await db('matches')
      .where({ tournament_id: tournamentId, match_id: matchId })
      .first('id');

    if (existing) {
      this.processedMatches.add(matchId);
      return; // Уже сохранен
    }

    try {
      // Используем уже полученные данные матча или получаем заново
      let matchDataToUse = matchData;
      if (!matchDataToUse) {
        matchDataToUse = await getMatch(this.shard, matchId);
      }
      
      const matchObj = matchDataToUse.data;
      const includedArr = matchDataToUse.included;

      // Телеметрия
      let telemetry = null;
      try {
        const asset = includedArr.find(i => i.type === 'asset');
        if (asset?.attributes?.URL) {
          telemetry = await getTelemetry(asset.attributes.URL);
        }
      } catch (err) {
        console.warn(`    ⚠️  Не удалось загрузить телеметрию для ${matchId}`);
      }

      // Сохраняем матч
      const matchRef = await insertMatch({
        tournament_id: tournamentId,
        match_id: matchId,
        shard: this.shard,
        map_name: matchObj.attributes.mapName,
        played_at: matchObj.attributes.createdAt,
        telemetry: telemetry ? JSON.stringify(telemetry) : null,
        processed: true
      });

      // Сохраняем участников
      const participants = includedArr
        .filter(i => i.type === 'participant')
        .map(p => {
          const s = p.attributes.stats;
          return {
            match_ref: matchRef,
            player_id: s.playerId,
            api_name: s.name,
            player_name: s.name,
            team_id: s.teamId,
            kills: s.kills,
            damage: s.damageDealt,
            placement: s.winPlace,
            stats: JSON.stringify({
              assists: s.assists,
              timeSurvived: s.timeSurvived,
              headshotKills: s.headshotKills
            })
          };
        });

      if (participants.length > 0) {
        await insertParticipants(participants, tournamentId);
      }

      this.processedMatches.add(matchId);
      console.log(`    ✅ Сохранен матч ${matchId} для турнира ${tournamentId}`);

      // DNA Lab: пересчёт профиля игроков матча (только актуальная БД + countInRating)
      setImmediate(() => {
        this.triggerDnaAfterMatchSaved(tournamentId, matchId, telemetry).catch((e) =>
          console.warn(`    ⚠️  DNA recompute after match:`, e.message)
        );
      });
    } catch (error) {
      console.error(`    ❌ Ошибка при сохранении матча ${matchId}:`, error.message);
    }
  }

  /**
   * Пересчёт DNA Lab для всех игроков завершённого матча (актуальная БД, countInRating).
   */
  async triggerDnaAfterMatchSaved(tournamentId, matchId, telemetry) {
    const result = await DnaRecomputeService.recomputePlayersAfterMatch(tournamentId, matchId, telemetry);
    if (result.skipped) {
      console.log(`    🧬 DNA пропущен (${matchId}): ${result.reason}`);
      return;
    }
    if (result.ok) {
      console.log(
        `    🧬 DNA пересчитан после матча ${matchId}: игроков ${result.recomputed}/${result.players}`
      );
    } else if (result.errors?.length) {
      console.warn(`    🧬 DNA частично (${matchId}):`, result.errors);
    }
  }

  /**
   * Обновить table.json на основе сохраненных матчей
   */
  async updateTournamentTable(tournamentId) {
    try {
      const table = await TournamentService.getTournamentTable(tournamentId);
      
      // Получаем все матчи турнира
      const matches = await db('matches')
        .where({ tournament_id: tournamentId })
        .orderBy('played_at', 'asc')
        .select('id as matchRef', 'match_id');

      if (matches.length === 0) {
        return;
      }

      // Обновляем результаты для каждого раунда
      for (let roundIndex = 0; roundIndex < matches.length; roundIndex++) {
        const { matchRef } = matches[roundIndex];

        const rows = await db('participants')
          .where({ match_ref: matchRef })
          .select('player_name', 'kills', 'placement');

        for (const team of table.teams) {
          const members = team.players || (team.name ? [team.name] : []);
          const teamRows = rows.filter(r => members.includes(r.player_name));

          if (teamRows.length === 0) continue;

          const teamKills = teamRows.reduce((sum, r) => sum + (r.kills || 0), 0);
          const teamPlace = teamRows[0].placement;

          if (!team.results) team.results = [];
          if (!team.results[roundIndex]) {
            team.results[roundIndex] = { kills: null, placement: null };
          }
          
          team.results[roundIndex].kills = teamKills;
          team.results[roundIndex].placement = teamPlace;

          // Обновляем киллы игроков
          if (!team.playerKills) team.playerKills = [];
          for (let i = 0; i < members.length; i++) {
            if (!team.playerKills[i]) {
              team.playerKills[i] = { kills: [] };
            }
            const rec = teamRows.find(r => r.player_name === members[i]);
            if (!team.playerKills[i].kills) {
              team.playerKills[i].kills = [];
            }
            team.playerKills[i].kills[roundIndex] = rec ? rec.kills : 0;
          }
        }
      }

      // Сохраняем обновленную таблицу
      await TournamentService.updateTournamentTable(tournamentId, table);

      // Пересчитываем лидерборд
      await TournamentService.recalculateLeaderboard(tournamentId);

      // Обновляем количество сыгранных раундов
      const playedRounds = matches.length;
      await this.updateTournamentPlayedRounds(tournamentId, playedRounds);

      console.log(`    📊 Обновлена таблица турнира ${tournamentId} (${playedRounds} раундов)`);
    } catch (error) {
      console.error(`    ❌ Ошибка при обновлении таблицы:`, error.message);
    }
  }

  /**
   * Обновить количество сыгранных раундов турнира
   */
  async updateTournamentPlayedRounds(tournamentId, playedRounds) {
    try {
      const tournament = await TournamentService.getTournamentById(tournamentId);
      if (!tournament) return;
      await TournamentService.updatePlayedRounds(tournamentId, playedRounds);
    } catch (error) {
      console.error(`    ❌ Ошибка при обновлении playedRounds:`, error.message);
    }
  }

  /**
   * Таблица заполнена по всем заявленным раундам (места выставлены).
   */
  isTableCompleteForRounds(table, rounds) {
    if (!table?.teams?.length || rounds <= 0) return false;
    return table.teams.every((team) => {
      const results = team.results || [];
      if (results.length < rounds) return false;
      return results.slice(0, rounds).every((r) => r && r.placement != null);
    });
  }

  /**
   * Проверить и автоматически закрыть турнир: число матчей в БД = заявленным раундам,
   * таблица полная → лидерборд → DNA (полный пайплайн) → закрытие с ожиданием Ladder/history.
   */
  async checkAutoCloseTournament(tournamentId) {
    if (process.env.AUTO_CLOSE_TOURNAMENT === 'false') {
      return;
    }
    if (this.autoClosingIds.has(tournamentId)) {
      return;
    }

    try {
      const tournament = await TournamentService.getTournamentById(tournamentId);

      if (!tournament || tournament.state !== LIVE_TOURNAMENT_STATE) {
        return;
      }

      const rounds = tournament.rounds || 0;
      if (rounds <= 0) {
        return;
      }

      const cntRow = await db('matches').where({ tournament_id: tournamentId }).count('* as c').first();
      const matchCount = Number(cntRow?.c || cntRow?.count || 0);

      if (matchCount < rounds) {
        return;
      }

      const table = await TournamentService.getTournamentTable(tournamentId);
      if (!this.isTableCompleteForRounds(table, rounds)) {
        return;
      }

      this.autoClosingIds.add(tournamentId);
      console.log(
        `    🏁 Автозакрытие турнира ${tournamentId}: матчей ${matchCount}, раундов ${rounds} — пересчёт DNA и закрытие…`
      );

      await TournamentService.recalculateLeaderboard(tournamentId);

      const DnaOnCloseService = require('./dna/DnaOnCloseService');
      let skipDnaPipeline = false;
      if (process.env.RUN_DNA_ON_CLOSE !== 'false') {
        const dnaResult = await DnaOnCloseService.run(tournamentId, { skipCleanup: true });
        if (dnaResult && dnaResult.ok && !dnaResult.skipped) {
          console.log(`    🧬 DNA готов перед закрытием ${tournamentId}:`, dnaResult.stats);
          skipDnaPipeline = true;
        } else if (dnaResult && dnaResult.skipped) {
          console.warn(
            `    🧬 DNA перед автозакрытием пропущен (${tournamentId}):`,
            dnaResult.reason || 'skipped'
          );
        } else if (dnaResult && dnaResult.error) {
          console.error(`    ❌ DNA перед автозакрытием ${tournamentId}:`, dnaResult.error);
        }
      }

      await TournamentService.closeTournament(tournamentId, {
        skipDnaPipeline,
        awaitPostClose: true,
      });
      console.log(`    ✅ Турнир ${tournamentId} закрыт автоматически`);
    } catch (error) {
      console.error(`    ❌ Ошибка при автозакрытии ${tournamentId}:`, error.message);
    } finally {
      this.autoClosingIds.delete(tournamentId);
    }
  }
}

module.exports = new MatchMonitorService();
