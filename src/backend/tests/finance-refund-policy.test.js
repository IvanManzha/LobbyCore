const test = require('node:test');
const assert = require('node:assert/strict');
const FinanceService = require('../services/FinanceService');

test('withdrawalPolicy из finance турнира', () => {
  const start = new Date(Date.now() + 10 * 60 * 60 * 1000);
  const tournament = {
    startAt: start.toISOString(),
    finance: {
      withdrawalPolicy: [
        { hoursBeforeStart: 8, refundPercent: 100 },
        { hoursBeforeStart: 0, refundPercent: 25 }
      ]
    }
  };
  assert.equal(FinanceService.getRefundPercentByStartTime(tournament), 100);

  const soon = new Date(Date.now() + 1 * 60 * 60 * 1000);
  const t2 = {
    startAt: soon.toISOString(),
    finance: tournament.finance
  };
  assert.equal(FinanceService.getRefundPercentByStartTime(t2), 25);
});
