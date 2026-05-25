/**
 * Выход команды из турнира: один рефанд по политике, без повторного 100% из removeTeam.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

function loadFinanceService(tmpDir) {
  process.env.DATA_DIR = tmpDir;
  fs.writeFileSync(path.join(tmpDir, 'ledger.json'), '[]');
  fs.writeFileSync(path.join(tmpDir, 'wallets.json'), '{}');
  delete require.cache[require.resolve('../config/dataPaths')];
  delete require.cache[require.resolve('../services/FinanceService')];
  return require('../services/FinanceService');
}

test('leaveTournament team: один TOURNAMENT_REFUND на игрока при 100% политике', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-leave-'));
  const FinanceService = loadFinanceService(tmpDir);

  const tournamentId = 'leave_team_cup';
  const entry = {
    kind: 'team',
    name: 'Alpha',
    captainId: 'cap1',
    members: ['cap1', 'm2'],
    memberPayments: { cap1: 100, m2: 100 },
    status: 'confirmed'
  };

  let tournamentState = {
    id: tournamentId,
    name: 'Leave Team Cup',
    state: 'Запланирован',
    startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    finance: { entryFeeDC: 100, potDC: 200 },
    registration: { entries: [entry] }
  };

  const mockTournamentService = {
    async getTournamentById() {
      return { ...tournamentState };
    },
    async removeTeam(_id, _name, options = {}) {
      assert.equal(options.skipRefund, true, 'removeTeam must skip refund on leave');
      tournamentState = {
        ...tournamentState,
        registration: { entries: [] }
      };
      return tournamentState;
    },
    async updateTournament(_id, fn) {
      fn(tournamentState);
    }
  };

  await FinanceService.leaveTournament('cap1', tournamentId, mockTournamentService);

  const ledger = FinanceService.readLedger();
  const refunds = ledger.filter((e) => e.type === 'TOURNAMENT_REFUND');
  assert.equal(refunds.length, 2);
  assert.equal(refunds.find((e) => e.to === 'player:cap1')?.amountDC, 100);
  assert.equal(refunds.find((e) => e.to === 'player:m2')?.amountDC, 100);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
