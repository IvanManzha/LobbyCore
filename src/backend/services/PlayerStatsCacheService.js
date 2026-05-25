// src/backend/services/PlayerStatsCacheService.js
const { db } = require('../../../lib/db');
const TournamentService = require('./TournamentService');
const { buildPlayerStats } = require('../../stats');
const { getYearFromDate, getQuarterFromDate, getPeriodsForDate } = require('../utils/periodUtils');

class PlayerStatsCacheService {
  /**
   * Получить сохраненную статистику из кеша
   * @param {string} playerId - Идентификатор игрока (username/pubgNick)
   * @param {string} scope - Тип среза: 'all_time', 'year', 'quarter'
   * @param {string|null} period - Период: null для all_time, '2025' для года, '2025-Q1' для квартала
   * @returns {Object|null} Статистика или null если не найдена
   */
  async getCachedStats(playerId, scope, period = null) {
    try {
      const query = db('player_stats_cache')
        .where({
          player_id: playerId,
          scope: scope
        });
      
      // Для SQLite нужно явно проверять NULL
      if (period === null) {
        query.whereNull('period');
      } else {
        query.where('period', period);
      }
      
      const result = await query.first();

      if (!result) {
        return null;
      }

      return JSON.parse(result.stats);
    } catch (error) {
      console.error(`Ошибка получения кеша статистики для ${playerId} (${scope}, ${period}):`, error);
      return null;
    }
  }

  /**
   * Сохранить статистику в кеш
   * @param {string} playerId - Идентификатор игрока
   * @param {string} scope - Тип среза
   * @param {string|null} period - Период
   * @param {Object} stats - Объект статистики (PlayerStatsResponse)
   */
  async saveStats(playerId, scope, period, stats) {
    try {
      const statsJson = JSON.stringify(stats);
      
      // Проверяем, существует ли запись
      const query = db('player_stats_cache')
        .where({
          player_id: playerId,
          scope: scope
        });
      
      // Для SQLite нужно явно проверять NULL
      if (period === null) {
        query.whereNull('period');
      } else {
        query.where('period', period);
      }
      
      const existing = await query.first();

      if (existing) {
        // Обновляем существующую запись
        const updateQuery = db('player_stats_cache')
          .where({
            player_id: playerId,
            scope: scope
          });
        
        if (period === null) {
          updateQuery.whereNull('period');
        } else {
          updateQuery.where('period', period);
        }
        
        await updateQuery.update({
          stats: statsJson,
          updated_at: db.fn.now()
        });
      } else {
        // Создаем новую запись
        await db('player_stats_cache')
          .insert({
            player_id: playerId,
            scope: scope,
            period: period,
            stats: statsJson,
            updated_at: db.fn.now()
          });
      }
    } catch (error) {
      console.error(`Ошибка сохранения статистики в кеш для ${playerId} (${scope}, ${period}):`, error);
      throw error;
    }
  }

  /**
   * Инвалидировать кеш статистики
   * @param {string} playerId - Идентификатор игрока
   * @param {string|null} scope - Тип среза (null для всех)
   * @param {string|null} period - Период (null для всех)
   */
  async invalidateStats(playerId, scope = null, period = null) {
    try {
      const query = db('player_stats_cache').where('player_id', playerId);
      
      if (scope) {
        query.where('scope', scope);
      }
      if (period !== null) {
        query.where('period', period);
      }
      
      await query.del();
    } catch (error) {
      console.error(`Ошибка инвалидации кеша для ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Вычислить и сохранить статистику
   * @param {string} playerId - Идентификатор игрока
   * @param {string} scope - Тип среза: 'all_time', 'year', 'quarter'
   * @param {string|null} period - Период: null для all_time, '2025' для года, '2025-Q1' для квартала
   * @param {Object|null} profile - Профиль игрока (опционально, если не передан - загрузится)
   * @returns {Object} Вычисленная статистика
   */
  async calculateAndSaveStats(playerId, scope, period = null, profile = null) {
    // Избегаем циклической зависимости - загружаем профиль только если не передан
    if (!profile) {
      // Используем динамический импорт для избежания циклической зависимости
      const PlayerService = require('./PlayerService');
      profile = await PlayerService.getPlayerProfile(playerId);
      if (!profile) {
        throw new Error(`Player profile not found: ${playerId}`);
      }
    }

    const tournaments = await TournamentService.getAllTournaments();
    
    // Определяем историю для фильтрации
    let historyForPeriod = profile.history || [];
    if (scope === 'year' && period) {
      if (profile.yearSnapshots?.[period]?.history?.length) {
        historyForPeriod = profile.yearSnapshots[period].history;
      } else {
        const yearStart = `${period}-01-01`;
        const yearEnd = `${period}-12-31`;
        historyForPeriod = (profile.history || []).filter(h => {
          if (!h.date) return false;
          return h.date >= yearStart && h.date <= yearEnd;
        });
      }
    } else if (scope === 'quarter' && period) {
      const [year, quarter] = period.split('-Q');
      const quarterStartMonth = (parseInt(quarter, 10) - 1) * 3 + 1;
      const quarterEndMonth = parseInt(quarter, 10) * 3;
      const quarterStart = `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`;
      const quarterEnd = `${year}-${String(quarterEndMonth).padStart(2, '0')}-31`;
      historyForPeriod = (profile.history || []).filter(h => {
        if (!h.date) return false;
        return h.date >= quarterStart && h.date <= quarterEnd;
      });
    }
    
    // Собираем ID турниров, которые нужны для этого игрока
    const neededTournamentIds = new Set();
    historyForPeriod.forEach(entry => {
      if (entry.tournamentId) {
        neededTournamentIds.add(entry.tournamentId);
      }
    });
    
    // Загружаем таблицы только для нужных турниров (оптимизация производительности)
    const tablesById = {};
    if (neededTournamentIds.size > 0) {
      await Promise.all(
        Array.from(neededTournamentIds).map(async (tournamentId) => {
          try {
            tablesById[tournamentId] = await TournamentService.getTournamentTable(tournamentId);
          } catch (err) {
            tablesById[tournamentId] = null;
          }
        })
      );
    }

    // historyForPeriod уже определен выше, используем его
    const profileForStats = {
      ...profile,
      history: historyForPeriod
    };

    const pubgNick = profile.pubgNick || profile.username || playerId;
    
    // Определяем опции для buildPlayerStats
    // Для quarter используем scope 'year' с годом из квартала
    const options = {
      scope: scope === 'all_time' ? 'all_time' : 'year',
      year: scope === 'year' ? period : (scope === 'quarter' ? period.split('-Q')[0] : null),
      includeLive: false,
      modeFilter: 'all'
    };

    // Вычисляем статистику
    const stats = buildPlayerStats(
      pubgNick,
      { profile: profileForStats, tournaments, tablesById },
      options
    );

    // Сохраняем в кеш
    await this.saveStats(playerId, scope, period, stats);

    return stats;
  }

  /**
   * Пересчитать статистику для игрока для всех периодов
   * @param {string} playerId - Идентификатор игрока
   * @param {string|null} tournamentDate - Дата турнира (опционально, для определения периодов)
   */
  async recalculateAllPeriods(playerId, tournamentDate = null) {
    const periods = tournamentDate 
      ? getPeriodsForDate(tournamentDate)
      : getPeriodsForDate(new Date());

    try {
      // Загружаем профиль один раз, чтобы избежать повторных загрузок
      const PlayerService = require('./PlayerService');
      const profile = await PlayerService.getPlayerProfile(playerId);
      if (!profile) {
        throw new Error(`Player profile not found: ${playerId}`);
      }
      
      // Пересчитываем all_time
      await this.calculateAndSaveStats(playerId, 'all_time', null, profile);
      
      // Пересчитываем текущий год
      await this.calculateAndSaveStats(playerId, 'year', periods.year, profile);
      
      // Пересчитываем текущий квартал
      await this.calculateAndSaveStats(playerId, 'quarter', periods.quarter, profile);
      
      console.log(`✅ Пересчитана статистика для ${playerId} (all_time, ${periods.year}, ${periods.quarter})`);
    } catch (error) {
      console.error(`❌ Ошибка пересчета статистики для ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Пересчитать статистику для всех игроков
   */
  async recalculateAllPlayers() {
    const fs = require('fs');
    const { playersDir } = require('../config/dataPaths');
    
    const files = fs.readdirSync(playersDir).filter(f => f.endsWith('.json'));
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
      const playerId = file.slice(0, -5); // Убираем .json
      try {
        await this.recalculateAllPeriods(playerId);
        successCount++;
      } catch (error) {
        console.error(`Ошибка пересчета для ${playerId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Пересчет завершен: ${successCount} успешно, ${errorCount} ошибок`);
    return { successCount, errorCount, total: files.length };
  }
}

module.exports = new PlayerStatsCacheService();
