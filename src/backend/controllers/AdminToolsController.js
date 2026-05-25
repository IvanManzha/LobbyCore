// src/backend/controllers/AdminToolsController.js
const fs = require('fs').promises;
const path = require('path');
const { getAdminTournamentsPath, getAdminFeedPath, getAdminTournamentsDir } = require('../config/dataPaths');
const AdminLogService = require('../services/AdminLogService');

function checkDevData(res) {
  const tp = getAdminTournamentsPath();
  if (!tp) {
    res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    return false;
  }
  return true;
}

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

class AdminToolsController {
  async export(req, res) {
    if (!checkDevData(res)) return;
    try {
      const tp = getAdminTournamentsPath();
      const fp = getAdminFeedPath();
      const tournaments = await readJson(tp);
      const feed = await readJson(fp);
      res.json({ tournaments, feed });
    } catch (error) {
      console.error('Admin export:', error);
      res.status(500).json({ error: 'Failed to export' });
    }
  }

  async clear(req, res) {
    if (!checkDevData(res)) return;
    try {
      const tp = getAdminTournamentsPath();
      const fp = getAdminFeedPath();
      const dir = getAdminTournamentsDir();
      await writeJson(tp, []);
      await writeJson(fp, []);
      if (dir) {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory()) {
              await fs.rm(path.join(dir, e.name), { recursive: true });
            }
          }
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
      }
      AdminLogService.add(req.user?.username || req.user?.playerName, 'tools.clear', null, null);
      res.json({ success: true, message: 'Dev data cleared' });
    } catch (error) {
      console.error('Admin clear:', error);
      res.status(500).json({ error: 'Failed to clear' });
    }
  }
}

module.exports = new AdminToolsController();
