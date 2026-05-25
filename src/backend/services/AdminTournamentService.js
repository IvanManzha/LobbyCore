// src/backend/services/AdminTournamentService.js
// Admin Studio uses the same DB as the main app (TournamentService).
const TournamentService = require('./TournamentService');

const STATUS_MAP = {
  REG: 'Запланирован',
  LIVE: 'В процессе',
  DONE: 'Турнир окончен'
};

const defaultPlacements = {
  1: 25, 2: 20, 3: 17, 4: 15, 5: 13, 6: 11,
  7: 10, 8: 9, 9: 8, 10: 7, 11: 6, 12: 5
};

function adminDataToCreatePayload(tournamentData) {
  const scoring = { placement: {}, per_kill: tournamentData.perKill ?? 2 };
  for (let i = 1; i <= 20; i++) {
    const key = `placement${i}`;
    scoring.placement[i] = (tournamentData[key] != null && tournamentData[key] !== '')
      ? tournamentData[key]
      : defaultPlacements[i];
  }
  return {
    name: tournamentData.name,
    date: tournamentData.date || tournamentData.startDate,
    type: (tournamentData.type || tournamentData.mode || 'solo').toLowerCase(),
    startAt: tournamentData.startAt || null,
    price: tournamentData.price ?? tournamentData.fees?.amount ?? null,
    rounds: tournamentData.rounds ?? tournamentData.roundsCount ?? 5,
    barrier: tournamentData.barrier ?? tournamentData.ratingCap ?? null,
    rules: typeof tournamentData.rules === 'string' ? tournamentData.rules : (tournamentData.rulesText || ''),
    ratingPlacement1: tournamentData.ratingRules?.placement?.['1'] ?? 6,
    ratingPlacement2: tournamentData.ratingRules?.placement?.['2'] ?? 5,
    ratingPlacement3: tournamentData.ratingRules?.placement?.['3'] ?? 4,
    ratingDefault: tournamentData.ratingRules?.default ?? 3,
    perKill: tournamentData.perKill ?? 2,
    ...Object.fromEntries(
      Object.entries(defaultPlacements).map(([k, v]) => [`placement${k}`, v])
    )
  };
}

class AdminTournamentService {
  async getAllTournaments() {
    return await TournamentService.getAllTournaments();
  }

  async getTournamentById(tournamentId) {
    return await TournamentService.getTournamentById(tournamentId);
  }

  async getTournamentTable(tournamentId) {
    return await TournamentService.getTournamentTable(tournamentId);
  }

  async updateTournamentTable(tournamentId, tableData) {
    await TournamentService.updateTournamentTable(tournamentId, tableData);
  }

  async createTournament(tournamentData) {
    const payload = adminDataToCreatePayload(tournamentData);
    return await TournamentService.createTournament(payload);
  }

  async updateTournament(tournamentId, body) {
    await TournamentService.updateTournament(tournamentId, (t) => {
      const allowed = ['name', 'date', 'type', 'rounds', 'price', 'barrier', 'rules', 'ratingRules', 'registration', 'state'];
      allowed.forEach(field => {
        if (body[field] !== undefined) t[field] = body[field];
      });
      if (body.fees !== undefined) t.price = body.fees.amount ?? t.price;
      if (body.ratingCap !== undefined) t.barrier = body.ratingCap;
      if (body.startDate !== undefined) t.date = body.startDate;
      if (body.finance !== undefined) {
        t.finance = body.finance;
        t.extra = t.extra || {};
        t.extra.finance = body.finance;
      }
    });
    return await TournamentService.getTournamentById(tournamentId);
  }

  async setStatus(tournamentId, status) {
    const mapped = STATUS_MAP[status];
    if (!mapped) throw new Error(`Invalid status: ${status}. Use REG, LIVE, or DONE.`);

    await TournamentService.updateTournament(tournamentId, (t) => {
      t.state = mapped;
      if (status === 'LIVE') t.startedAt = t.startedAt || new Date().toISOString();
    });
    return await TournamentService.getTournamentById(tournamentId);
  }
}

module.exports = new AdminTournamentService();
