// src/backend/services/StatsService.js
const fs = require('fs');
require('ts-node/register');
const TournamentService = require('./TournamentService');
const PlayerService = require('./PlayerService');
const PlayerStatsCacheService = require('./PlayerStatsCacheService');
const MetricRecordsService = require('./MetricRecordsService');
const { buildPlayerStats } = require('../../stats');
const { playersDir, snapshotsDir } = require('../config/dataPaths');

class StatsService {
  constructor() {
    this.playersDir = playersDir;
    this.snapshotsDir = snapshotsDir;
  }

  /**
   * Создать срез статистики по году (для обнуления в новом году)
   */
  async createYearSnapshot(year) {
    const files = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.json'));
    const yearEndDate = `${year}-12-31`;

    for (const file of files) {
      const playerName = file.slice(0, -5);
      const profile = await PlayerService.getPlayerProfile(playerName);
      if (!profile) continue;

      const history = profile.history || [];

      // Разделяем историю на записи до конца года и после
      const yearHistory = history.filter(h => {
        if (!h.date) return false;
        return h.date <= yearEndDate;
      });

      const futureHistory = history.filter(h => {
        if (!h.date) return true; // Записи без даты оставляем в будущем
        return h.date > yearEndDate;
      });

      // Вычисляем статистику за год перед сохранением среза
      const yearStats = await this.getPlayerStatsByYear(profile, year);

      // Сохраняем срез года
      const yearSnapshot = {
        year: year,
        history: yearHistory,
        stats: yearStats, // Сохраняем вычисленную статистику
        effectiveRating: profile.effectiveRating || 0,
        rating: profile.rating || 0,
        ratingHistory: profile.ratingHistory || [],
        calibrating: profile.calibrating || false,
        longAnchor: profile.longAnchor || 0
      };

      // Обновляем профиль: сохраняем срез и обнуляем текущие данные
      const updatedProfile = {
        ...profile,
        yearSnapshots: {
          ...(profile.yearSnapshots || {}),
          [year]: yearSnapshot
        },
        history: futureHistory, // Оставляем только будущие записи
        effectiveRating: 0,
        rating: 0,
        ratingHistory: [],
        calibrating: true,
        longAnchor: 0
      };

      await PlayerService.updatePlayerProfile(playerName, updatedProfile);
      console.log(`✅ Создан срез ${year} для ${playerName}`);
    }

    return { success: true, message: `Year snapshot created for ${year}` };
  }

  /**
   * Получить статистику игрока за конкретный год
   */
  async getPlayerStatsByYear(profile, year) {
    let history = [];

    if (year === new Date().getFullYear().toString()) {
      history = profile.history || [];
    } else if (profile.yearSnapshots && profile.yearSnapshots[year]) {
      history = profile.yearSnapshots[year].history || [];
    } else {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      history = (profile.history || []).filter(h => {
        if (!h.date) return false;
        return h.date >= yearStart && h.date <= yearEnd;
      });
    }

    const tournaments = await TournamentService.getAllTournaments();
    const tablesById = {};
    for (const t of tournaments || []) {
      const id = t?.id || t?._id;
      if (!id) continue;
      try {
        tablesById[id] = await TournamentService.getTournamentTable(id);
      } catch (e) {
        tablesById[id] = null;
      }
    }

    const pubgNick = profile.pubgNick || profile.username || profile.name;
    return buildPlayerStats(pubgNick, {
      profile: { ...profile, history },
      tournaments,
      tablesById
    }, {
      scope: 'year',
      year
    });
  }

  /**
   * Улучшенный расчет статистики из истории
   * @deprecated Этот метод не используется. Используйте buildPlayerStats из src/stats вместо этого.
   * Оставлен для обратной совместимости, но возвращает 0 вместо "—" при отсутствии данных.
   */
  calculateStatsFromHistory(history) {
    const completed = history.filter(h => typeof h.place === 'number' && h.place > 0);

    if (completed.length === 0) {
      return {
        avgPlace: 0,
        avgKills: 0,
        avgDeaths: 0,
        winRate: 0,
        top3Rate: 0,
        top10Rate: 0,
        totalTournaments: history.length,
        completedTournaments: 0,
        totalKills: 0,
        totalDeaths: 0,
        bestPlace: null,
        worstPlace: null,
        consistency: 0 // Коэффициент стабильности (обратная дисперсия мест)
      };
    }

    // Базовые метрики
    const places = completed.map(h => h.place);
    const avgPlace = places.reduce((sum, p) => sum + p, 0) / places.length;

    const kills = completed.map(h => {
      const k = Number(h.personalKills);
      return isNaN(k) ? 0 : k;
    });
    const totalKills = kills.reduce((sum, k) => sum + k, 0);
    const avgKills = totalKills / completed.length;

    const deaths = completed
      .map(h => {
        const d = typeof h.personalDeaths === 'number' ? h.personalDeaths : null;
        return d;
      })
      .filter(d => d != null);
    const totalDeaths = deaths.reduce((sum, d) => sum + d, 0);
    const avgDeaths = deaths.length > 0 ? totalDeaths / deaths.length : 0;

    // Процентные метрики
    const wins = completed.filter(h => h.place === 1).length;
    const top3 = completed.filter(h => h.place <= 3).length;
    const top10 = completed.filter(h => h.place <= 10).length;

    const winRate = (wins / completed.length) * 100;
    const top3Rate = (top3 / completed.length) * 100;
    const top10Rate = (top10 / completed.length) * 100;

    // Лучшее и худшее место
    const bestPlace = Math.min(...places);
    const worstPlace = Math.max(...places);

    // Коэффициент стабильности (consistency)
    // Чем меньше дисперсия, тем выше стабильность
    const variance = places.reduce((sum, p) => {
      return sum + Math.pow(p - avgPlace, 2);
    }, 0) / places.length;
    const stdDev = Math.sqrt(variance);
    // Нормализуем: 100 - (stdDev / maxPlace * 100), где maxPlace обычно 20-30
    const maxExpectedPlace = 30;
    const consistency = Math.max(0, Math.min(100, 100 - (stdDev / maxExpectedPlace * 100)));

    return {
      avgPlace: Number(avgPlace.toFixed(2)),
      avgKills: Number(avgKills.toFixed(2)),
      avgDeaths: Number(avgDeaths.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      top3Rate: Number(top3Rate.toFixed(1)),
      top10Rate: Number(top10Rate.toFixed(1)),
      totalTournaments: history.length,
      completedTournaments: completed.length,
      totalKills: totalKills,
      totalDeaths: totalDeaths,
      bestPlace: bestPlace,
      worstPlace: worstPlace,
      consistency: Number(consistency.toFixed(1))
    };
  }

  /**
   * Автоматически обновить историю игроков после завершения турнира
   */
  async updatePlayerHistoriesAfterTournament(tournamentId) {
    const tournament = await TournamentService.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }

    const table = await TournamentService.getTournamentTable(tournamentId);

    // Проверяем, завершен ли турнир
    const roundsCount = table.tournament?.rounds || 0;
    const isCompleted = table.teams.every(team =>
      team.results.length === roundsCount &&
      team.results.every(r => r.placement != null)
    );

    if (!isCompleted) {
      return; // Турнир еще не завершен
    }

    // Обновляем историю для каждого игрока
    for (const team of table.teams) {
      const players = tournament.type === 'solo'
        ? [team.name]
        : (team.players || []);

      for (let idx = 0; idx < players.length; idx++) {
        const playerName = players[idx];
        let profile = await PlayerService.getPlayerProfile(playerName);
        if (!profile) {
          const byPubg = await PlayerService.findPlayerByPubgNick(playerName);
          profile = byPubg?.profile || null;
        }

        if (!profile) {
          // Создаем профиль, если его нет
          const username = PlayerService.normalizeUsername(playerName);
          profile = await PlayerService.createPlayerProfile({
            username,
            password: null,
            email: null,
            pubgNick: playerName
          });
        }
        const profileUsername = profile.username || profile.name || PlayerService.normalizeUsername(playerName);

        // Проверяем, есть ли уже запись об этом турнире
        const existingEntry = profile.history?.find(
          h => h.tournamentId === tournamentId
        );

        if (existingEntry) {
          // Обновляем существующую запись
          existingEntry.place = team.rank;
          existingEntry.points = team.totalPoints;

          // Считаем личные киллы
          if (tournament.type === 'solo') {
            existingEntry.personalKills = team.results.reduce(
              (sum, r) => sum + (r.kills || 0), 0
            );
          } else if (team.playerKills && team.playerKills[idx]) {
            existingEntry.personalKills = team.playerKills[idx].kills.reduce(
              (a, b) => a + (b || 0), 0
            );
          }

          // Считаем личные смерти
          if (team.playerDeaths && team.playerDeaths[idx]) {
            existingEntry.personalDeaths = team.playerDeaths[idx].deaths.reduce(
              (a, b) => a + (b || 0), 0
            );
          }
        } else {
          // Создаем новую запись
          let personalKills = 'Не учитывались';
          if (tournament.type === 'solo') {
            personalKills = team.results.reduce(
              (sum, r) => sum + (r.kills || 0), 0
            );
          } else if (team.playerKills && team.playerKills[idx]) {
            personalKills = team.playerKills[idx].kills.reduce(
              (a, b) => a + (b || 0), 0
            );
          }

          let personalDeaths = null;
          if (team.playerDeaths && team.playerDeaths[idx]) {
            personalDeaths = team.playerDeaths[idx].deaths.reduce(
              (a, b) => a + (b || 0), 0
            );
          }

          const entry = {
            tournamentId: tournamentId,
            tournamentName: tournament.name,
            date: tournament.date,
            place: team.rank,
            points: team.totalPoints,
            personalKills: personalKills,
            personalDeaths: personalDeaths
          };

          await PlayerService.addHistoryEntry(profileUsername, entry);
        }
      }
    }

    // Пересчитываем статистику для всех затронутых игроков
    const tournamentDate = tournament.date;
    const affectedPlayers = new Set();
    
    // Собираем всех затронутых игроков
    for (const team of table.teams) {
      const players = tournament.type === 'solo'
        ? [team.name]
        : (team.players || []);
      
      for (const playerName of players) {
        try {
          let profile = await PlayerService.getPlayerProfile(playerName);
          if (!profile) {
            const byPubg = await PlayerService.findPlayerByPubgNick(playerName);
            profile = byPubg?.profile || null;
          }
          
          if (profile) {
            const playerId = profile.pubgNick || profile.username || playerName;
            affectedPlayers.add(playerId);
          }
        } catch (error) {
          console.error(`Ошибка получения профиля для ${playerName}:`, error);
        }
      }
    }

    // Добавляем задачи пересчета статистики в очередь (не блокируем выполнение)
    const StatsRecalculationQueue = require('./StatsRecalculationQueue');
    const tasks = Array.from(affectedPlayers).map(playerId => ({
      playerId,
      tournamentDate
    }));
    
    if (tasks.length > 0) {
      StatsRecalculationQueue.enqueueBatch(tasks, 'normal')
        .then(() => {
          console.log(`✅ Добавлено ${tasks.length} задач пересчета статистики в очередь`);
        })
        .catch(error => {
          console.error(`❌ Ошибка добавления задач в очередь:`, error);
        });
    }
  }

  /**
   * Пересчёт рейтингов для всех игроков (legacy endpoint).
   * Глобальный рейтинг теперь — Ladder (percentile-based, обновляется в LadderService после закрытия турнира)
   * и DNA (обновляется в DnaOnCloseService). Фиксированные очки за места (ratingRules) больше не используются.
   * Метод оставлен для совместимости API; не записывает rating в профиль.
   */
  async recalculateAllRatings() {
    // Ladder обновляется в LadderService.updateAfterTournament при закрытии турнира.
    // DNA обновляется в DnaOnCloseService. Старая логика "сумма очков за места" отключена.
  }

  /**
   * Автоматически обновить статистику игрока
   */
  async updatePlayerStats(playerName) {
    const profile = await PlayerService.getPlayerProfile(playerName);
    if (!profile) return;

    const history = profile.history || [];
    const completed = history.filter(h => typeof h.place === 'number');

    if (completed.length === 0) {
      await PlayerService.updatePlayerProfile(playerName, {
        rating: 0
      });
      return;
    }

    const avgPlace = completed.reduce((sum, h) => sum + h.place, 0) / completed.length;
    const kills = completed.map(h => Number(h.personalKills) || 0);
    const avgKills = kills.reduce((sum, k) => sum + k, 0) / completed.length;
    const wins = completed.filter(h => h.place === 1).length;
    const top3 = completed.filter(h => h.place <= 3).length;

    // Обновляем профиль (статистика уже считается в getPlayerStats, но можно кешировать)
    // Здесь просто обновляем базовые поля если нужно
  }
}

module.exports = new StatsService();
