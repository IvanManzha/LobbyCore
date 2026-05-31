const AchievementService = require('../services/AchievementService');

class PlayerCosmeticsController {
  async getPlayerCosmetics(req, res) {
    try {
      const { name } = req.params;
      const payload = await AchievementService.getCosmeticsPayload(name);
      if (!payload) {
        return res.status(404).json({ error: 'Player not found' });
      }
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyCosmetics(req, res) {
    try {
      const username = req.user?.username;
      if (!username) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const payload = await AchievementService.getCosmeticsPayload(username);
      if (!payload) {
        return res.status(404).json({ error: 'Player not found' });
      }
      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateMyCosmetics(req, res) {
    try {
      const username = req.user?.username;
      if (!username) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const payload = await AchievementService.updateLoadout(username, {
        backgroundId: req.body.backgroundId ?? null,
        badgeIds: Array.isArray(req.body.badgeIds) ? req.body.badgeIds : [],
      });

      res.json(payload);
    } catch (error) {
      if (error.message === 'Player not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PlayerCosmeticsController();
