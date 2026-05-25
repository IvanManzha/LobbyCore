/**
 * Finance (DropCoins) API — тонкая обёртка над FinanceService.
 * req.user: pubgNick или username как playerId.
 */
const FinanceService = require('../services/FinanceService');
const TournamentService = require('../services/TournamentService');

function getPlayerId(req) {
  const id = req.user?.pubgNick || req.user?.username;
  if (!id) throw new Error('Необходима авторизация');
  return id;
}

async function getWallet(req, res) {
  try {
    const playerId = getPlayerId(req);
    const wallet = FinanceService.getWallet(playerId);
    res.json(wallet);
  } catch (e) {
    res.status(e.message === 'Необходима авторизация' ? 401 : 500).json({ error: e.message });
  }
}

async function getLedger(req, res) {
  try {
    const playerId = getPlayerId(req);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const entries = FinanceService.getLedgerEntries(playerId, limit);
    res.json(entries);
  } catch (e) {
    res.status(e.message === 'Необходима авторизация' ? 401 : 500).json({ error: e.message });
  }
}

async function getMyTopups(req, res) {
  try {
    const playerId = getPlayerId(req);
    const topups = FinanceService.readTopups().filter((t) => t.playerId === playerId);
    res.json(topups);
  } catch (e) {
    res.status(e.message === 'Необходима авторизация' ? 401 : 500).json({ error: e.message });
  }
}

async function getMyCashouts(req, res) {
  try {
    const playerId = getPlayerId(req);
    const cashouts = FinanceService.readCashouts().filter((c) => c.playerId === playerId);
    res.json(cashouts);
  } catch (e) {
    res.status(e.message === 'Необходима авторизация' ? 401 : 500).json({ error: e.message });
  }
}

async function createTopup(req, res) {
  try {
    const playerId = getPlayerId(req);
    const amountDC = req.body?.amountDC;
    if (amountDC == null || !Number.isInteger(amountDC) || amountDC < 1) {
      return res.status(400).json({ error: 'Укажите сумму пополнения (целое число > 0)' });
    }
    const result = FinanceService.createTopupRequest(playerId, amountDC);
    res.status(201).json(result);
  } catch (e) {
    res.status(e.message === 'Необходима авторизация' ? 401 : 400).json({ error: e.message });
  }
}

async function confirmTopup(req, res) {
  try {
    const { id } = req.params;
    const adminNote = req.body?.adminNote;
    const topup = FinanceService.confirmTopup(id, adminNote);
    res.json(topup);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function rejectTopup(req, res) {
  try {
    const { id } = req.params;
    const adminNote = req.body?.adminNote;
    const topup = FinanceService.rejectTopup(id, adminNote);
    res.json(topup);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function payEntry(req, res) {
  try {
    const playerId = getPlayerId(req);
    const tournamentId = req.params.id;
    const result = await FinanceService.payEntry(playerId, tournamentId, TournamentService);
    res.json(result);
  } catch (e) {
    const status = e.message === 'Необходима авторизация' ? 401 : 400;
    res.status(status).json({ error: e.message });
  }
}

async function payShare(req, res) {
  try {
    const playerId = getPlayerId(req);
    const tournamentId = req.params.id;
    const result = await FinanceService.payShare(playerId, tournamentId, TournamentService);
    res.json(result);
  } catch (e) {
    const status = e.message === 'Необходима авторизация' ? 401 : 400;
    res.status(status).json({ error: e.message });
  }
}

async function leavePreview(req, res) {
  try {
    const playerId = getPlayerId(req);
    const tournamentId = req.params.id;
    const tournament = await TournamentService.getTournamentById(tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Турнир не найден' });
    const finance = tournament.finance || tournament.extra?.finance;
    const entryFeeDC = finance?.entryFeeDC ?? 0;
    const entries = tournament.registration?.entries || [];
    const isPlayerInEntry = (e) => {
      if (e.kind === 'solo') return e.playerId === playerId;
      return e.captainId === playerId || (e.members && e.members.includes(playerId));
    };
    const entry = entries.find(isPlayerInEntry);
    if (!entry || entryFeeDC <= 0) {
      return res.json({ refundPercent: 0, refundDC: 0, entryFeeDC: 0 });
    }
    const refundPercent = FinanceService.getRefundPercentByStartTime(tournament);
    let totalPaid = 0;
    let refundDC = 0;
    if (entry.kind === 'solo') {
      totalPaid = entry.paidAt ? entryFeeDC : 0;
      refundDC = totalPaid > 0 ? Math.floor((totalPaid * refundPercent) / 100) : 0;
    } else {
      const memberPayments = entry.memberPayments && typeof entry.memberPayments === 'object' ? entry.memberPayments : {};
      const members = entry.members || (entry.captainId ? [entry.captainId] : []);
      for (const pid of members) {
        const paid = memberPayments[pid] || 0;
        totalPaid += paid;
        refundDC += Math.floor((paid * refundPercent) / 100);
      }
    }
    res.json({ refundPercent, refundDC, entryFeeDC, totalPaid });
  } catch (e) {
    res.status(e.message === 'Необходима авторизация' ? 401 : 500).json({ error: e.message });
  }
}

async function leave(req, res) {
  try {
    const playerId = getPlayerId(req);
    const tournamentId = req.params.id;
    const result = await FinanceService.leaveTournament(playerId, tournamentId, TournamentService);
    res.json(result);
  } catch (e) {
    const status = e.message === 'Необходима авторизация' ? 401 : 400;
    res.status(status).json({ error: e.message });
  }
}

async function transfer(req, res) {
  try {
    const fromPlayerId = getPlayerId(req);
    const { toPlayerId, amountDC } = req.body || {};
    if (!toPlayerId) {
      return res.status(400).json({ error: 'Укажите получателя перевода' });
    }
    const amount = Number(amountDC);
    if (!Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({ error: 'Сумма перевода должна быть целым числом больше 0' });
    }
    const result = FinanceService.transfer(fromPlayerId, toPlayerId, amount);
    res.json(result);
  } catch (e) {
    const status = e.message === 'Необходима авторизация' ? 401 : 400;
    res.status(status).json({ error: e.message });
  }
}

async function finalizePayout(req, res) {
  try {
    const tournamentId = req.params.id;
    const result = await FinanceService.finalizePayout(tournamentId, TournamentService);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function createCashout(req, res) {
  try {
    const playerId = getPlayerId(req);
    const { amountDC, method, destination } = req.body || {};
    if (amountDC == null || !Number.isInteger(amountDC) || amountDC < 1) {
      return res.status(400).json({ error: 'Укажите сумму вывода (целое число > 0)' });
    }
    const cashout = FinanceService.createCashoutRequest(playerId, { amountDC, method, destination });
    res.status(201).json(cashout);
  } catch (e) {
    res.status(e.message === 'Необходима авторизация' ? 401 : 400).json({ error: e.message });
  }
}

async function markCashoutPaid(req, res) {
  try {
    const { id } = req.params;
    const adminNote = req.body?.adminNote;
    const cashout = FinanceService.markCashoutPaid(id, adminNote);
    res.json(cashout);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function rejectCashout(req, res) {
  try {
    const { id } = req.params;
    const adminNote = req.body?.adminNote;
    const cashout = FinanceService.rejectCashout(id, adminNote);
    res.json(cashout);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function listTopups(req, res) {
  try {
    const status = req.query.status || 'pending';
    const topups = FinanceService.readTopups();
    const filtered = status ? topups.filter((t) => t.status === status) : topups;
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function listCashouts(req, res) {
  try {
    const status = req.query.status || 'requested';
    const cashouts = FinanceService.readCashouts();
    const filtered = status ? cashouts.filter((c) => c.status === status) : cashouts;
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function listPayoutBatches(req, res) {
  try {
    const status = req.query.status || '';
    const batches = FinanceService.getPayoutBatches(status || undefined);
    res.json(batches);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getPayoutBatch(req, res) {
  try {
    const { id } = req.params;
    const batch = FinanceService.getPayoutBatchById(id);
    if (!batch) return res.status(404).json({ error: 'Пакет выплат не найден' });
    res.json(batch);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function markPayoutLinePaid(req, res) {
  try {
    const { id: batchId, lineId } = req.params;
    FinanceService.markPayoutLinePaid(batchId, lineId);
    const batch = FinanceService.getPayoutBatchById(batchId);
    if (batch?.tournamentId) {
      await FinanceService.syncPayoutSummaryToTournament(
        batch.tournamentId,
        batch,
        TournamentService
      );
    }
    res.json(batch);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function markPayoutBatchAllPaid(req, res) {
  try {
    const { id: batchId } = req.params;
    const batch = await FinanceService.executePayoutBatch(batchId, TournamentService);
    res.json(batch);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

async function getFinalFunds(req, res) {
  try {
    const funds = FinanceService.readFinalFunds();
    res.json(funds);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function reconcileTournament(req, res) {
  try {
    const tournamentId = req.params.tournamentId;
    const TournamentService = require('../services/TournamentService');
    const result = await FinanceService.reconcileTournament(tournamentId, TournamentService);
    res.json(result);
  } catch (e) {
    res.status(e.message?.includes('не найден') ? 404 : 500).json({ error: e.message });
  }
}

module.exports = {
  getWallet,
  getLedger,
  getMyTopups,
  getMyCashouts,
  createTopup,
  confirmTopup,
  rejectTopup,
  payEntry,
  payShare,
  leavePreview,
  leave,
  finalizePayout,
  createCashout,
  markCashoutPaid,
  rejectCashout,
  listTopups,
  listCashouts,
  listPayoutBatches,
  getPayoutBatch,
  markPayoutLinePaid,
  markPayoutBatchAllPaid,
  getFinalFunds,
  reconcileTournament,
  transfer
};
