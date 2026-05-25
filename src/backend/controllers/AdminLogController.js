// src/backend/controllers/AdminLogController.js
const AdminLogService = require('../services/AdminLogService');
const { getAdminLogsPath } = require('../config/dataPaths');

function checkDevData(res) {
  if (!getAdminLogsPath()) {
    res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    return false;
  }
  return true;
}

class AdminLogController {
  async getLogs(req, res) {
    if (!checkDevData(res)) return;
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const logs = AdminLogService.getRecent(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AdminLogController();
