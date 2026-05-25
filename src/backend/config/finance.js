/**
 * Finance (DropCoins) server config: payment details for topups.
 * Only used server-side; instructions returned via API after creating topup.
 */
const bankName = process.env.FINANCE_BANK_NAME || '';
const cardMask = process.env.FINANCE_CARD_MASK || '';
const sbpPhone = process.env.FINANCE_SBP_PHONE || '';
const ownerName = process.env.FINANCE_OWNER_NAME || '';
const qrUrl = process.env.FINANCE_QR_URL || null;

/** Реквизиты для перевода (без дублирования фразы «переведите N ₽…» — её показывает фронт один раз). */
function getTopupInstructions(amountDC, referenceCode) {
  const lines = [];
  if (ownerName) lines.push(`Получатель: ${ownerName}`);
  if (bankName) lines.push(`Банк: ${bankName}`);
  if (cardMask) lines.push(`Карта: ${cardMask}`);
  if (sbpPhone) lines.push(`СБП: ${sbpPhone}`);
  return lines.join('\n');
}

function getRequisites() {
  return {
    bankName: bankName || null,
    cardMask: cardMask || null,
    sbpPhone: sbpPhone || null,
    ownerName: ownerName || null,
    qrUrl: qrUrl || null
  };
}

module.exports = {
  getTopupInstructions,
  getRequisites
};
