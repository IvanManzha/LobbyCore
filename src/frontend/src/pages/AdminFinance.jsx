import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { tournamentApi, adminFinanceApi, steamLinkRequestApi } from '../services/api';
import { isSteamAuthEnabled } from '../config/featureFlags';
import './AdminFinance.css';

const TAB_TOPUPS = 'topups';
const TAB_CASHOUTS = 'cashouts';
const TAB_BATCHES = 'batches';
const TAB_FINAL_FUND = 'finalfund';
const TAB_STEAM_LINK = 'steamlink';

const PLACE_ICON = { 1: '🥇', 2: '🥈', 3: '🥉' };

function AdminFinance() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const bankirUsers = useMemo(() => {
    return (import.meta.env.VITE_BANKIR_USERS || '')
      .split(',')
      .map(u => u.trim().toLowerCase())
      .filter(Boolean);
  }, []);
  const adminUsers = useMemo(() => {
    return (import.meta.env.VITE_ADMIN_USERS || '')
      .split(',')
      .map(u => u.trim().toLowerCase())
      .filter(Boolean);
  }, []);
  const isBankir = useMemo(() => {
    if (!user) return false;
    const key = (user.pubgNick || user.username || '').toLowerCase();
    return bankirUsers.includes(key);
  }, [user, bankirUsers]);
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const key = (user.pubgNick || user.username || '').toLowerCase();
    return adminUsers.includes(key);
  }, [user, adminUsers]);

  const [topups, setTopups] = useState([]);
  const [cashouts, setCashouts] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [finalFunds, setFinalFunds] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab] = useState(TAB_TOPUPS);
  const [batchDetailId, setBatchDetailId] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);
  const [confirmMarkAllPaid, setConfirmMarkAllPaid] = useState(null);
  const [steamLinkRequests, setSteamLinkRequests] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const promises = [];
      if (isBankir) {
        promises.push(
          adminFinanceApi.getTopups('pending'),
          adminFinanceApi.getCashouts('requested'),
          tournamentApi.getAll(),
          adminFinanceApi.getPayoutBatches(),
          adminFinanceApi.getFinalFunds().catch(() => ({}))
        );
      } else {
        promises.push(tournamentApi.getAll());
      }
      if (isAdmin && isSteamAuthEnabled) {
        promises.push(steamLinkRequestApi.list().catch(() => []));
      }
      const results = await Promise.all(promises);
      if (isBankir) {
        setTopups(Array.isArray(results[0]) ? results[0] : []);
        setCashouts(Array.isArray(results[1]) ? results[1] : []);
        setTournaments(Array.isArray(results[2]) ? results[2] : []);
        setBatches(Array.isArray(results[3]) ? results[3] : []);
        const funds = results[4];
        setFinalFunds(typeof funds === 'object' && funds !== null ? funds : {});
        if (isAdmin && isSteamAuthEnabled && results[5] !== undefined) {
          setSteamLinkRequests(Array.isArray(results[5]) ? results[5] : []);
        }
      } else {
        setTournaments(Array.isArray(results[0]) ? results[0] : []);
        if (isAdmin && isSteamAuthEnabled && results[1] !== undefined) {
          setSteamLinkRequests(Array.isArray(results[1]) ? results[1] : []);
        }
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [isBankir, isAdmin]);

  const loadBatchDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const b = await adminFinanceApi.getPayoutBatch(id);
      setBatchDetail(b);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!authLoading && isAuthenticated && !isBankir && !isAdmin) return;
    if (isBankir || isAdmin) load();
  }, [authLoading, isAuthenticated, isBankir, isAdmin, navigate, load]);

  useEffect(() => {
    if (isAdmin && !isBankir && isSteamAuthEnabled && activeTab === TAB_TOPUPS) setActiveTab(TAB_STEAM_LINK);
  }, [isAdmin, isBankir]);

  useEffect(() => {
    if (batchDetailId) loadBatchDetail(batchDetailId);
    else setBatchDetail(null);
  }, [batchDetailId, loadBatchDetail]);

  const handleConfirmTopup = async (id) => {
    setActionLoading(`topup-confirm-${id}`);
    try {
      await adminFinanceApi.confirmTopup(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectTopup = async (id) => {
    setActionLoading(`topup-reject-${id}`);
    try {
      await adminFinanceApi.rejectTopup(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkCashoutPaid = async (id) => {
    setActionLoading(`cashout-paid-${id}`);
    try {
      await adminFinanceApi.markCashoutPaid(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCashout = async (id) => {
    setActionLoading(`cashout-reject-${id}`);
    try {
      await adminFinanceApi.rejectCashout(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayout = async (tournamentId) => {
    setActionLoading(`payout-${tournamentId}`);
    try {
      await adminFinanceApi.finalizePayout(tournamentId);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkLinePaid = async (batchId, lineId) => {
    setActionLoading(`line-${lineId}`);
    try {
      const updated = await adminFinanceApi.markPayoutLinePaid(batchId, lineId);
      setBatchDetail(updated);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllPaid = async (batchId) => {
    setActionLoading('mark-all-paid');
    try {
      const updated = await adminFinanceApi.markPayoutBatchAllPaid(batchId);
      setBatchDetail(updated);
      setConfirmMarkAllPaid(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
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

  const copyCode = (text) => {
    navigator.clipboard?.writeText(text).then(() => {});
  };

  const pendingSteamRequests = steamLinkRequests.filter((r) => r.status === 'pending');

  const handleSteamApprove = async (id) => {
    setActionLoading(`steam-approve-${id}`);
    try {
      await steamLinkRequestApi.approve(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSteamReject = async (id) => {
    setActionLoading(`steam-reject-${id}`);
    try {
      await steamLinkRequestApi.reject(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const tournamentsWithPotNoBatch = useMemo(() => {
    const batchTournamentIds = new Set((batches || []).map((b) => b.tournamentId));
    return tournaments.filter((t) => {
      const pot = t.finance?.potDC ?? 0;
      const state = t.state || '';
      const isDone = state === 'Турнир окончен' || state === 'DONE';
      return isDone && pot > 0 && !batchTournamentIds.has(t.id);
    });
  }, [tournaments, batches]);

  if (authLoading) {
    return (
      <>
        <div className="admin-finance-page"><p className="muted">Проверка доступа…</p></div>
      </>
    );
  }

  if (!isAuthenticated) return null;
  if (!isBankir && !isAdmin) {
    return (
      <>
        <div className="admin-finance-page admin-finance-denied">
          <h2>Доступ запрещён</h2>
          <p>Доступ только для банкиров и админов.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="admin-finance-page">
        {error && <div className="admin-finance-error">{error}</div>}
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : (
          <>
            <div className="admin-finance-tabs">
              {isBankir && (
                <>
                  <button type="button" className={activeTab === TAB_TOPUPS ? 'active' : ''} onClick={() => setActiveTab(TAB_TOPUPS)}>
                    Пополнения
                    {topups.length > 0 && <span className="admin-finance-tab-badge">{topups.length}</span>}
                  </button>
                  <button type="button" className={activeTab === TAB_CASHOUTS ? 'active' : ''} onClick={() => setActiveTab(TAB_CASHOUTS)}>
                    Выводы
                    {cashouts.length > 0 && <span className="admin-finance-tab-badge">{cashouts.length}</span>}
                  </button>
                  <button type="button" className={activeTab === TAB_BATCHES ? 'active' : ''} onClick={() => setActiveTab(TAB_BATCHES)}>Пакеты выплат</button>
                  <button type="button" className={activeTab === TAB_FINAL_FUND ? 'active' : ''} onClick={() => setActiveTab(TAB_FINAL_FUND)}>Квартальный фонд</button>
                </>
              )}
              {isAdmin && isSteamAuthEnabled && (
                <button type="button" className={activeTab === TAB_STEAM_LINK ? 'active' : ''} onClick={() => setActiveTab(TAB_STEAM_LINK)}>
                  Привязка Steam
                  {pendingSteamRequests.length > 0 && <span className="admin-finance-tab-badge">{pendingSteamRequests.length}</span>}
                </button>
              )}
            </div>

            <div className="admin-finance-tab-content">
              {activeTab === TAB_TOPUPS && (
                <section className="admin-finance-section">
                  <h2 className="admin-finance-section-title">Заявки на пополнение (ожидают)</h2>
                  {topups.length === 0 ? (
                    <div className="admin-finance-empty">
                      <span className="admin-finance-empty-icon" aria-hidden>+</span>
                      <p>Нет заявок на пополнение</p>
                    </div>
                  ) : (
                    <ul className="admin-finance-inbox">
                      {topups.map((t) => (
                        <li key={t.id} className="admin-finance-inbox-row">
                          <div className="admin-finance-inbox-main">
                            <span className="admin-finance-inbox-player">{t.playerId}</span>
                            <span className="admin-finance-inbox-amount tabular-nums">{t.amountDC} DC</span>
                            <span className="admin-finance-inbox-code"><code>{t.referenceCode}</code></span>
                            <button type="button" className="admin-finance-inbox-copy" onClick={() => copyCode(t.referenceCode)} aria-label="Скопировать">Скопировать</button>
                          </div>
                          <div className="admin-finance-inbox-actions">
                            <button type="button" className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => handleConfirmTopup(t.id)}>Подтвердить</button>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={!!actionLoading} onClick={() => handleRejectTopup(t.id)}>Отклонить</button>
                          </div>
                          <div className="admin-finance-inbox-meta">
                            <span className="muted small">{formatDate(t.createdAt)}</span>
                            {t.adminNote && <span className="admin-finance-inbox-note muted small">{t.adminNote}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {activeTab === TAB_CASHOUTS && (
                <section className="admin-finance-section">
                  <h2 className="admin-finance-section-title">Заявки на вывод (ожидают)</h2>
                  {cashouts.length === 0 ? (
                    <div className="admin-finance-empty">
                      <span className="admin-finance-empty-icon" aria-hidden>↗</span>
                      <p>Нет заявок на вывод</p>
                    </div>
                  ) : (
                    <ul className="admin-finance-inbox">
                      {cashouts.map((c) => (
                        <li key={c.id} className="admin-finance-inbox-row">
                          <div className="admin-finance-inbox-main">
                            <span className="admin-finance-inbox-player">{c.playerId}</span>
                            <span className="admin-finance-inbox-amount tabular-nums">{c.amountDC} DC</span>
                            <span className="admin-finance-pill admin-finance-pill--method">{c.method === 'CARD' ? 'Карта' : 'СБП'}</span>
                            <span className="admin-finance-inbox-dest">{maskDestination(c.method, c.destination)}</span>
                          </div>
                          <div className="admin-finance-inbox-actions">
                            <button type="button" className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => handleMarkCashoutPaid(c.id)}>Выплачено</button>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={!!actionLoading} onClick={() => handleRejectCashout(c.id)}>Отклонить</button>
                          </div>
                          <div className="admin-finance-inbox-meta">
                            <span className="muted small">{formatDate(c.createdAt)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {activeTab === TAB_BATCHES && (
                <section className="admin-finance-section">
                  <h2 className="admin-finance-section-title">Пакеты выплат</h2>
                  {tournamentsWithPotNoBatch.length > 0 && (
                    <div className="admin-finance-batch-create">
                      <p className="admin-finance-batch-create-title">Турниры без пакета (сформировать выплаты):</p>
                      <ul className="admin-finance-list">
                        {tournamentsWithPotNoBatch.map((t) => (
                          <li key={t.id} className="admin-finance-card">
                            <div className="admin-finance-card-main">
                              <span className="admin-finance-card-player">Турнир {t.name} — к выплате {t.finance?.potDC ?? 0} DC</span>
                            </div>
                            <div className="admin-finance-card-actions">
                              <button type="button" className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => handlePayout(t.id)}>Сформировать</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {batches.length === 0 && tournamentsWithPotNoBatch.length === 0 ? (
                    <div className="admin-finance-empty">
                      <span className="admin-finance-empty-icon" aria-hidden>🏆</span>
                      <p>Нет пакетов выплат</p>
                    </div>
                  ) : (
                    <ul className="admin-finance-list">
                      {batches.map((b) => (
                        <li key={b.id} className="admin-finance-card">
                          <div className="admin-finance-card-main">
                            <span className="admin-finance-card-player">{b.tournamentName}</span>
                            <span className="admin-finance-card-amount">пот: {b.potDC} DC</span>
                            <span className="admin-finance-card-meta">в фонд: {b.transferToFinalDC} DC</span>
                            <span className="admin-finance-card-meta">выплаты: {b.payoutTotalDC} DC</span>
                            <span className={`admin-finance-pill admin-finance-pill--${b.status}`}>{b.status === 'ready' ? 'Готов' : b.status === 'paid' ? 'Выплачено' : b.status}</span>
                          </div>
                          <div className="admin-finance-card-actions">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBatchDetailId(b.id)}>Открыть</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {activeTab === TAB_FINAL_FUND && (
                <section className="admin-finance-section">
                  <h2 className="admin-finance-section-title">Квартальный фонд</h2>
                  {Object.keys(finalFunds).length === 0 ? (
                    <div className="admin-finance-empty">
                      <span className="admin-finance-empty-icon" aria-hidden>🏦</span>
                      <p>Нет данных по сезонам</p>
                    </div>
                  ) : (
                    <ul className="admin-finance-list">
                      {Object.entries(finalFunds).map(([seasonId, data]) => (
                        <li key={seasonId} className="admin-finance-card">
                          <div className="admin-finance-card-main">
                            <span className="admin-finance-card-player">Сезон {seasonId}</span>
                            <span className="admin-finance-card-amount tabular-nums">{data?.balanceDC ?? 0} DC</span>
                            {data?.updatedAt && <span className="muted small">{formatDate(data.updatedAt)}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {activeTab === TAB_STEAM_LINK && (
                <section className="admin-finance-section">
                  <h2 className="admin-finance-section-title">Запросы на привязку Steam к PUBG-профилю</h2>
                  <p className="muted small">Игрок с привязанным Steam создаёт запрос «привязать мой Steam к профилю с ником X». Одобрите или отклоните.</p>
                  {pendingSteamRequests.length === 0 ? (
                    <div className="admin-finance-empty">
                      <span className="admin-finance-empty-icon" aria-hidden>🎮</span>
                      <p>Нет ожидающих запросов</p>
                    </div>
                  ) : (
                    <ul className="admin-finance-inbox">
                      {pendingSteamRequests.map((r) => (
                        <li key={r.id} className="admin-finance-inbox-row">
                          <div className="admin-finance-inbox-main">
                            <span className="admin-finance-inbox-player">{r.requesterUsername}</span>
                            <span>→ привязать к PUBG-нику</span>
                            <span className="admin-finance-inbox-player">{r.targetPubgNick}</span>
                            <span className="muted small">{formatDate(r.createdAt)}</span>
                          </div>
                          <div className="admin-finance-inbox-actions">
                            <button type="button" className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => handleSteamApprove(r.id)}>Одобрить</button>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={!!actionLoading} onClick={() => handleSteamReject(r.id)}>Отклонить</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </div>

      {/* Batch detail drawer */}
      {batchDetailId && (
        <div className="admin-finance-drawer-overlay" onClick={() => setBatchDetailId(null)} aria-hidden="false">
          <div className="admin-finance-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="admin-finance-drawer-header">
              <h3>{batchDetail?.tournamentName || 'Пакет выплат'}</h3>
              <button type="button" className="admin-finance-drawer-close" onClick={() => setBatchDetailId(null)} aria-label="Закрыть">×</button>
            </div>
            {batchDetail && (
              <>
                <div className="admin-finance-drawer-summary">
                  <p>Призовой фонд: <strong className="tabular-nums">{batchDetail.potDC} DC</strong></p>
                  <p>Отчисление в фонд при взносе (ставка {batchDetail.finalFundRate}%, ID: {batchDetail.seasonId || '—'}): <strong className="tabular-nums">{batchDetail.transferToFinalDC} DC</strong></p>
                  <p>На выплаты: <strong className="tabular-nums">{batchDetail.payoutTotalDC} DC</strong> (50% / 35% / 15%)</p>
                  <p>Режим: {batchDetail.payoutMode === 'pay_captain' ? 'Капитану' : 'По игрокам'}</p>
                </div>
                <div className="admin-finance-drawer-lines">
                  <h4>Выплаты</h4>
                  {batchDetail.lines?.map((line) => (
                    <div key={line.lineId} className="admin-finance-drawer-line">
                      <div className="admin-finance-drawer-line-main">
                        <span className="admin-finance-drawer-line-place">{PLACE_ICON[line.place] || `#${line.place}`}</span>
                        <span className="admin-finance-drawer-line-recipient">{line.recipientLabel}</span>
                        <span className="admin-finance-drawer-line-amount tabular-nums">{line.amountDC} DC</span>
                        <span className={`admin-finance-pill admin-finance-pill--${line.status}`}>{line.status === 'paid' ? 'Выплачено' : 'Ожидает'}</span>
                      </div>
                      {line.breakdown && line.breakdown.length > 0 && (
                        <ul className="admin-finance-drawer-breakdown">
                          {line.breakdown.map((row) => (
                            <li key={row.playerId}><span>{row.label}</span> <span className="tabular-nums">{row.amountDC} DC</span></li>
                          ))}
                        </ul>
                      )}
                      {line.status === 'pending' && (
                        <button type="button" className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => handleMarkLinePaid(batchDetail.id, line.lineId)}>Выплатить на кошелёк</button>
                      )}
                    </div>
                  ))}
                </div>
                {batchDetail.lines?.some((l) => l.status === 'pending') && (
                  <div className="admin-finance-drawer-actions">
                    <button type="button" className="btn btn-primary" disabled={!!actionLoading} onClick={() => setConfirmMarkAllPaid(batchDetail.id)}>Выплатить все на кошельки</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm mark all paid */}
      {confirmMarkAllPaid && (
        <div className="admin-finance-modal-overlay" onClick={() => setConfirmMarkAllPaid(null)}>
          <div className="admin-finance-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Выплатить все призы на кошельки?</h3>
            <p className="muted">DC будут списаны с призового фонда турнира и зачислены на баланс игроков в приложении.</p>
            <div className="admin-finance-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmMarkAllPaid(null)}>Отмена</button>
              <button type="button" className="btn btn-primary" disabled={!!actionLoading} onClick={() => handleMarkAllPaid(confirmMarkAllPaid)}>Да, выплатить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminFinance;
