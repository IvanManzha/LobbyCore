/**
 * Базовые проверки политики возвратов: getRefundPercentByStartTime
 * (>4 ч до старта => 100%, иначе 50%).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FinanceService = require('../services/FinanceService');

test('getRefundPercentByStartTime: более 4 часов до старта => 100', () => {
  const start = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const tournament = { startAt: start.toISOString() };
  assert.equal(FinanceService.getRefundPercentByStartTime(tournament), 100);
});

test('getRefundPercentByStartTime: ровно 4 часа до старта => 50', () => {
  const start = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const tournament = { startAt: start.toISOString() };
  assert.equal(FinanceService.getRefundPercentByStartTime(tournament), 50);
});

test('getRefundPercentByStartTime: менее 4 часов до старта => 50', () => {
  const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const tournament = { startAt: start.toISOString() };
  assert.equal(FinanceService.getRefundPercentByStartTime(tournament), 50);
});

test('getRefundPercentByStartTime: без startAt => 0', () => {
  assert.equal(FinanceService.getRefundPercentByStartTime({}), 0);
  assert.equal(FinanceService.getRefundPercentByStartTime({ date: null }), 0);
});
