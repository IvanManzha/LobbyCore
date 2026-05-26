import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import './DcBalance.css';

/**
 * Wallet chip в шапке: «💠 {balance} DC», клик → /finance.
 */
function DcBalance() {
  const { t } = useTranslation();
  const { wallet } = useWallet();
  const balance = wallet?.availableDC ?? 0;

  return (
    <Link
      to="/finance"
      className="dc-balance"
      aria-label={t('finance.dcAria')}
    >
      <span className="dc-balance-icon" aria-hidden>💠</span>
      <span className="dc-balance-num">{balance}</span>
      <span className="dc-balance-unit">DC</span>
    </Link>
  );
}

export default memo(DcBalance);
