/**
 * Тесты банковской системы DC: реконсиляция, логика балансов по ledger.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FinanceService = require('../services/FinanceService');

const tournamentId = 'TestCup';
const key = `tournament:${tournamentId}`;

test('computeReconcileFromLedger: пустой ledger → баланс 0', () => {
  const result = FinanceService.computeReconcileFromLedger([], tournamentId);
  assert.equal(result.entryTotal, 0);
  assert.equal(result.refundTotal, 0);
  assert.equal(result.potToFinalTotal, 0);
  assert.equal(result.prizeTotal, 0);
  assert.equal(result.ledgerBalance, 0);
});

test('computeReconcileFromLedger: одна запись TOURNAMENT_ENTRY → ledgerBalance > 0', () => {
  const ledger = [
    { type: 'TOURNAMENT_ENTRY', to: key, amountDC: 100, status: 'confirmed' }
  ];
  const result = FinanceService.computeReconcileFromLedger(ledger, tournamentId);
  assert.equal(result.entryTotal, 100);
  assert.equal(result.refundTotal, 0);
  assert.equal(result.ledgerBalance, 100);
});

test('computeReconcileFromLedger: ENTRY и REFUND → баланс 0', () => {
  const ledger = [
    { type: 'TOURNAMENT_ENTRY', to: key, amountDC: 100, status: 'confirmed' },
    { type: 'TOURNAMENT_REFUND', from: key, amountDC: 100, status: 'confirmed' }
  ];
  const result = FinanceService.computeReconcileFromLedger(ledger, tournamentId);
  assert.equal(result.entryTotal, 100);
  assert.equal(result.refundTotal, 100);
  assert.equal(result.ledgerBalance, 0);
});

test('computeReconcileFromLedger: записи с другим турниром не учитываются', () => {
  const otherKey = 'tournament:OtherCup';
  const ledger = [
    { type: 'TOURNAMENT_ENTRY', to: key, amountDC: 50, status: 'confirmed' },
    { type: 'TOURNAMENT_ENTRY', to: otherKey, amountDC: 200, status: 'confirmed' }
  ];
  const result = FinanceService.computeReconcileFromLedger(ledger, tournamentId);
  assert.equal(result.entryTotal, 50);
  assert.equal(result.ledgerBalance, 50);
});

test('computeReconcileFromLedger: unconfirmed не учитываются', () => {
  const ledger = [
    { type: 'TOURNAMENT_ENTRY', to: key, amountDC: 100, status: 'pending' }
  ];
  const result = FinanceService.computeReconcileFromLedger(ledger, tournamentId);
  assert.equal(result.entryTotal, 0);
  assert.equal(result.ledgerBalance, 0);
});

test('computeReconcileFromLedger: полный цикл ENTRY − REFUND − PRIZE_PAYOUT', () => {
  const ledger = [
    { type: 'TOURNAMENT_ENTRY', to: key, amountDC: 300, status: 'confirmed' },
    { type: 'TOURNAMENT_REFUND', from: key, amountDC: 50, status: 'confirmed' },
    { type: 'PRIZE_PAYOUT', from: key, amountDC: 250, status: 'confirmed' }
  ];
  const result = FinanceService.computeReconcileFromLedger(ledger, tournamentId);
  assert.equal(result.entryTotal, 300);
  assert.equal(result.refundTotal, 50);
  assert.equal(result.prizeTotal, 250);
  assert.equal(result.ledgerBalance, 0);
});
