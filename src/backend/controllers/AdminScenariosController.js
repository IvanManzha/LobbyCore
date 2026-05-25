// src/backend/controllers/AdminScenariosController.js
const AdminScenariosService = require('../services/AdminScenariosService');
const AdminLogService = require('../services/AdminLogService');
const { getAdminTournamentsPath } = require('../config/dataPaths');

function checkDevData(res) {
  if (!getAdminTournamentsPath()) {
    res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    return false;
  }
  return true;
}

class AdminScenariosController {
  async list(req, res) {
    if (!checkDevData(res)) return;
    try {
      const presets = AdminScenariosService.listPresets();
      res.json(presets);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async run(req, res) {
    if (!checkDevData(res)) return;
    try {
      const { presetId } = req.body;
      if (!presetId) {
        return res.status(400).json({ error: 'presetId is required' });
      }
      const result = await AdminScenariosService.runPreset(presetId);
      AdminLogService.add(req.user?.username || req.user?.playerName, 'scenario.run', 'scenario', presetId);
      res.json({ success: true, ...result });
    } catch (error) {
      if (error.message.includes('Unknown preset') || error.message.includes('disabled')) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Admin scenarios run:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AdminScenariosController();
