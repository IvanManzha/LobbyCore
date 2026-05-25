/**
 * Finance (DropCoins) service — ledger-first.
 * All balance changes go through append-only ledger; wallets/topups/cashouts are derived or cached.
 */
const fs = require('fs');
const path = require('path');
const {
  walletsPath,
  ledgerPath,
  topupsPath,
  cashoutsPath,
  finalFundsPath,
  payoutBatchesPath,
  dataDir
} = require('../config/dataPaths');
const { getTopupInstructions } = require('../config/finance');
const { getQuarterFromDate } = require('../utils/periodUtils');

/** Ключ накопления final fund: явный finance.seasonId или квартал по дате турнира. */
function resolveFinalFundSeasonId(tournament) {
  const finance = tournament?.finance || tournament?.extra?.finance;
  if (finance && finance.seasonId != null && String(finance.seasonId).trim() !== '') {
    return String(finance.seasonId).trim();
  }
  const d = tournament?.date || tournament?.startAt;
  if (d) {
    try {
      return getQuarterFromDate(d);
    } catch (_e) {
      /* invalid date */
    }
  }
  return new Date().getFullYear().toString();
}

const TREASURY = 'treasury';

function generateId(prefix = '') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${t}_${r}` : `${t}_${r}`;
}

function generateReferenceCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TOPUP-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function readJson(filePath, defaultValue) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') return defaultValue;
    throw e;
  }
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function readLedger() {
  return readJson(ledgerPath, []);
}

function readWallets() {
  return readJson(walletsPath, {});
}

function readTopups() {
  return readJson(topupsPath, []);
}

function readCashouts() {
  return readJson(cashoutsPath, []);
}

function readFinalFunds() {
  return readJson(finalFundsPath, {});
}

function readPayoutBatches() {
  return readJson(payoutBatchesPath, []);
}

function writePayoutBatches(batches) {
  writeJson(payoutBatchesPath, batches);
}

/**
 * Внутренний перевод DC между игроками.
 * Одна запись в ledger с type PLAYER_TRANSFER, from=player:sender, to=player:recipient.
 */
function transfer(fromPlayerId, toPlayerId, amountDC) {
  const fromId = String(fromPlayerId || '').trim();
  const toId = String(toPlayerId || '').trim();
  if (!fromId) {
    throw new Error('Отправитель не указан');
  }
  if (!toId) {
    throw new Error('Укажите получателя перевода');
  }
  if (fromId === toId) {
    throw new Error('Нельзя переводить DC самому себе');
  }
  const amount = Number(amountDC);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Сумма перевода должна быть целым числом больше 0');
  }

  const fromWallet = getWallet(fromId);
  if (fromWallet.availableDC < amount) {
    throw new Error(`Недостаточно DC: доступно ${fromWallet.availableDC}, требуется ${amount}`);
  }

  const now = new Date().toISOString();
  appendLedger({
    type: 'PLAYER_TRANSFER',
    amountDC: amount,
    from: `player:${fromId}`,
    to: `player:${toId}`,
    status: 'confirmed',
    meta: { fromPlayerId: fromId, toPlayerId: toId },
    createdAt: now,
    confirmedAt: now
  });

  const updatedFrom = recomputeWallet(fromId);
  const updatedTo = recomputeWallet(toId);
  return {
    fromWallet: updatedFrom,
    toWallet: updatedTo
  };
}

function appendLedger(entry) {
  const ledger = readLedger();
  const full = {
    id: entry.id || generateId('ledger'),
    type: entry.type,
    amountDC: entry.amountDC,
    from: entry.from,
    to: entry.to,
    status: entry.status ?? 'confirmed',
    meta: entry.meta || {},
    createdAt: entry.createdAt || new Date().toISOString(),
    confirmedAt: entry.confirmedAt || (entry.status === 'confirmed' ? new Date().toISOString() : null)
  };
  ledger.push(full);
  writeJson(ledgerPath, ledger);
  return full;
}

/**
 * Recompute wallet balance from ledger for a player (confirmed entries only).
 */
function recomputeWallet(playerId) {
  const ledger = readLedger();
  let balanceDC = 0;
  for (const e of ledger) {
    if (e.status !== 'confirmed') continue;
    const fromPlayer = e.from === `player:${playerId}`;
    const toPlayer = e.to === `player:${playerId}`;
    if (toPlayer) balanceDC += e.amountDC;
    if (fromPlayer) balanceDC -= e.amountDC;
  }
  const cashouts = readCashouts();
  let reservedDC = 0;
  for (const c of cashouts) {
    if (c.playerId === playerId && (c.status === 'requested' || c.status === 'pending')) {
      reservedDC += c.amountDC || 0;
    }
  }
  const wallets = readWallets();
  const updatedAt = new Date().toISOString();
  wallets[playerId] = {
    playerId,
    balanceDC,
    reservedDC,
    updatedAt
  };
  writeJson(walletsPath, wallets);
  return wallets[playerId];
}

function getWallet(playerId) {
  const wallets = readWallets();
  let w = wallets[playerId];
  if (!w) {
    w = recomputeWallet(playerId);
  }
  const availableDC = Math.max(0, (w.balanceDC || 0) - (w.reservedDC || 0));
  return {
    playerId,
    balanceDC: w.balanceDC || 0,
    reservedDC: w.reservedDC || 0,
    availableDC,
    updatedAt: w.updatedAt
  };
}

function getLedgerEntries(playerId, limit = 50) {
  const ledger = readLedger();
  const key = `player:${playerId}`;
  const filtered = ledger.filter(
    (e) => e.from === key || e.to === key
  );
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return filtered.slice(0, limit);
}

function createTopupRequest(playerId, amountDC) {
  if (!amountDC || amountDC < 1 || !Number.isInteger(amountDC)) {
    throw new Error('Сумма пополнения должна быть целым числом больше 0');
  }
  const referenceCode = generateReferenceCode();
  const id = generateId('topup');
  const topups = readTopups();
  const now = new Date().toISOString();
  const topup = {
    id,
    playerId,
    amountDC,
    referenceCode,
    status: 'pending',
    createdAt: now,
    confirmedAt: null,
    adminNote: null
  };
  topups.push(topup);
  writeJson(topupsPath, topups);
  const instructions = getTopupInstructions(amountDC, referenceCode);
  return {
    topupId: id,
    amountDC,
    referenceCode,
    instructions
  };
}

function confirmTopup(topupId, adminNote) {
  const topups = readTopups();
  const idx = topups.findIndex((t) => t.id === topupId);
  if (idx === -1) throw new Error('Заявка на пополнение не найдена');
  const topup = topups[idx];
  if (topup.status !== 'pending') {
    throw new Error(`Заявка уже обработана: ${topup.status}`);
  }
  const now = new Date().toISOString();
  appendLedger({
    type: 'TOPUP_CONFIRMED',
    amountDC: topup.amountDC,
    from: TREASURY,
    to: `player:${topup.playerId}`,
    status: 'confirmed',
    meta: { topupId, playerId: topup.playerId },
    createdAt: now,
    confirmedAt: now
  });
  recomputeWallet(topup.playerId);
  topups[idx] = {
    ...topup,
    status: 'confirmed',
    confirmedAt: now,
    adminNote: adminNote || topup.adminNote
  };
  writeJson(topupsPath, topups);
  return topups[idx];
}

function rejectTopup(topupId, adminNote) {
  const topups = readTopups();
  const idx = topups.findIndex((t) => t.id === topupId);
  if (idx === -1) throw new Error('Заявка на пополнение не найдена');
  const topup = topups[idx];
  if (topup.status !== 'pending') {
    throw new Error(`Заявка уже обработана: ${topup.status}`);
  }
  const now = new Date().toISOString();
  appendLedger({
    type: 'TOPUP_REJECTED',
    amountDC: topup.amountDC,
    from: TREASURY,
    to: `player:${topup.playerId}`,
    status: 'rejected',
    meta: { topupId, playerId: topup.playerId, referenceCode: topup.referenceCode },
    createdAt: now,
    confirmedAt: now
  });
  topups[idx] = {
    ...topup,
    status: 'rejected',
    confirmedAt: now,
    adminNote: adminNote || topup.adminNote
  };
  writeJson(topupsPath, topups);
  return topups[idx];
}

/**
 * Pay one player's share (solo: full entry; team: entryFeeDC per player).
 * Used for per-player payment. finalFundRate % to quarterly fund, rest to pot.
 */
async function payShare(playerId, tournamentId, tournamentService) {
  const tournament = await tournamentService.getTournamentById(tournamentId);
  if (!tournament) throw new Error('Турнир не найден');
  const finance = tournament.finance || tournament.extra?.finance;
  const entryFeeDC = finance?.entryFeeDC ?? 0;
  if (entryFeeDC <= 0) throw new Error('Взнос за турнир не предусмотрен');

  const entries = tournament.registration?.entries || [];
  const isPlayerInEntry = (e) => {
    if (e.kind === 'solo') return e.playerId === playerId;
    return e.captainId === playerId || (e.members && e.members.includes(playerId));
  };
  const entry = entries.find(isPlayerInEntry);
  if (!entry) throw new Error('Вы не зарегистрированы на этот турнир');

  let amountToPay = entryFeeDC;
  let memberPayments = {};
  if (entry.kind === 'team') {
    memberPayments = entry.memberPayments && typeof entry.memberPayments === 'object' ? { ...entry.memberPayments } : {};
    const paidSoFar = memberPayments[playerId] || 0;
    if (paidSoFar >= entryFeeDC) throw new Error('Ваша доля уже оплачена');
    amountToPay = Math.min(entryFeeDC - paidSoFar, entryFeeDC);
  } else {
    if (entry.paidAt) throw new Error('Взнос уже оплачен');
  }

  const wallet = getWallet(playerId);
  if (wallet.availableDC < amountToPay) {
    throw new Error(`Недостаточно DC. Доступно: ${wallet.availableDC}, нужно: ${amountToPay}`);
  }

  const finalFundRate = finance?.finalFundRate ?? 15;
  const seasonId = resolveFinalFundSeasonId(tournament);
  const toFinalDC = Math.floor((amountToPay * finalFundRate) / 100);
  const toPotDC = amountToPay - toFinalDC;

  const now = new Date().toISOString();
  appendLedger({
    type: 'TOURNAMENT_ENTRY',
    amountDC: amountToPay,
    from: `player:${playerId}`,
    to: `tournament:${tournamentId}`,
    status: 'confirmed',
    meta: { tournamentId, tournamentName: tournament.name, playerId, entryKind: entry.kind, share: true },
    createdAt: now,
    confirmedAt: now
  });
  recomputeWallet(playerId);

  if (toFinalDC > 0) {
    const finalFunds = readFinalFunds();
    finalFunds[seasonId] = {
      seasonId,
      balanceDC: (finalFunds[seasonId]?.balanceDC || 0) + toFinalDC,
      updatedAt: now
    };
    writeJson(finalFundsPath, finalFunds);
    appendLedger({
      type: 'POT_TO_FINAL_FUND',
      amountDC: toFinalDC,
      from: `tournament:${tournamentId}`,
      to: `finalFund:${seasonId}`,
      status: 'confirmed',
      meta: { tournamentId, seasonId, tournamentName: tournament.name },
      createdAt: now,
      confirmedAt: now
    });
  }

  const potDC = (finance?.potDC || 0) + toPotDC;
  const finalFundContributedDC = (finance?.finalFundContributedDC || 0) + toFinalDC;
  const newEntries = entries.map((e) => {
    if (!isPlayerInEntry(e)) return e;
    if (e.kind === 'solo') {
      return { ...e, paidAt: now };
    }
    const mp = e.memberPayments && typeof e.memberPayments === 'object' ? { ...e.memberPayments } : {};
    mp[playerId] = (mp[playerId] || 0) + amountToPay;
    const members = e.members || (e.captainId ? [e.captainId] : []);
    const allPaid = members.every((pid) => (mp[pid] || 0) >= entryFeeDC);
    return { ...e, memberPayments: mp, allPaidAt: allPaid ? now : e.allPaidAt };
  });
  await tournamentService.updateTournament(tournamentId, (t) => {
    t.registration = t.registration || {};
    t.registration.entries = newEntries;
    t.extra = t.extra || {};
    t.extra.finance = { ...(t.finance || t.extra.finance || {}), potDC, finalFundContributedDC };
    t.finance = t.extra.finance;
  });

  return { paid: amountToPay, potDC, toFinalDC };
}

/**
 * Pay tournament entry fee. Solo: entryFeeDC; team: entryFeeDC * members.length (legacy: one payer).
 * 15% (finalFundRate) goes to quarterly fund at pay time; rest to tournament pot.
 * For team, consider using payShare per player instead.
 */
async function payEntry(playerId, tournamentId, tournamentService) {
  const tournament = await tournamentService.getTournamentById(tournamentId);
  if (!tournament) throw new Error('Турнир не найден');
  const finance = tournament.finance || tournament.extra?.finance;
  const entryFeeDC = finance?.entryFeeDC ?? 0;
  if (entryFeeDC <= 0) throw new Error('Взнос за турнир не предусмотрен');

  const entries = tournament.registration?.entries || [];
  const isPlayerInEntry = (e) => {
    if (e.kind === 'solo') return e.playerId === playerId;
    return e.captainId === playerId || (e.members && e.members.includes(playerId));
  };
  const entry = entries.find(isPlayerInEntry);
  if (!entry) throw new Error('Вы не зарегистрированы на этот турнир');

  if (entry.kind === 'team') {
    const members = entry.members || (entry.captainId ? [entry.captainId] : []);
    const memberPayments = entry.memberPayments && typeof entry.memberPayments === 'object' ? { ...entry.memberPayments } : {};
    const unpaidCount = members.filter((pid) => (memberPayments[pid] || 0) < entryFeeDC).length;
    if (unpaidCount === 0) throw new Error('Взнос команды уже оплачен');
    const totalPaid = entryFeeDC * members.length;
    const wallet = getWallet(playerId);
    if (wallet.availableDC < totalPaid) {
      throw new Error(`Недостаточно DC. Доступно: ${wallet.availableDC}, нужно: ${totalPaid}`);
    }
    const finalFundRate = finance?.finalFundRate ?? 15;
    const seasonId = resolveFinalFundSeasonId(tournament);
    const toFinalDC = Math.floor((totalPaid * finalFundRate) / 100);
    const toPotDC = totalPaid - toFinalDC;
    const now = new Date().toISOString();
    appendLedger({
      type: 'TOURNAMENT_ENTRY',
      amountDC: totalPaid,
      from: `player:${playerId}`,
      to: `tournament:${tournamentId}`,
      status: 'confirmed',
      meta: { tournamentId, tournamentName: tournament.name, playerId, entryKind: 'team', membersCount: members.length },
      createdAt: now,
      confirmedAt: now
    });
    recomputeWallet(playerId);
    if (toFinalDC > 0) {
      const finalFunds = readFinalFunds();
      finalFunds[seasonId] = { seasonId, balanceDC: (finalFunds[seasonId]?.balanceDC || 0) + toFinalDC, updatedAt: now };
      writeJson(finalFundsPath, finalFunds);
      appendLedger({
        type: 'POT_TO_FINAL_FUND',
        amountDC: toFinalDC,
        from: `tournament:${tournamentId}`,
        to: `finalFund:${seasonId}`,
        status: 'confirmed',
        meta: { tournamentId, seasonId, tournamentName: tournament.name },
        createdAt: now,
        confirmedAt: now
      });
    }
    members.forEach((pid) => { memberPayments[pid] = entryFeeDC; });
    const potDC = (finance?.potDC || 0) + toPotDC;
    const finalFundContributedDC = (finance?.finalFundContributedDC || 0) + toFinalDC;
    const newEntries = entries.map((e) =>
      isPlayerInEntry(e) ? { ...e, memberPayments, paidAt: now, allPaidAt: now } : e
    );
    await tournamentService.updateTournament(tournamentId, (t) => {
      t.registration = t.registration || {};
      t.registration.entries = newEntries;
      t.extra = t.extra || {};
      t.extra.finance = { ...(t.finance || t.extra.finance || {}), potDC, finalFundContributedDC };
      t.finance = t.extra.finance;
    });
    return { paid: totalPaid, potDC, toFinalDC };
  }

  if (entry.paidAt) throw new Error('Взнос уже оплачен');
  return payShare(playerId, tournamentId, tournamentService);
}

/**
 * Refund percent by fixed rule: >4h before start => 100%, else => 50%.
 */
function getRegistrationDeadlineIso(tournament) {
  if (!tournament) return null;
  return tournament.startAt || tournament.startedAt || tournament.date || null;
}

/**
 * Разбить сумму места между игроками: floor + остаток по 1 DC (сумма = totalAmount).
 */
function splitAmountPerPlayer(totalAmount, playerCount) {
  if (playerCount <= 0 || totalAmount <= 0) return [];
  const base = Math.floor(totalAmount / playerCount);
  let remainder = totalAmount - base * playerCount;
  const amounts = Array(playerCount).fill(base);
  for (let i = 0; remainder > 0 && i < playerCount; i++) {
    amounts[i] += 1;
    remainder -= 1;
  }
  return amounts;
}

function getRefundPercentByStartTime(tournament) {
  const deadline = getRegistrationDeadlineIso(tournament);
  if (!deadline) return 0;
  const start = new Date(deadline);
  if (isNaN(start.getTime())) return 0;
  const now = new Date();
  const hoursLeft = (start - now) / (1000 * 60 * 60);

  const finance = tournament.finance || tournament.extra?.finance;
  const policy = finance?.withdrawalPolicy;
  if (Array.isArray(policy) && policy.length > 0) {
    const sorted = [...policy].sort(
      (a, b) => (b.hoursBeforeStart ?? 0) - (a.hoursBeforeStart ?? 0)
    );
    for (const rule of sorted) {
      const threshold = rule.hoursBeforeStart ?? 0;
      if (hoursLeft > threshold) {
        return rule.refundPercent ?? 0;
      }
    }
    const last = sorted[sorted.length - 1];
    return last?.refundPercent ?? 0;
  }

  return hoursLeft > 4 ? 100 : 50;
}

function resolveTeamCaptainId(tournament, team, players) {
  const entries = tournament.registration?.entries || [];
  const norm = (s) => (s == null ? '' : String(s).trim().toLowerCase());
  const teamName = norm(team.name);
  const entry = entries.find(
    (e) =>
      e.kind === 'team' &&
      (norm(e.name) === teamName || norm(e.teamId) === teamName)
  );
  if (entry?.captainId && players.includes(entry.captainId)) {
    return entry.captainId;
  }
  return players[0];
}

/**
 * Get refund percent by withdrawal policy (hours until start). Deprecated: use getRefundPercentByStartTime.
 */
function getRefundPercent(tournament) {
  return getRefundPercentByStartTime(tournament);
}

/**
 * Полный возврат (100%) взносов по одной записи при удалении команды/игрока админом.
 * Вызывается из TournamentService.removeTeam перед удалением из table и entries.
 * @returns {{ totalRefundDC: number }}
 */
async function refundEntryForRemoveTeam(tournamentId, entry, tournament, tournamentService) {
  const finance = tournament.finance || tournament.extra?.finance;
  const entryFeeDC = finance?.entryFeeDC ?? 0;
  if (!entry || entryFeeDC <= 0) return { totalRefundDC: 0 };

  const tournamentName = tournament.name || tournamentId;
  const now = new Date().toISOString();
  let totalRefundDC = 0;

  if (entry.kind === 'solo') {
    if (!entry.paidAt) return { totalRefundDC: 0 };
    const refundDC = entryFeeDC;
    appendLedger({
      type: 'TOURNAMENT_REFUND',
      amountDC: refundDC,
      from: `tournament:${tournamentId}`,
      to: `player:${entry.playerId}`,
      status: 'confirmed',
      meta: { tournamentId, tournamentName, playerId: entry.playerId, adminRemove: true },
      createdAt: now,
      confirmedAt: now
    });
    recomputeWallet(entry.playerId);
    totalRefundDC += refundDC;
  } else {
    const memberPayments = entry.memberPayments && typeof entry.memberPayments === 'object' ? entry.memberPayments : {};
    const members = entry.members || (entry.captainId ? [entry.captainId] : []);
    for (const pid of members) {
      const paid = memberPayments[pid] || 0;
      if (paid <= 0) continue;
      appendLedger({
        type: 'TOURNAMENT_REFUND',
        amountDC: paid,
        from: `tournament:${tournamentId}`,
        to: `player:${pid}`,
        status: 'confirmed',
        meta: { tournamentId, tournamentName, playerId: pid, adminRemove: true },
        createdAt: now,
        confirmedAt: now
      });
      recomputeWallet(pid);
      totalRefundDC += paid;
    }
  }

  if (totalRefundDC > 0) {
    const potDC = Math.max(0, (finance?.potDC || 0) - totalRefundDC);
    const newFinance = { ...finance, potDC };
    await tournamentService.updateTournament(tournamentId, (t) => {
      t.extra = t.extra || {};
      t.extra.finance = newFinance;
      t.finance = newFinance;
    });
  }
  return { totalRefundDC };
}

/**
 * Leave tournament with refund by policy (>4h 100%, <=4h 50%). Per-player refund/penalty for teams.
 * Decreases potDC only by the sum of refunds actually returned.
 */
async function leaveTournament(playerId, tournamentId, tournamentService) {
  const tournament = await tournamentService.getTournamentById(tournamentId);
  if (!tournament) throw new Error('Турнир не найден');
  const finance = tournament.finance || tournament.extra?.finance;
  const entryFeeDC = finance?.entryFeeDC ?? 0;

  const entries = tournament.registration?.entries || [];
  const freeAgents = tournament.registration?.freeAgents || [];
  const isPlayerInEntry = (e) => {
    if (e.kind === 'solo') return e.playerId === playerId;
    return e.captainId === playerId || (e.members && e.members.includes(playerId));
  };
  const entry = entries.find(isPlayerInEntry);
  const inFreeAgents = freeAgents.some((fa) => fa.playerId === playerId && fa.status !== 'withdrawn');

  const refundPercent = getRefundPercentByStartTime(tournament);
  let totalRefundDC = 0;
  const now = new Date().toISOString();
  const tournamentName = tournament.name || tournamentId;

  if (entry && entryFeeDC > 0) {
    if (entry.kind === 'solo') {
      const paid = entry.paidAt ? entryFeeDC : 0;
      if (paid > 0) {
        const refundDC = Math.floor((paid * refundPercent) / 100);
        const penaltyDC = paid - refundDC;
        totalRefundDC += refundDC;
        if (refundDC > 0) {
          appendLedger({
            type: 'TOURNAMENT_REFUND',
            amountDC: refundDC,
            from: `tournament:${tournamentId}`,
            to: `player:${playerId}`,
            status: 'confirmed',
            meta: { tournamentId, tournamentName, playerId },
            createdAt: now,
            confirmedAt: now
          });
        }
        if (penaltyDC > 0) {
          appendLedger({
            type: 'TOURNAMENT_PENALTY',
            amountDC: penaltyDC,
            from: `player:${playerId}`,
            to: TREASURY,
            status: 'confirmed',
            meta: { tournamentId, tournamentName, playerId },
            createdAt: now,
            confirmedAt: now
          });
        }
        recomputeWallet(playerId);
      }
    } else {
      const memberPayments = entry.memberPayments && typeof entry.memberPayments === 'object' ? entry.memberPayments : {};
      const members = entry.members || (entry.captainId ? [entry.captainId] : []);
      for (const pid of members) {
        const paid = memberPayments[pid] || 0;
        if (paid <= 0) continue;
        const refundDC = Math.floor((paid * refundPercent) / 100);
        const penaltyDC = paid - refundDC;
        totalRefundDC += refundDC;
        if (refundDC > 0) {
          appendLedger({
            type: 'TOURNAMENT_REFUND',
            amountDC: refundDC,
            from: `tournament:${tournamentId}`,
            to: `player:${pid}`,
            status: 'confirmed',
            meta: { tournamentId, tournamentName, playerId: pid },
            createdAt: now,
            confirmedAt: now
          });
        }
        if (penaltyDC > 0) {
          appendLedger({
            type: 'TOURNAMENT_PENALTY',
            amountDC: penaltyDC,
            from: `player:${pid}`,
            to: TREASURY,
            status: 'confirmed',
            meta: { tournamentId, tournamentName, playerId: pid },
            createdAt: now,
            confirmedAt: now
          });
        }
        recomputeWallet(pid);
      }
    }
  }

  const potDC = Math.max(0, (finance?.potDC || 0) - totalRefundDC);
  const newFinance = { ...finance, potDC };

  if (entry) {
    if (entry.kind === 'team') {
      await tournamentService.removeTeam(tournamentId, entry.name || entry.teamId, {
        allowAdmin: false,
        skipRefund: true
      });
      await tournamentService.updateTournament(tournamentId, (t) => {
        t.extra = t.extra || {};
        t.extra.finance = newFinance;
        t.finance = newFinance;
      });
    } else {
      const newEntries = entries.filter((e) => !isPlayerInEntry(e));
      await tournamentService.updateTournament(tournamentId, (t) => {
        t.registration = t.registration || {};
        t.registration.entries = newEntries;
        t.extra = t.extra || {};
        t.extra.finance = newFinance;
        t.finance = newFinance;
      });
    }
  } else if (inFreeAgents) {
    await tournamentService.withdrawFreeAgent(tournamentId, playerId);
  } else {
    throw new Error('Вы не участвуете в этом турнире');
  }

  return { refundDC: totalRefundDC, penaltyDC: (entry && entryFeeDC > 0) ? (entry.kind === 'solo' ? entryFeeDC - totalRefundDC : (entry.members || []).reduce((s, pid) => s + ((entry.memberPayments || {})[pid] || 0), 0) - totalRefundDC) : 0 };
}

/**
 * Create a payout batch for a DONE tournament: transfer % to final fund, build lines 50/35/15 (ready for admin to mark paid).
 * Zeros tournament pot so "Form payout" cannot be run again for same tournament.
 */
async function createPayoutBatch(tournamentId, tournamentService) {
  const tournament = await tournamentService.getTournamentById(tournamentId);
  if (!tournament) throw new Error('Турнир не найден');
  const state = tournament.state || '';
  if (state !== 'Турнир окончен' && state !== 'DONE') {
    throw new Error('Сформировать выплаты можно только для завершённого турнира');
  }
  const finance = tournament.finance || tournament.extra?.finance;
  const potDC = finance?.potDC ?? 0;
  if (potDC <= 0) throw new Error('Призовой фонд пуст');

  const batches = readPayoutBatches();
  if (batches.some((b) => b.tournamentId === tournamentId)) {
    throw new Error('Пакет выплат для этого турнира уже создан');
  }

  const table = await tournamentService.getTournamentTable(tournamentId);
  const teams = (table.teams || []).slice().sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const payoutMode = finance?.payoutMode || 'per_player';
  const split = finance?.payoutSplit || [50, 35, 15];
  const finalFundRate = finance?.finalFundRate ?? 0;
  const seasonId = resolveFinalFundSeasonId(tournament);
  const tournamentName = tournament.name || tournamentId;

  // finalFundRate снимается только при оплате взноса; при формировании выплат весь pot идёт в призы
  const transferToFinalDC = 0;
  const payoutTotalDC = potDC;

  const place1DC = Math.round(payoutTotalDC * (split[0] || 50) / 100);
  const place2DC = Math.round(payoutTotalDC * (split[1] || 35) / 100);
  const place3DC = payoutTotalDC - place1DC - place2DC;
  const amounts = [place1DC, place2DC, place3DC];

  const lines = [];
  for (let i = 0; i < 3 && i < teams.length; i++) {
    const team = teams[i];
    const amount = amounts[i];
    if (amount <= 0) continue;
    const players =
      team.players && team.players.length > 0
        ? team.players
        : tournament.type === 'solo' && team.name
          ? [team.name]
          : [];
    const lineId = generateId('line');
    const place = (i + 1);
    if (payoutMode === 'pay_captain' && players.length > 0) {
      const captainId = resolveTeamCaptainId(tournament, team, players);
      lines.push({
        lineId,
        place,
        recipientType: 'player',
        recipientId: captainId,
        recipientLabel: team.name || captainId,
        amountDC: amount,
        status: 'pending'
      });
    } else if (players.length > 0) {
      const perPlayerAmounts = splitAmountPerPlayer(amount, players.length);
      const breakdown = players.map((pid, idx) => ({
        playerId: pid,
        label: pid,
        amountDC: perPlayerAmounts[idx] ?? 0
      }));
      const payoutLineAmount = breakdown.reduce((sum, row) => sum + (row.amountDC || 0), 0);
      lines.push({
        lineId,
        place,
        recipientType: 'team',
        recipientId: team.name || `place_${place}`,
        recipientLabel: team.name || `Место ${place}`,
        amountDC: payoutLineAmount,
        status: 'pending',
        breakdown
      });
    }
  }

  const batchId = generateId('batch');
  const now = new Date().toISOString();
  const batch = {
    id: batchId,
    tournamentId,
    tournamentName,
    seasonId,
    createdAt: now,
    status: 'ready',
    finalFundRate,
    potDC,
    transferToFinalDC,
    payoutTotalDC,
    split: [split[0] || 50, split[1] || 35, split[2] || 15],
    payoutMode,
    lines
  };
  batches.push(batch);
  writePayoutBatches(batches);

  const payoutSummary = {
    createdAt: now,
    payoutBatchId: batchId,
    payoutTotalDC: batch.payoutTotalDC,
    lines: batch.lines.map((line) => ({
      lineId: line.lineId,
      place: line.place,
      recipientType: line.recipientType,
      recipientId: line.recipientId,
      recipientLabel: line.recipientLabel,
      amountDC: line.amountDC,
      breakdown: line.breakdown || null,
    })),
  };

  await tournamentService.updateTournament(tournamentId, (t) => {
    t.extra = t.extra || {};
    t.extra.finance = {
      ...(t.finance || t.extra.finance || {}),
      potDC: 0,
      payoutBatchId: batchId,
      payoutSummary,
    };
    t.finance = t.extra.finance;
  });

  return batch;
}

function getPayoutBatches(statusFilter) {
  const batches = readPayoutBatches();
  if (statusFilter) {
    return batches.filter((b) => b.status === statusFilter);
  }
  return batches;
}

function getPayoutBatchById(batchId) {
  const batches = readPayoutBatches();
  return batches.find((b) => b.id === batchId) || null;
}

function getPayoutBatchByTournamentId(tournamentId) {
  const batches = readPayoutBatches();
  return batches.find((b) => b.tournamentId === tournamentId) || null;
}

/**
 * Сводка для вкладки «Финансы» (тот же формат, что сохраняется в extra.finance при создании пакета).
 * @param {object} batch — запись из payout_batches.json
 */
function buildPayoutSummaryFromBatch(batch) {
  if (!batch) return null;
  const now = batch.createdAt || new Date().toISOString();
  const allPaid = (batch.lines || []).every((l) => l.status === 'paid');
  return {
    createdAt: now,
    payoutBatchId: batch.id,
    payoutTotalDC: batch.payoutTotalDC,
    status: batch.status,
    walletsCredited: allPaid,
    lines: (batch.lines || []).map((line) => ({
      lineId: line.lineId,
      place: line.place,
      recipientType: line.recipientType,
      recipientId: line.recipientId,
      recipientLabel: line.recipientLabel,
      amountDC: line.amountDC,
      status: line.status,
      breakdown: line.breakdown || null,
    })),
  };
}

/**
 * Обновить payoutSummary в турнире из актуального пакета выплат.
 */
async function syncPayoutSummaryToTournament(tournamentId, batch, tournamentService) {
  if (!batch || !tournamentService) return;
  const payoutSummary = buildPayoutSummaryFromBatch(batch);
  await tournamentService.updateTournament(tournamentId, (t) => {
    const fin = t.finance || t.extra?.finance || {};
    t.extra = t.extra || {};
    t.extra.finance = {
      ...fin,
      potDC: fin.potDC ?? 0,
      payoutBatchId: batch.id,
      payoutSummary,
    };
    t.finance = t.extra.finance;
  });
}

/**
 * Для API: если в турнире ещё нет payoutSummary, но есть пакет выплат — подставить из файла (старые турниры).
 */
function enrichTournamentWithPayoutSummary(tournament) {
  if (!tournament || !tournament.id) return tournament;
  const fin = tournament.finance || tournament.extra?.finance || {};
  if (fin.payoutSummary) return tournament;
  const batch = getPayoutBatchByTournamentId(tournament.id);
  if (!batch) return tournament;
  const payoutSummary = buildPayoutSummaryFromBatch(batch);
  const mergedFinance = {
    ...fin,
    payoutBatchId: fin.payoutBatchId || batch.id,
    payoutSummary,
  };
  return {
    ...tournament,
    finance: mergedFinance,
    extra: { ...(tournament.extra || {}), finance: mergedFinance },
  };
}

/**
 * Вычислить баланс по турниру из массива записей ledger (для тестов и реконсиляции).
 * @returns {{ entryTotal, refundTotal, potToFinalTotal, prizeTotal, ledgerBalance }}
 */
function computeReconcileFromLedger(ledgerEntries, tournamentId) {
  const key = `tournament:${tournamentId}`;
  let entryTotal = 0;
  let refundTotal = 0;
  let potToFinalTotal = 0;
  let prizeTotal = 0;
  for (const e of ledgerEntries) {
    if (e.status !== 'confirmed') continue;
    if (e.type === 'TOURNAMENT_ENTRY' && e.to === key) entryTotal += e.amountDC || 0;
    if (e.type === 'TOURNAMENT_REFUND' && e.from === key) refundTotal += e.amountDC || 0;
    if (e.type === 'POT_TO_FINAL_FUND' && e.from === key) potToFinalTotal += e.amountDC || 0;
    if (e.type === 'PRIZE_PAYOUT' && e.from === key) prizeTotal += e.amountDC || 0;
  }
  const ledgerBalance = entryTotal - refundTotal - potToFinalTotal - prizeTotal;
  return { entryTotal, refundTotal, potToFinalTotal, prizeTotal, ledgerBalance };
}

/**
 * Реконсиляция: сверка ledger с potDC по турниру.
 * Баланс по ledger = ENTRY (входящие) − REFUND − POT_TO_FINAL_FUND − PRIZE_PAYOUT.
 * Должен совпадать с сохранённым potDC.
 * @returns {{ entryTotal, refundTotal, potToFinalTotal, prizeTotal, ledgerBalance, storedPotDC, ok }}
 */
async function reconcileTournament(tournamentId, tournamentService) {
  const ledger = readLedger();
  const computed = computeReconcileFromLedger(ledger, tournamentId);
  const tournament = await tournamentService.getTournamentById(tournamentId);
  const finance = tournament?.finance || tournament?.extra?.finance;
  const storedPotDC = finance?.potDC ?? 0;
  const ok = computed.ledgerBalance === storedPotDC;
  return {
    ...computed,
    storedPotDC,
    ok
  };
}

function markPayoutLinePaid(batchId, lineId) {
  const batches = readPayoutBatches();
  const batchIdx = batches.findIndex((b) => b.id === batchId);
  if (batchIdx === -1) throw new Error('Пакет выплат не найден');
  const batch = batches[batchIdx];
  const lineIdx = batch.lines.findIndex((l) => l.lineId === lineId);
  if (lineIdx === -1) throw new Error('Строка выплаты не найдена');
  const line = batch.lines[lineIdx];
  if (line.status === 'paid') return batch;

  const now = new Date().toISOString();
  const meta = {
    tournamentId: batch.tournamentId,
    payoutBatchId: batch.id,
    place: line.place,
    tournamentName: batch.tournamentName
  };

  if (line.breakdown && line.breakdown.length > 0) {
    for (const row of line.breakdown) {
      appendLedger({
        type: 'PRIZE_PAYOUT',
        amountDC: row.amountDC,
        from: `tournament:${batch.tournamentId}`,
        to: `player:${row.playerId}`,
        status: 'confirmed',
        meta: { ...meta, playerId: row.playerId },
        createdAt: now,
        confirmedAt: now
      });
      recomputeWallet(row.playerId);
    }
  } else {
    appendLedger({
      type: 'PRIZE_PAYOUT',
      amountDC: line.amountDC,
      from: `tournament:${batch.tournamentId}`,
      to: `player:${line.recipientId}`,
      status: 'confirmed',
      meta: { ...meta, playerId: line.recipientId },
      createdAt: now,
      confirmedAt: now
    });
    recomputeWallet(line.recipientId);
  }

  batch.lines[lineIdx] = { ...line, status: 'paid' };
  writePayoutBatches(batches);
  return getPayoutBatchById(batchId);
}

function markPayoutBatchAllPaid(batchId) {
  const batch = getPayoutBatchById(batchId);
  if (!batch) throw new Error('Пакет выплат не найден');
  for (const line of batch.lines) {
    if (line.status === 'pending') {
      markPayoutLinePaid(batchId, line.lineId);
    }
  }
  const batches = readPayoutBatches();
  const idx = batches.findIndex((b) => b.id === batchId);
  if (idx !== -1) {
    batches[idx].status = 'paid';
    writePayoutBatches(batches);
    return batches[idx];
  }
  return getPayoutBatchById(batchId);
}

/**
 * Зачислить выплаты по пакету и обновить сводку в турнире (для ручных действий в Admin Finance).
 */
async function executePayoutBatch(batchId, tournamentService) {
  const existing = getPayoutBatchById(batchId);
  if (!existing) throw new Error('Пакет выплат не найден');
  const paidBatch = markPayoutBatchAllPaid(batchId);
  if (tournamentService && paidBatch?.tournamentId) {
    await syncPayoutSummaryToTournament(paidBatch.tournamentId, paidBatch, tournamentService);
  }
  return paidBatch;
}

/**
 * Сформировать пакет выплат и сразу зачислить DC на кошельки игроков (ledger PRIZE_PAYOUT).
 */
async function finalizePayout(tournamentId, tournamentService) {
  const batch = await createPayoutBatch(tournamentId, tournamentService);
  const paidBatch = markPayoutBatchAllPaid(batch.id);
  await syncPayoutSummaryToTournament(tournamentId, paidBatch, tournamentService);
  return {
    batch: paidBatch,
    potDC: paidBatch.potDC,
    transferToFinalDC: paidBatch.transferToFinalDC,
    payoutTotalDC: paidBatch.payoutTotalDC,
    walletsCredited: true,
  };
}

function createCashoutRequest(playerId, { amountDC, method, destination }) {
  if (!amountDC || amountDC < 1 || !Number.isInteger(amountDC)) {
    throw new Error('Сумма вывода должна быть целым числом больше 0');
  }
  const wallet = getWallet(playerId);
  if (wallet.availableDC < amountDC) {
    throw new Error(`Недостаточно DC. Доступно: ${wallet.availableDC}`);
  }
  const id = generateId('cashout');
  const cashouts = readCashouts();
  const now = new Date().toISOString();
  const normalizedMethod = (method === 'CARD' || (method && method.toUpperCase() === 'CARD'))
    ? 'CARD'
    : 'SBP_PHONE';
  const cashout = {
    id,
    playerId,
    amountDC,
    method: normalizedMethod,
    destination: destination || '',
    status: 'requested',
    createdAt: now,
    processedAt: null,
    adminNote: null
  };
  cashouts.push(cashout);
  writeJson(cashoutsPath, cashouts);
  recomputeWallet(playerId);
  return cashout;
}

function markCashoutPaid(cashoutId, adminNote) {
  const cashouts = readCashouts();
  const idx = cashouts.findIndex((c) => c.id === cashoutId);
  if (idx === -1) throw new Error('Заявка на вывод не найдена');
  const cashout = cashouts[idx];
  if (cashout.status !== 'requested' && cashout.status !== 'pending') {
    throw new Error(`Заявка уже обработана: ${cashout.status}`);
  }
  const now = new Date().toISOString();
  appendLedger({
    type: 'CASHOUT_PAID',
    amountDC: cashout.amountDC,
    from: `player:${cashout.playerId}`,
    to: TREASURY,
    status: 'confirmed',
    meta: { cashoutId, playerId: cashout.playerId },
    createdAt: now,
    confirmedAt: now
  });
  recomputeWallet(cashout.playerId);
  cashouts[idx] = {
    ...cashout,
    status: 'paid',
    processedAt: now,
    adminNote: adminNote || cashout.adminNote
  };
  writeJson(cashoutsPath, cashouts);
  return cashouts[idx];
}

function rejectCashout(cashoutId, adminNote) {
  const cashouts = readCashouts();
  const idx = cashouts.findIndex((c) => c.id === cashoutId);
  if (idx === -1) throw new Error('Заявка на вывод не найдена');
  const cashout = cashouts[idx];
  if (cashout.status !== 'requested' && cashout.status !== 'pending') {
    throw new Error(`Заявка уже обработана: ${cashout.status}`);
  }
  const now = new Date().toISOString();
  appendLedger({
    type: 'CASHOUT_REJECTED',
    amountDC: cashout.amountDC,
    from: `player:${cashout.playerId}`,
    to: TREASURY,
    status: 'rejected',
    meta: { cashoutId, playerId: cashout.playerId },
    createdAt: now,
    confirmedAt: now
  });
  cashouts[idx] = {
    ...cashout,
    status: 'rejected',
    processedAt: now,
    adminNote: adminNote || cashout.adminNote
  };
  writeJson(cashoutsPath, cashouts);
  recomputeWallet(cashout.playerId);
  return cashouts[idx];
}

/**
 * Refund all paid entries when tournament is cancelled. Call only for tournaments not yet LIVE/DONE.
 */
async function refundTournamentCancellation(tournamentId, tournamentService) {
  const tournament = await tournamentService.getTournamentById(tournamentId);
  if (!tournament) throw new Error('Турнир не найден');
  const state = tournament.state || '';
  if (state === 'В процессе' || state === 'Турнир окончен' || state === 'DONE') {
    throw new Error('Нельзя вернуть взносы: турнир уже начат или завершён');
  }
  const finance = tournament.finance || tournament.extra?.finance;
  const entryFeeDC = finance?.entryFeeDC ?? 0;
  const entries = tournament.registration?.entries || [];
  const tournamentName = tournament.name || tournamentId;
  const now = new Date().toISOString();
  let refundCount = 0;
  for (const entry of entries) {
    if (entry.kind === 'solo') {
      if (!entry.paidAt || entryFeeDC <= 0) continue;
      appendLedger({
        type: 'TOURNAMENT_REFUND',
        amountDC: entryFeeDC,
        from: `tournament:${tournamentId}`,
        to: `player:${entry.playerId}`,
        status: 'confirmed',
        meta: { tournamentId, tournamentName, playerId: entry.playerId, cancellation: true },
        createdAt: now,
        confirmedAt: now
      });
      recomputeWallet(entry.playerId);
      refundCount += 1;
    } else {
      const mp = entry.memberPayments && typeof entry.memberPayments === 'object' ? entry.memberPayments : {};
      const members = entry.members || (entry.captainId ? [entry.captainId] : []);
      for (const pid of members) {
        const amount = mp[pid] || 0;
        if (amount <= 0) continue;
        appendLedger({
          type: 'TOURNAMENT_REFUND',
          amountDC: amount,
          from: `tournament:${tournamentId}`,
          to: `player:${pid}`,
          status: 'confirmed',
          meta: { tournamentId, tournamentName, playerId: pid, cancellation: true },
          createdAt: now,
          confirmedAt: now
        });
        recomputeWallet(pid);
        refundCount += 1;
      }
    }
  }
  const newEntries = entries.map((e) => ({
    ...e,
    paidAt: null,
    allPaidAt: null,
    memberPayments: e.kind === 'team' ? {} : e.memberPayments
  }));
  await tournamentService.updateTournament(tournamentId, (t) => {
    t.state = 'Турнир отменен';
    t.registration = t.registration || {};
    t.registration.entries = newEntries;
    t.extra = t.extra || {};
    t.extra.finance = { ...(t.finance || t.extra.finance || {}), potDC: 0 };
    t.finance = t.extra.finance;
  });
  return { refunded: refundCount };
}

module.exports = {
  getWallet,
  getLedgerEntries,
  createTopupRequest,
  confirmTopup,
  rejectTopup,
  payEntry,
  payShare,
  leaveTournament,
  getRefundPercent,
  getRefundPercentByStartTime,
  refundEntryForRemoveTeam,
  refundTournamentCancellation,
  finalizePayout,
  createPayoutBatch,
  getPayoutBatches,
  getPayoutBatchById,
  getPayoutBatchByTournamentId,
  buildPayoutSummaryFromBatch,
  enrichTournamentWithPayoutSummary,
  markPayoutLinePaid,
  markPayoutBatchAllPaid,
  executePayoutBatch,
  syncPayoutSummaryToTournament,
  createCashoutRequest,
  markCashoutPaid,
  rejectCashout,
  appendLedger,
  recomputeWallet,
  readTopups,
  readCashouts,
  readLedger,
  readFinalFunds,
  transfer,
  reconcileTournament,
  computeReconcileFromLedger,
  splitAmountPerPlayer,
  getRegistrationDeadlineIso
};
