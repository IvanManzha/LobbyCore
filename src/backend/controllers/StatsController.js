// src/backend/controllers/StatsController.js
const StatsService = require('../services/StatsService');
const PlayerService = require('../services/PlayerService');
const PlayerStatsCacheService = require('../services/PlayerStatsCacheService');
const ChampionshipsService = require('../services/ChampionshipsService');
const MetricRecordsService = require('../services/MetricRecordsService');

class StatsController {
  /**
   * POST /api/v1/stats/recalculate-all
   * Пересчитать все рейтинги
   */
  async recalculateAllRatings(req, res) {
    try {
      await StatsService.recalculateAllRatings();
      res.json({ success: true, message: 'All ratings recalculated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/stats/update-histories/:tournamentId
   * Обновить истории игроков после турнира
   */
  async updateHistories(req, res) {
    try {
      const { tournamentId } = req.params;
      await StatsService.updatePlayerHistoriesAfterTournament(tournamentId);
      res.json({ success: true, message: 'Player histories updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/stats/create-year-snapshot/:year
   * Создать срез статистики по году (для обнуления в новом году)
   */
  async createYearSnapshot(req, res) {
    try {
      const { year } = req.params;
      const result = await StatsService.createYearSnapshot(year);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/stats/recalculate/:playerId
   * Пересчитать статистику для конкретного игрока
   */
  async recalculatePlayerStats(req, res) {
    try {
      const { playerId } = req.params;
      const { tournamentDate } = req.body; // Опционально: дата турнира для определения периодов
      
      await PlayerStatsCacheService.recalculateAllPeriods(playerId, tournamentDate);
      res.json({ 
        success: true, 
        message: `Statistics recalculated for player ${playerId}` 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/stats/recalculate-all
   * Пересчитать статистику для всех игроков (только для админов)
   */
  async recalculateAllPlayerStats(req, res) {
    try {
      const StatsRecalculationQueue = require('../services/StatsRecalculationQueue');
      
      // Добавляем все игроки в очередь вместо синхронного пересчета
      const fs = require('fs');
      const { playersDir } = require('../config/dataPaths');
      const files = fs.readdirSync(playersDir).filter(f => f.endsWith('.json'));
      
      const tasks = files.map(file => ({
        playerId: file.slice(0, -5) // Убираем .json
      }));
      
      await StatsRecalculationQueue.enqueueBatch(tasks, 'normal');
      
      res.json({ 
        success: true, 
        message: `Added ${tasks.length} players to recalculation queue`,
        queueStatus: StatsRecalculationQueue.getStatus()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/stats/queue-status
   * Получить статус очереди пересчета статистики (только для админов)
   */
  async getQueueStatus(req, res) {
    try {
      const StatsRecalculationQueue = require('../services/StatsRecalculationQueue');
      res.json({
        success: true,
        status: StatsRecalculationQueue.getStatus()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/stats/percentile
   * Получить перцентиль для метрики игрока
   * Query params: metric, scope, value, playerId
   */
  async getPercentile(req, res) {
    try {
      const { metric, scope, value, playerId } = req.query;

      if (!metric || !scope || value == null || !playerId) {
        return res.status(400).json({
          error: 'Missing required parameters: metric, scope, value, playerId'
        });
      }

      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        return res.status(400).json({ error: 'Invalid value parameter' });
      }

      const percentile = await MetricRecordsService.calculatePercentile(
        playerId,
        metric,
        numericValue,
        scope
      );

      res.json({
        success: true,
        percentile,
        metric,
        scope,
        value: numericValue
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/stats/rebuild-championships
   * Пересчитать чемпионства для игрока (backfill). Query: playerId. Только для админов.
   */
  async rebuildChampionships(req, res) {
    try {
      const playerId = req.query.playerId || req.body?.playerId;
      if (!playerId) {
        return res.status(400).json({ error: 'playerId обязателен (query или body)' });
      }
      const data = await ChampionshipsService.rebuildChampionshipsForPlayer(playerId);
      const all = ChampionshipsService.loadPlayerStats();
      const key = PlayerService.normalizeUsername(playerId);
      if (!all[key]) all[key] = {};
      all[key].championships = data;
      ChampionshipsService.savePlayerStats(all);
      res.json({ success: true, championships: data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new StatsController();
