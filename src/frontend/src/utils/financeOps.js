/**
 * Unified mapping for finance operation types (ledger entries).
 * Backend types like TOPUP_CONFIRMED, TOURNAMENT_ENTRY etc. map to icon + label key.
 */
const TYPE_TO_KEY = {
  TOPUP_CONFIRMED: 'topup',
  TOPUP_REQUESTED: 'topup',
  TOPUP_REJECTED: 'topup',
  CASHOUT_PAID: 'cashout',
  CASHOUT_REJECTED: 'cashout',
  TOURNAMENT_ENTRY: 'entry',
  TOURNAMENT_REFUND: 'refund',
  TOURNAMENT_PENALTY: 'adjustment',
  PRIZE_PAYOUT: 'prize',
  FINAL_FUND: 'finalFund',
  PLAYER_TRANSFER: 'transfer',
};

const OP_META = {
  topup: { icon: '+', labelKey: 'finance.ledgerTopupConfirmed' },
  cashout: { icon: '↗', labelKey: 'finance.ledgerCashout' },
  entry: { icon: '🎫', labelKey: 'finance.ledgerEntry' },
  refund: { icon: '↩', labelKey: 'finance.ledgerRefund' },
  prize: { icon: '🏆', labelKey: 'finance.ledgerPrize' },
  finalFund: { icon: '🏦', labelKey: 'finance.ledgerFinalFund' },
  adjustment: { icon: '✎', labelKey: 'finance.ledgerPenalty' },
  transfer: { icon: '⇄', labelKey: 'finance.ledgerTransfer' },
};

export function getOpIcon(type) {
  const key = TYPE_TO_KEY[type] || (type && type.startsWith('TOPUP') ? 'topup' : type && type.startsWith('CASHOUT') ? 'cashout' : null);
  if (!key) return '•';
  return OP_META[key]?.icon ?? '•';
}

export function getOpLabelKey(type) {
  if (type === 'TOPUP_REQUESTED') return 'finance.ledgerTopupRequested';
  if (type === 'TOPUP_REJECTED') return 'finance.ledgerTopupRejected';
  if (type === 'CASHOUT_REJECTED') return 'finance.ledgerCashoutRejected';
  const key = TYPE_TO_KEY[type];
  return OP_META[key]?.labelKey ?? type;
}

export function getOpDisplay(t, type) {
  const labelKey = getOpLabelKey(type);
  const label = t(labelKey);
  return label && label !== labelKey ? label : type;
}
