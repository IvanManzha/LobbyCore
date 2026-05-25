/**
 * finalizePayout: пакет + зачисление DC на кошельки.
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
  fs.writeFileSync(path.join(tmpDir, 'payout_batches.json'), '[]');
  delete require.cache[require.resolve('../config/dataPaths')];
  delete require.cache[require.resolve('../services/FinanceService')];
  return require('../services/FinanceService');
}

test('finalizePayout зачисляет DC победителям', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-finalize-'));
  const FinanceService = loadFinanceService(tmpDir);
  const tournamentId = `fin_${Date.now()}`;
  const winner = 'WinnerOne';

  const mockTournamentService = {
    async getTournamentById() {
      return {
        id: tournamentId,
        name: 'Finalize Test',
        state: 'Турнир окончен',
        type: 'solo',
        finance: { potDC: 100, payoutMode: 'per_player', payoutSplit: [100, 0, 0] },
        registration: { entries: [] },
      };
    },
    async getTournamentTable() {
      return {
        teams: [{ name: winner, players: [winner], rank: 1, results: [] }],
      };
    },
    async updateTournament(_id, fn) {
      const t = await this.getTournamentById();
      fn(t);
    },
  };

  const result = await FinanceService.finalizePayout(tournamentId, mockTournamentService);
  assert.equal(result.walletsCredited, true);
  assert.equal(result.batch.status, 'paid');

  const wallet = FinanceService.getWallet(winner);
  assert.equal(wallet.balanceDC, 100);

  const ledger = FinanceService.readLedger();
  assert.equal(ledger.filter((e) => e.type === 'PRIZE_PAYOUT').length, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
