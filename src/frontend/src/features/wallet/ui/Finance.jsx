import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useWallet } from '@/contexts/WalletContext';
import { financeApi } from '@/services/api';
import { useTranslation } from '@/contexts/LanguageContext';
import { getOpIcon, getOpDisplay } from '@/entities/finance';
import './Finance.css';

const TAB_HISTORY = 'history';
const TAB_TOPUPS = 'topups';
const TAB_CASHOUTS = 'cashouts';

const QUICK_AMOUNTS = [100, 500, 1000];
const TOPUP_CHIPS = [100, 200, 500, 1000];
const CASHOUT_CHIPS = [100, 500];
const MIN_TOPUP = 10;
const MAX_TOPUP = 100000;

const PHONE_PREFIX = '+7 ';
const PHONE_LENGTH = 10;

function Finance() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { wallet, refetch: refetchWallet } = useWallet();
  const [ledger, setLedger] = useState([]);
  const [topups, setTopups] = useState([]);
  const [cashouts, setCashouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(TAB_HISTORY);
  const [modalTopup, setModalTopup] = useState(false);
  const [modalCashout, setModalCashout] = useState(false);
  const [topupStep, setTopupStep] = useState(1);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupResult, setTopupResult] = useState(null);
  const [cashoutStep, setCashoutStep] = useState(1);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutMethod, setCashoutMethod] = useState('SBP_PHONE');
  const [cashoutDestination, setCashoutDestination] = useState('');
  const [cashoutReservedAmount, setCashoutReservedAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ledgerDetailId, setLedgerDetailId] = useState(null);
  const [modalTransfer, setModalTransfer] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setError(null);
    try {
      const [l, tu, ca] = await Promise.all([
        financeApi.getLedger(50),
        financeApi.getMyTopups(),
        financeApi.getMyCashouts()
      ]);
      refetchWallet();
      setLedger(Array.isArray(l) ? l : []);
      setTopups(Array.isArray(tu) ? tu : []);
      setCashouts(Array.isArray(ca) ? ca : []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, refetchWallet]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    load();
  }, [isAuthenticated, navigate, load]);

  const openTopupWithAmount = (amount) => {
    setTopupResult(null);
    setTopupStep(1);
    setTopupAmount(amount ? String(amount) : '');
    setModalTopup(true);
  };

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    const amount = Math.floor(Number(topupAmount));
    if (!amount || amount < MIN_TOPUP) {
      setError(t('finance.topupMin', { min: MIN_TOPUP }) || `Минимум ${MIN_TOPUP} DC`);
      return;
    }
    if (amount > MAX_TOPUP) {
      setError(t('finance.topupMax', { max: MAX_TOPUP }) || `Максимум ${MAX_TOPUP} DC`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await financeApi.createTopup(amount);
      setTopupResult(result);
      setTopupStep(2);
      load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Ошибка создания заявки');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCashoutSubmit = async (e) => {
    e.preventDefault();
    const amount = Math.floor(Number(cashoutAmount));
    const available = wallet?.availableDC ?? 0;
    if (!amount || amount < 1) {
      setError(t('finance.amountRequired') || 'Введите сумму');
      return;
    }
    if (amount > available) {
      setError(t('finance.availableOnly', { count: available }) || `Доступно только ${available} DC`);
      return;
    }
    const dest = cashoutMethod === 'SBP_PHONE'
      ? (cashoutDestination.replace(/\D/g, '').length >= 10 ? `+7${cashoutDestination.replace(/\D/g, '')}` : '')
      : cashoutDestination.trim();
    if (!dest) {
      setError(cashoutMethod === 'SBP_PHONE' ? (t('finance.phoneOrCard') + ' (10 цифр)') : t('finance.cardMask'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await financeApi.createCashout({
        amountDC: amount,
        method: cashoutMethod,
        destination: dest
      });
      setCashoutStep(2);
      setCashoutReservedAmount(amount);
      load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Ошибка создания заявки');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = (text) => {
    navigator.clipboard?.writeText(text).then(() => {});
  };

  const formatPhoneDisplay = (digits) => {
    if (!digits) return '';
    const d = digits.replace(/\D/g, '').slice(0, PHONE_LENGTH);
    if (d.length <= 3) return PHONE_PREFIX + (d ? `(${d}` : '');
    if (d.length <= 6) return PHONE_PREFIX + `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return PHONE_PREFIX + `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
  };

  const parsePhoneInput = (raw) => raw.replace(/\D/g, '').slice(0, PHONE_LENGTH);

  const handlePhoneChange = (e) => {
    const digits = parsePhoneInput(e.target.value);
    setCashoutDestination(digits);
  };

  const formatDate = (str) => {
    if (!str) return '—';
    try {
      return new Date(str).toLocaleString('ru-RU');
    } catch (_) {
      return str;
    }
  };

  const maskDestination = (method, dest) => {
    if (!dest) return '—';
    if (method === 'CARD') return dest.replace(/\d(?=\d{4})/g, '*').slice(-4).padStart(4, '*');
    return dest.slice(0, 4) + '***' + dest.slice(-2);
  };

  const statusLabel = (status) => {
    if (status === 'confirmed' || status === 'paid') return t('finance.statusConfirmed') || 'Подтверждено';
    if (status === 'rejected') return t('finance.statusRejected') || 'Отклонено';
    return t('finance.statusPending') || 'Ожидание';
  };

  const ledgerSubtitle = (e) => {
    const meta = e.meta || {};
    if (e.type === 'PRIZE_PAYOUT' && meta.place) {
      const pct = { 1: '50%', 2: '35%', 3: '15%' }[meta.place] || '';
      return pct ? t('finance.placePct', { place: meta.place, pct }) || `Место ${meta.place} — ${pct}%` : (meta.tournamentName ? `Турнир: ${meta.tournamentName}` : null);
    }
    if (meta.tournamentName) return t('finance.tournamentName', { name: meta.tournamentName }) || `Турнир: ${meta.tournamentName}`;
    if (meta.referenceCode) return `${t('finance.copyCode')}: ${meta.referenceCode}`;
    return null;
  };

  const seasonSummary = useMemo(() => {
    const year = new Date().getFullYear();
    let prizes = 0;
    let entries = 0;
    for (const e of ledger) {
      const date = e.createdAt ? new Date(e.createdAt).getFullYear() : year;
      if (date !== year) continue;
      const amt = e.amountDC || 0;
      const isIn = e.to && e.to.includes('player:');
      if (e.type === 'PRIZE_PAYOUT' && isIn) prizes += amt;
      if ((e.type === 'TOURNAMENT_ENTRY' || e.type === 'TOURNAMENT_PENALTY') && !isIn) entries += amt;
    }
    return { prizes, entries };
  }, [ledger]);

  const ledgerDetailEntry = ledgerDetailId ? ledger.find((e) => e.id === ledgerDetailId) : null;

  if (!isAuthenticated) return null;
  if (loading && !wallet) {
    return (
      <>
        <div className="finance-page">
          <p className="muted">Загрузка…</p>
        </div>
      </>
    );
  }

  const available = wallet?.availableDC ?? 0;
  const reserved = wallet?.reservedDC ?? 0;
  const total = wallet?.balanceDC ?? 0;

  const openCashoutModal = () => {
    setCashoutStep(1);
    setCashoutAmount('');
    setCashoutDestination('');
    setCashoutReservedAmount(0);
    setModalCashout(true);
  };

  const handleCashoutMethodChange = (method) => {
    setCashoutMethod(method);
    setCashoutDestination('');
  };

  const openTransferModal = () => {
    setError(null);
    setTransferTo('');
    setTransferAmount('');
    setModalTransfer(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Нужно войти, чтобы переводить DC');
      return;
    }
    const to = (transferTo || '').trim();
    if (!to) {
      setError(t('finance.transferTo') || 'Укажите получателя');
      return;
    }
    const fromId = user.pubgNick || user.username;
    if (to === fromId) {
      setError('Нельзя переводить DC самому себе');
      return;
    }
    const amount = Math.floor(Number(transferAmount));
    const available = wallet?.availableDC ?? 0;
    if (!amount || amount < 1) {
      setError(t('finance.amountRequired') || 'Введите сумму');
      return;
    }
    if (amount > available) {
      setError(t('finance.availableOnly', { count: available }) || `Доступно только ${available} DC`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await financeApi.transfer({ toPlayerId: to, amountDC: amount });
      setModalTransfer(false);
      setTransferTo('');
      setTransferAmount('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Ошибка перевода');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="finance-page">
        <div className="finance-wallet-card">
          <div className="finance-wallet-main">
            <div className="finance-wallet-value-wrap">
              <span className="finance-wallet-value tabular-nums">{available}</span>
              <span className="finance-wallet-value-unit">DC</span>
            </div>
            <div className="finance-wallet-meta finance-wallet-meta--compact">
              <span>{t('finance.reservedDC')}: <span className="tabular-nums">{reserved}</span></span>
              <span>{t('finance.totalDC')}: <span className="tabular-nums">{total}</span></span>
            </div>
          </div>
          <div className="finance-wallet-chips">
            {QUICK_AMOUNTS.map((a) => (
              <button key={a} type="button" className="finance-chip" onClick={() => openTopupWithAmount(a)}>+{a}</button>
            ))}
          </div>
          <div className="finance-wallet-actions">
            <button type="button" className="btn btn-primary finance-btn-equal" onClick={() => openTopupWithAmount()}>{t('finance.topup')}</button>
            <button type="button" className="btn btn-secondary finance-btn-equal" onClick={openCashoutModal}>{t('finance.cashout')}</button>
            <button type="button" className="btn btn-secondary finance-btn-equal" onClick={openTransferModal}>{t('finance.transfer')}</button>
          </div>
          {(seasonSummary.prizes > 0 || seasonSummary.entries > 0) && (
            <div className="finance-season-summary">
              {seasonSummary.prizes > 0 && <span>{t('finance.seasonPrizes')}: +{seasonSummary.prizes} DC</span>}
              {seasonSummary.entries > 0 && <span>{t('finance.seasonEntries')}: −{seasonSummary.entries} DC</span>}
            </div>
          )}
        </div>

        {error && <div className="finance-error">{error}</div>}

        <div className="finance-tabs-wrap">
          <div className="finance-tabs">
            <button type="button" className={activeTab === TAB_HISTORY ? 'active' : ''} onClick={() => setActiveTab(TAB_HISTORY)}>{t('finance.tabHistory')}</button>
            <button type="button" className={activeTab === TAB_TOPUPS ? 'active' : ''} onClick={() => setActiveTab(TAB_TOPUPS)}>{t('finance.tabTopups')}</button>
            <button type="button" className={activeTab === TAB_CASHOUTS ? 'active' : ''} onClick={() => setActiveTab(TAB_CASHOUTS)}>{t('finance.tabCashouts')}</button>
          </div>

          <div className="finance-tab-content">
            {activeTab === TAB_HISTORY && (
              <ul className="finance-timeline">
                {ledger.length === 0 && <li className="finance-empty">{t('finance.noOperations') || 'Пока нет операций'}</li>}
                {ledger.map((e) => {
                  const isIn = e.to && e.to.includes('player:');
                  const amount = e.amountDC || 0;
                  const status = e.status || 'confirmed';
                  const meta = e.meta || {};
                  const subtitle = ledgerSubtitle(e);
                  return (
                    <li key={e.id} className="finance-timeline-item" onClick={() => setLedgerDetailId(e.id)}>
                      <span className="finance-timeline-icon" aria-hidden>{getOpIcon(e.type)}</span>
                      <div className="finance-timeline-body">
                        <span className="finance-timeline-title">{getOpDisplay(t, e.type)}</span>
                        {subtitle && meta.tournamentId ? (
                          <Link to={`/tournament/${meta.tournamentId}`} className="finance-timeline-subtitle finance-timeline-subtitle-link" onClick={(ev) => ev.stopPropagation()}>{subtitle}</Link>
                        ) : subtitle ? (
                          <span className="finance-timeline-subtitle">{subtitle}</span>
                        ) : null}
                        <span className="finance-timeline-date muted">{formatDate(e.createdAt)}</span>
                      </div>
                      <div className="finance-timeline-right">
                        <span className={`finance-timeline-amount ${isIn ? 'positive' : 'negative'} tabular-nums`}>{isIn ? '+' : '−'}{amount} DC</span>
                        <span className={`finance-pill finance-pill--${status}`}>{statusLabel(status)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {activeTab === TAB_TOPUPS && (
              <ul className="finance-request-list">
                {topups.length === 0 && <li className="finance-empty">{t('finance.noTopups') || 'Заявок на пополнение нет'}</li>}
                {topups.map((topup) => (
                  <li key={topup.id} className="finance-request-card">
                    <span className="finance-request-icon" aria-hidden>+</span>
                    <div className="finance-request-body">
                      <div className="finance-request-row">
                        <span className="finance-request-amount tabular-nums">{topup.amountDC} DC</span>
                        <span className="finance-request-code"><code>{topup.referenceCode}</code></span>
                        <button type="button" className="finance-copy-btn" onClick={(ev) => { ev.stopPropagation(); copyCode(topup.referenceCode); }} aria-label={t('finance.copyCode')}>{t('finance.copyCode')}</button>
                        <span className={`finance-pill finance-pill--${topup.status}`}>{statusLabel(topup.status)}</span>
                        <span className="muted small">{formatDate(topup.createdAt)}</span>
                      </div>
                      <p className="finance-request-hint muted small">
                        {topup.status === 'pending' || topup.status === 'requested' ? t('finance.awaitingConfirm') : topup.status === 'rejected' ? (topup.adminNote ? `${t('finance.statusRejected')} (${topup.adminNote})` : t('finance.statusRejected')) : null}
                      </p>
                    </div>
                    <div className="finance-request-right" />
                  </li>
                ))}
              </ul>
            )}
            {activeTab === TAB_CASHOUTS && (
              <ul className="finance-request-list">
                {cashouts.length === 0 && <li className="finance-empty">{t('finance.noCashouts') || 'Заявок на вывод нет'}</li>}
                {cashouts.map((c) => (
                  <li key={c.id} className="finance-request-card">
                    <span className="finance-request-icon" aria-hidden>↗</span>
                    <div className="finance-request-body">
                      <div className="finance-request-row">
                        <span className="finance-request-amount tabular-nums">{c.amountDC} DC</span>
                        <span className={`finance-pill finance-pill--method`}>{c.method === 'CARD' ? t('finance.card') : t('finance.sbp')}</span>
                        <span className="finance-request-method">{maskDestination(c.method, c.destination)}</span>
                        <span className={`finance-pill finance-pill--${c.status}`}>{statusLabel(c.status)}</span>
                        {c.status === 'requested' && <span className="finance-reserved-badge">{t('finance.reservedDC')}</span>}
                        <span className="muted small">{formatDate(c.createdAt)}</span>
                      </div>
                    </div>
                    <div className="finance-request-right" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Ledger detail drawer */}
      {ledgerDetailEntry && (
        <div className="finance-drawer-overlay" onClick={() => setLedgerDetailId(null)}>
          <div className="finance-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="finance-drawer-header">
              <h3>{getOpDisplay(t, ledgerDetailEntry.type)}</h3>
              <button type="button" className="finance-drawer-close" onClick={() => setLedgerDetailId(null)} aria-label={t('common.close')}>×</button>
            </div>
            <div className="finance-drawer-body">
              {ledgerDetailEntry.meta?.referenceCode && (
                <p><span className="muted">Код:</span> {ledgerDetailEntry.meta.referenceCode}</p>
              )}
              {ledgerDetailEntry.meta?.method && (
                <p><span className="muted">Способ:</span> {ledgerDetailEntry.meta.method === 'CARD' ? t('finance.card') : t('finance.sbp')}</p>
              )}
              {ledgerDetailEntry.meta?.destination && (
                <p><span className="muted">Получатель:</span> {maskDestination(ledgerDetailEntry.meta.method, ledgerDetailEntry.meta.destination)}</p>
              )}
              {ledgerDetailEntry.meta?.note && <p><span className="muted">Примечание:</span> {ledgerDetailEntry.meta.note}</p>}
              {ledgerDetailEntry.meta?.payoutBatchId && <p><span className="muted">Пакет выплат:</span> {ledgerDetailEntry.meta.payoutBatchId}</p>}
              {ledgerDetailEntry.meta?.tournamentId && (
                <p>
                  <Link to={`/tournament/${ledgerDetailEntry.meta.tournamentId}`} className="finance-drawer-link">{t('finance.detailsLink')}</Link>
                </p>
              )}
              <p className="muted small">{formatDate(ledgerDetailEntry.createdAt)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Topup modal — 2 steps */}
      {modalTopup && (
        <div className="finance-modal-overlay" onClick={() => !submitting && (topupStep === 2 ? (setModalTopup(false), setTopupResult(null), setTopupAmount('')) : setModalTopup(false))}>
          <div className="finance-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('finance.topup')}</h3>
            {topupStep === 1 ? (
              <form onSubmit={handleTopupSubmit}>
                <p className="finance-modal-hint muted small">{t('finance.topupHint')}</p>
                <div className="finance-modal-chips">
                  {TOPUP_CHIPS.map((a) => (
                    <button key={a} type="button" className="finance-modal-chip" onClick={() => setTopupAmount(String(a))}>{a}</button>
                  ))}
                </div>
                <div className="form-group">
                  <label>{t('finance.amountDC')}</label>
                  <input
                    type="number"
                    min={MIN_TOPUP}
                    max={MAX_TOPUP}
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="100"
                  />
                  <p className="finance-field-hint">{t('finance.topupMin', { min: MIN_TOPUP })} — {t('finance.topupMax', { max: MAX_TOPUP })}</p>
                </div>
                <div className="finance-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalTopup(false)}>{t('finance.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('finance.creating') : t('finance.createRequest')}</button>
                </div>
              </form>
            ) : (
              <div className="finance-topup-result finance-modal-success">
                <p className="finance-modal-success-title">{t('finance.requestCreated')}</p>
                <p className="finance-modal-success-detail">{t('finance.topupTransfer', { amount: topupResult?.amountDC, code: topupResult?.referenceCode })}</p>
                {topupResult?.instructions && topupResult.instructions.trim() && (
                  <pre className="finance-instructions">{topupResult.instructions}</pre>
                )}
                <p className="finance-modal-success-detail"><strong>{t('finance.copyCode')}: {topupResult?.referenceCode}</strong></p>
                <button type="button" className="btn btn-secondary" onClick={() => copyCode(topupResult?.referenceCode)}>{t('finance.copyCode')}</button>
                <p className="muted small">{t('finance.awaitingConfirm')}</p>
                <button type="button" className="btn btn-primary" onClick={() => { setModalTopup(false); setTopupResult(null); setTopupAmount(''); }}>{t('finance.gotIt')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cashout modal — 2 steps */}
      {modalCashout && (
        <div className="finance-modal-overlay" onClick={() => cashoutStep === 2 && setModalCashout(false)}>
          <div className="finance-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('finance.cashout')}</h3>
            {cashoutStep === 1 ? (
              <form onSubmit={handleCashoutSubmit}>
                <p className="finance-modal-hint muted small">{t('finance.available')}: {available} DC</p>
                <div className="form-group">
                  <label>{t('finance.amountDC')}</label>
                  <div className="finance-modal-chips">
                    {CASHOUT_CHIPS.map((a) => (
                      <button key={a} type="button" className="finance-modal-chip" onClick={() => setCashoutAmount(String(a))}>{a}</button>
                    ))}
                    <button type="button" className="finance-modal-chip" onClick={() => setCashoutAmount(String(available))}>{t('finance.cashoutChipAll')}</button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={available}
                    value={cashoutAmount}
                    onChange={(e) => setCashoutAmount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="finance-field-hint">{t('finance.available')}: {available} DC</p>
                </div>
                <div className="form-group">
                  <label>{t('finance.method')}</label>
                  <select value={cashoutMethod} onChange={(e) => handleCashoutMethodChange(e.target.value)}>
                    <option value="SBP_PHONE">{t('finance.sbp')}</option>
                    <option value="CARD">{t('finance.card')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{cashoutMethod === 'SBP_PHONE' ? t('finance.phoneOrCard') : t('finance.cardMask')}</label>
                  {cashoutMethod === 'SBP_PHONE' ? (
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={formatPhoneDisplay(cashoutDestination)}
                      onChange={handlePhoneChange}
                      placeholder="+7 (___) ___-__-__"
                    />
                  ) : (
                    <input type="text" value={cashoutDestination} onChange={(e) => setCashoutDestination(e.target.value)} placeholder="XXXX XXXX XXXX XXXX" />
                  )}
                </div>
                <div className="finance-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalCashout(false)}>{t('finance.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('finance.creating') : t('finance.createRequest')}</button>
                </div>
              </form>
            ) : (
              <div className="finance-cashout-result finance-modal-success">
                <p className="finance-modal-success-title">{t('finance.requestCreated')}</p>
                <p className="finance-modal-success-detail">{t('finance.cashoutReserved')}: <strong className="tabular-nums">{cashoutReservedAmount} DC</strong></p>
                <p className="muted small">{t('finance.cashoutAwait')}</p>
                <button type="button" className="btn btn-primary" onClick={() => { setModalCashout(false); setCashoutAmount(''); setCashoutDestination(''); setCashoutReservedAmount(0); }}>{t('finance.gotIt')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {modalTransfer && (
        <div className="finance-modal-overlay" onClick={() => !submitting && setModalTransfer(false)}>
          <div className="finance-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('finance.transfer')}</h3>
            <form onSubmit={handleTransferSubmit}>
              <p className="finance-modal-hint muted small">{t('finance.transferHint')}</p>
              <div className="form-group">
                <label>{t('finance.transferTo')}</label>
                <input
                  type="text"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder={user?.pubgNick || user?.username || 'player123'}
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>{t('finance.transferAmount')}</label>
                <input
                  type="number"
                  min="1"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0"
                />
                <p className="finance-field-hint">{t('finance.available')}: {available} DC</p>
              </div>
              <div className="finance-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalTransfer(false)}
                >
                  {t('finance.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? t('finance.creating') : t('finance.transfer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Finance;
