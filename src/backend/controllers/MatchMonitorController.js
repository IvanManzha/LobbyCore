// src/backend/controllers/MatchMonitorController.js
const MatchMonitorService = require('../services/MatchMonitorService');

class MatchMonitorController {
  /**
   * POST /api/v1/monitor/start
   * Запустить мониторинг матчей
   */
  async start(req, res) {
    try {
      MatchMonitorService.start();
      res.json({ success: true, message: 'Мониторинг запущен' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/monitor/stop
   * Остановить мониторинг матчей
   */
  async stop(req, res) {
    try {
      MatchMonitorService.stop();
      res.json({ success: true, message: 'Мониторинг остановлен' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/monitor/check
   * Принудительно проверить активные турниры
   */
  async check(req, res) {
    try {
      await MatchMonitorService.checkActiveTournaments();
      res.json({ success: true, message: 'Проверка завершена' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/v1/monitor/status
   * Получить статус мониторинга
   */
  async status(req, res) {
    try {
      res.json({
        isRunning: MatchMonitorService.isRunning,
        checkInterval: MatchMonitorService.checkIntervalMs
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new MatchMonitorController();
