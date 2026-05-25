/**
 * Распределение призов: splitAmountPerPlayer и createPayoutBatch (без превышения pot).
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

const FinanceServiceCore = require('../services/FinanceService');

test('splitAmountPerPlayer: сумма равна total', () => {
  const amounts = FinanceServiceCore.splitAmountPerPlayer(100, 3);
  assert.equal(amounts.length, 3);
  assert.equal(amounts.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(amounts.sort((a, b) => a - b), [33, 33, 34]);
});

test('splitAmountPerPlayer: один игрок получает всё', () => {
  assert.deepEqual(FinanceServiceCore.splitAmountPerPlayer(57, 1), [57]);
});

test('createPayoutBatch: per_player не превышает долю места', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-payout-'));
  const FinanceService = loadFinanceService(tmpDir);

  const tournamentId = `payout_test_${Date.now()}`;
  const teams = [
    { name: 'A', players: ['p1', 'p2', 'p3'], rank: 1, results: [] },
    { name: 'B', players: ['p4', 'p5', 'p6'], rank: 2, results: [] }
  ];

  const mockTournamentService = {
    async getTournamentById() {
      return {
        id: tournamentId,
        name: 'Payout Test',
        state: 'Турнир окончен',
        type: 'squad',
        finance: {
          potDC: 100,
          payoutMode: 'per_player',
          payoutSplit: [50, 35, 15]
        },
        registration: { entries: [] }
      };
    },
    async getTournamentTable() {
      return { teams };
    },
    async updateTournament(id, fn) {
      const t = await this.getTournamentById(id);
      fn(t);
    }
  };

  const batch = await FinanceService.createPayoutBatch(tournamentId, mockTournamentService);
  const place1Line = batch.lines.find((l) => l.place === 1);
  assert.ok(place1Line);
  assert.equal(place1Line.amountDC, 50);
  const breakdownSum = place1Line.breakdown.reduce((s, r) => s + r.amountDC, 0);
  assert.equal(breakdownSum, 50);

  const totalLines = batch.lines.reduce((s, l) => s + (l.amountDC || 0), 0);
  assert.ok(totalLines <= batch.potDC);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
