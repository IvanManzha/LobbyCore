// src/backend/controllers/AdminTournamentController.js
const AdminTournamentService = require('../services/AdminTournamentService');
const AdminLogService = require('../services/AdminLogService');
const { getAdminTournamentsPath } = require('../config/dataPaths');

function checkDevData(res) {
  if (!getAdminTournamentsPath()) {
    res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    return false;
  }
  return true;
}

class AdminTournamentController {
  async getAll(req, res) {
    if (!checkDevData(res)) return;
    try {
      const list = await AdminTournamentService.getAllTournaments();
      if (list === null) {
        return res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
      }
      res.json(list);
    } catch (error) {
      console.error('Admin tournaments getAll:', error);
      res.status(500).json({ error: 'Failed to load admin tournaments' });
    }
  }

  async getById(req, res) {
    if (!checkDevData(res)) return;
    try {
      const { id } = req.params;
      const tournament = await AdminTournamentService.getTournamentById(id);
      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      res.json(tournament);
    } catch (error) {
      console.error('Admin tournaments getById:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    if (!checkDevData(res)) return;
    try {
      const tournament = await AdminTournamentService.createTournament(req.body);
      AdminLogService.add(req.user?.username || req.user?.playerName, 'tournament.create', 'tournament', tournament.id);
      res.status(201).json({ success: true, tournament });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    if (!checkDevData(res)) return;
    try {
      const { id } = req.params;
      const tournament = await AdminTournamentService.updateTournament(id, req.body);
      AdminLogService.add(req.user?.username || req.user?.playerName, 'tournament.update', 'tournament', id);
      res.json({ success: true, tournament });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }

  async setStatus(req, res) {
    if (!checkDevData(res)) return;
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status || !['REG', 'LIVE', 'DONE'].includes(status)) {
        return res.status(400).json({ error: 'status must be REG, LIVE, or DONE' });
      }
      const tournament = await AdminTournamentService.setStatus(id, status);
      AdminLogService.add(req.user?.username || req.user?.playerName, 'tournament.setStatus', 'tournament', id);
      res.json({ success: true, tournament });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new AdminTournamentController();
