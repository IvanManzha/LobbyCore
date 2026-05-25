const LadderService = require('../services/LadderService');

class LadderController {
  /**
   * GET /api/v1/ladder?season=2026
   * Лидерборд Ladder по сезону.
   */
  async getLeaderboard(req, res) {
    try {
      const season = req.query.season || String(new Date().getFullYear());
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const rows = await LadderService.getLadderLeaderboard(season, limit);
      res.json({ season, rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/v1/ladder/seasonal-reset
   * Admin only. Body: { oldSeasonId, newSeasonId }. Runs soft reset: newRating = Base + 0.5 * (old - Base).
   */
  async runSeasonalReset(req, res) {
    try {
      const oldSeasonId = req.body?.oldSeasonId || req.query?.old;
      const newSeasonId = req.body?.newSeasonId || req.query?.new;
      if (!oldSeasonId || !newSeasonId) {
        return res.status(400).json({ error: 'oldSeasonId and newSeasonId required' });
      }
      const result = await LadderService.runSeasonalSoftReset(
        String(oldSeasonId),
        String(newSeasonId)
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new LadderController();
