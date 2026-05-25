import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tournamentApi, financeApi, adminFinanceApi, subscribeToUpdates } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useLayoutConfig } from '../contexts/LayoutConfigContext';
import Tabs from '../components/Tabs';
import TournamentTable from '../components/TournamentTable';
import TournamentMatches from '../components/TournamentMatches';
import TournamentPlayers from '../components/TournamentPlayers';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import RegisterModal from '../components/modals/RegisterModal';
import Modal from '../components/Modal';
import { useTranslation } from '../contexts/LanguageContext';
import { DEVELOPERS } from '../config/app';
import { buildTournamentDerived } from '../utils/tournamentDerived';
import { getMyRegistration, isRegistrationClosed, formatStartAt } from '../utils/registration';
import './Tournament.css';

function Tournament() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [table, setTable] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('table');
  const [highlightMatchIndex, setHighlightMatchIndex] = useState(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [payEntryLoading, setPayEntryLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const { user } = useAuth();
  const currentPlayerId = user?.pubgNick || user?.username || null;
  
  // Derived views из table.json
  const derivedData = useMemo(() => {
    if (!table || !tournament) return null;
    // Убеждаемся, что tournament.id установлен
    const tournamentWithId = { ...tournament, id: tournament.id || id };
    return buildTournamentDerived(table, tournamentWithId);
  }, [table, tournament, id]);

  const defaultAdmin = 'ivanchk';
  const adminUsers = (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  const bankirUsers = (import.meta.env.VITE_BANKIR_USERS || '').split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
  const isAdmin = user && adminUsers.includes(((user.pubgNick || user.username) || '').toLowerCase());
  const isBankir = user && bankirUsers.includes(((user.pubgNick || user.username) || '').toLowerCase());
  const isDeveloper = user && DEVELOPERS.length > 0 && DEVELOPERS.includes(((user.pubgNick || user.username) || '').toLowerCase());

  // Навигация к матчу по клику на форму
  const navigateToMatch = useCallback((matchIndex) => {
    setActiveTab('matches');
    setHighlightMatchIndex(matchIndex);
    // После рендера скроллить к элементу
    setTimeout(() => {
      const element = document.getElementById(`match-${matchIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Убрать подсветку через 2 секунды
      setTimeout(() => setHighlightMatchIndex(null), 2000);
    }, 100);
  }, []);

  const tabs = [
    { id: 'table', label: t('tournamentPage.tabTable') },
    { id: 'matches', label: t('tournamentPage.tabMatches') },
    { id: 'players', label: t('tournamentPage.tabPlayers') },
    { id: 'finance', label: t('tournamentPage.tabFinance') },
  ];

  const loadTournament = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tournamentApi.getTable(id);
      if (data) {
        setTable(data);
      } else {
        setError(t('tournamentPage.notFound'));
      }
    } catch (err) {
      console.error('Ошибка загрузки турнира:', err);
      setError(err.response?.data?.error || t('tournamentPage.loadError'));
      setTable(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setTable(null);
    setTournament(null);
    setError(null);
    setLoading(true);
    loadTournament();

    const unsubscribe = subscribeToUpdates(() => {
      loadTournament();
    });
    return () => unsubscribe();
  }, [loadTournament]);

  useEffect(() => {
    if (id) {
      tournamentApi.getById(id)
        .then(data => setTournament(data))
        .catch(() => { });
    }
  }, [id, t]);

  useEffect(() => {
    if (currentPlayerId && tournament) {
      financeApi.getWallet().then(setWallet).catch(() => {});
    } else {
      setWallet(null);
    }
  }, [currentPlayerId, tournament]);

  const getTournamentStatus = (tournament) => {
    if (!tournament) return '';
    if (tournament.state === 'В процессе') return 'LIVE';
    if (tournament.state === 'Турнир окончен' || tournament.state === 'DONE') return 'DONE';
    return 'REG';
  };

  const status = tournament ? getTournamentStatus(tournament) : '';
  const finance = tournament ? (tournament.finance || tournament.extra?.finance || {}) : {};
  const heroEntryFeeDC = finance.entryFeeDC ?? 0;
  const heroPotDC = finance.potDC ?? 0;
  const heroFinalFundRate = finance.finalFundRate ?? 0;
  const myRegistration = tournament ? getMyRegistration(tournament, currentPlayerId) : null;
  const registrationClosed = tournament ? isRegistrationClosed(tournament) : true;

  const handleLeave = useCallback(async () => {
    if (!id) return;
    try {
      const preview = await tournamentApi.getLeavePreview(id).catch(() => ({}));
      const msg = preview.refundDC != null && preview.refundDC > 0
        ? t('tournamentPage.leaveRefundConfirm', { percent: preview.refundPercent, dc: preview.refundDC }) || `Выход: возврат ${preview.refundPercent}% (${preview.refundDC} DC). Продолжить?`
        : t('tournamentPage.leaveConfirm') || 'Выйти из турнира?';
      if (!window.confirm(msg)) return;
      await tournamentApi.leave(id);
      const [freshTable, freshTournament] = await Promise.all([
        tournamentApi.getTable(id),
        tournamentApi.getById(id)
      ]);
      if (freshTable) setTable(freshTable);
      if (freshTournament) setTournament(freshTournament);
    } catch (err) {
      console.error('Leave tournament:', err);
      if (err.response?.data?.error) window.alert(err.response.data.error);
    }
  }, [id, t]);

  const handleWithdrawFreeAgent = useCallback(async () => {
    if (!id) return;
    if (tournament?.finance?.entryFeeDC) {
      await handleLeave();
      return;
    }
    try {
      const res = await tournamentApi.withdrawFreeAgent(id);
      if (res?.tournament) setTournament(res.tournament);
    } catch (err) {
      console.error('Withdraw free agent:', err);
    }
  }, [id, tournament?.finance?.entryFeeDC, handleLeave]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      await tournamentApi.deleteTournament(id);
      setDeleteModalOpen(false);
      navigate('/tournaments');
    } catch (err) {
      alert(err.response?.data?.error || err.message || t('missionControl.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  }, [id, navigate, t]);

  const escapeCsvCell = (v) => {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExportXlsx = useCallback(() => {
    if (!derivedData?.entities?.length) return;
    try {
      const headers = [t('tournamentPage.place'), t('tournamentPage.participant'), t('tournamentPage.points'), t('tournamentPage.kills'), t('tournamentPage.avgPlace')];
      const rows = derivedData.entities.map((e) => [
        e.rank ?? '—',
        e.name ?? '—',
        e.totalPoints ?? '—',
        e.totalKills ?? '—',
        e.avgPlace != null ? e.avgPlace.toFixed(1) : '—'
      ]);
      const csvLines = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))];
      const csv = '\uFEFF' + csvLines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(tournament?.name || 'tournament').replace(/[^a-z0-9а-яё_-]/gi, '_')}-results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export csv:', err);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(t('tournamentPage.exportError'));
      }
    }
  }, [derivedData, tournament?.name, t]);

  const handleRemoveTeam = useCallback(async (teamName) => {
    if (!id) return;
    const isOwnTeam = myRegistration?.teamName === teamName;
    if (isOwnTeam && tournament?.finance?.entryFeeDC) {
      await handleLeave();
      return;
    }
    try {
      await tournamentApi.removeTeam(id, teamName);
      const [freshTable, freshTournament] = await Promise.all([
        tournamentApi.getTable(id),
        tournamentApi.getById(id)
      ]);
      if (freshTable) setTable(freshTable);
      if (freshTournament) setTournament(freshTournament);
    } catch (err) {
      console.error('Remove team:', err);
      if (err.response?.data?.error) window.alert(err.response.data.error);
    }
  }, [id, tournament?.finance?.entryFeeDC, myRegistration?.teamName, handleLeave]);

  const getMainCTA = () => {
    if (!tournament) return null;

    if (status === 'REG') {
      if (myRegistration) {
        return (
          <div className="tournament-registration-status">
            {myRegistration.kind === 'free_agent' ? (
              <>
                <span className="tournament-registration-label">{t('tournamentPage.freeAgentPool')}</span>
                {!registrationClosed && (
                  <button className="btn btn-secondary" onClick={handleWithdrawFreeAgent}>
                    {t('registerModal.leavePool')}
                  </button>
                )}
              </>
            ) : myRegistration.kind === 'solo' ? (
              (() => {
                const entryFeeDC = tournament.finance?.entryFeeDC ?? tournament.extra?.finance?.entryFeeDC ?? 0;
                const requiredDC = entryFeeDC;
                const hasPaid = !!myRegistration.entry?.paidAt;
                const available = wallet?.availableDC ?? 0;
                return (
                  <>
                    <span className="tournament-registration-label">{t('tournamentPage.registeredSolo')}</span>
                    {entryFeeDC > 0 && (
                      hasPaid ? (
                        <span className="tournament-registration-label">
                          {t('tournamentPage.entryPaid', 'Взнос оплачен')} ({requiredDC} DC)
                        </span>
                      ) : available < requiredDC ? (
                        <span className="tournament-registration-label">
                          {t('tournamentPage.insufficientDC', 'Недостаточно DC')}{' '}
                          <Link to="/finance">{t('tournamentPage.topUp', 'Пополнить')}</Link>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={payEntryLoading}
                          onClick={async () => {
                            setPayEntryLoading(true);
                            try {
                              await tournamentApi.payEntry(id);
                              const [tData, wData] = await Promise.all([
                                tournamentApi.getById(id),
                                financeApi.getWallet().catch(() => null)
                              ]);
                              if (tData) setTournament(tData);
                              if (wData) setWallet(wData);
                            } catch (e) {
                              const msg = e.response?.data?.error || e.message;
                              if (msg && String(msg).includes('Недостаточно')) {
                                window.alert(`${msg} ${t('tournamentPage.topUp', 'Пополнить')}: /finance`);
                              } else {
                                window.alert(msg);
                              }
                            } finally {
                              setPayEntryLoading(false);
                            }
                          }}
                        >
                          {payEntryLoading ? '…' : t('tournamentPage.payEntry', 'Оплатить взнос')} (−{requiredDC} DC)
                        </button>
                      )
                    )}
                  </>
                );
              })()
            ) : myRegistration.kind === 'team' ? (
              (() => {
                const entryFeeDC = tournament.finance?.entryFeeDC ?? tournament.extra?.finance?.entryFeeDC ?? 0;
                const entry = myRegistration.entry;
                const members = entry?.members || (entry?.captainId ? [entry.captainId] : []);
                const memberCount = members.length || 1;
                const memberPayments = entry?.memberPayments && typeof entry.memberPayments === 'object' ? entry.memberPayments : {};
                const paidMembers = members.filter((pid) => (memberPayments[pid] || 0) >= entryFeeDC).length;
                const myPaidShare = (memberPayments[currentPlayerId] || 0) >= entryFeeDC;
                const available = wallet?.availableDC ?? 0;
                const shareDC = entryFeeDC;
                return (
                  <div className="tournament-registration-team">
                    <div className="tournament-registration-row">
                      <span className="tournament-registration-label">
                        {t('tournamentPage.teamLabel')}: {myRegistration.teamName || '—'}
                      </span>
                      {entryFeeDC > 0 && (
                        <span className="tournament-registration-label">
                          {t('tournamentPage.paidCount', 'Оплатили')} {paidMembers}/{memberCount} {t('tournamentPage.people', 'чел.')}
                        </span>
                      )}
                    </div>
                    {entryFeeDC > 0 && (
                      myPaidShare ? (
                        <span className="tournament-registration-label tournament-registration-label--success">
                          {t('tournamentPage.yourSharePaid', 'Ваша доля оплачена')} ({shareDC} DC)
                        </span>
                      ) : available < shareDC ? (
                        <span className="tournament-registration-label">
                          {t('tournamentPage.insufficientDC', 'Недостаточно DC')}{' '}
                          <Link to="/finance">{t('tournamentPage.topUp', 'Пополнить')}</Link>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary tournament-pay-btn"
                          disabled={payEntryLoading}
                          onClick={async () => {
                            setPayEntryLoading(true);
                            try {
                              await tournamentApi.payShare(id);
                              const [tData, wData] = await Promise.all([
                                tournamentApi.getById(id),
                                financeApi.getWallet().catch(() => null)
                              ]);
                              if (tData) setTournament(tData);
                              if (wData) setWallet(wData);
                            } catch (e) {
                              const msg = e.response?.data?.error || e.message;
                              if (msg && String(msg).includes('Недостаточно')) {
                                window.alert(`${msg} ${t('tournamentPage.topUp', 'Пополнить')}: /finance`);
                              } else {
                                window.alert(msg);
                              }
                            } finally {
                              setPayEntryLoading(false);
                            }
                          }}
                        >
                          {payEntryLoading ? '…' : t('tournamentPage.payShare', 'Оплатить свою долю')} (−{shareDC} DC)
                        </button>
                      )
                    )}
                    {!registrationClosed && myRegistration.teamName && (
                      <div className="tournament-registration-actions">
                        <button
                          type="button"
                          className="btn btn-secondary tournament-withdraw-team-btn"
                          onClick={() => handleRemoveTeam(myRegistration.teamName)}
                        >
                          {t('tournamentPage.withdrawTeam')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : null}
          </div>
        );
      }
      if (!registrationClosed) {
        return (
          <button className="btn btn-primary" onClick={() => setRegisterModalOpen(true)}>
            {t('tournament.register')}
          </button>
        );
      }
      return (
        <span className="tournament-registration-closed">{t('tournamentPage.registrationClosed')}</span>
      );
    }
    if (status === 'LIVE' && isAdmin) {
      return <button className="btn btn-primary">{t('tournamentPage.addResult')}</button>;
    }
    if (status === 'DONE') {
      return (
        <button className="btn btn-primary" onClick={handleExportXlsx}>
          {t('tournamentPage.exportExcel')}
        </button>
      );
    }
    return null;
  };

  useLayoutConfig({ showInfoSidebar: false });

  if (loading) {
    return (
      <div className="tournament-page">
          <div className="tournament-hero">
            <Skeleton height={28} width="220px" />
            <Skeleton height={14} width="60%" />
          </div>
          <Skeleton height={36} width="320px" />
          <Skeleton height={240} />
      </div>
    );
  }

  if (error || !table || !tournament) {
    return (
      <div className="error">
          <p>{error || t('tournamentPage.notFound')}</p>
          <button className="btn btn-secondary" onClick={() => window.history.back()}>{t('common.back')}</button>
        </div>
    );
  }

  return (
    <>
    <div className="tournament-page">
        {/* Hero турнира */}
        <div className="tournament-hero">
          <div className="tournament-hero-content">
            <div className="tournament-hero-left">
              <div className="tournament-hero-title">
                <h1>{tournament.name}</h1>
              </div>
              <div className="tournament-meta">
                {tournament.state === 'В процессе' ? (
                  tournament.startedAt ? (
                    <span>{t('tournamentPage.startLabel')}: {formatStartAt(tournament.startedAt)}</span>
                  ) : (
                    <span>{t('tournament.date')}: {tournament.date}</span>
                  )
                ) : tournament.startAt ? (
                  <span>{t('tournamentPage.regUntil')}: {formatStartAt(tournament.startAt)}</span>
                ) : (
                  <span>{t('tournament.date')}: {tournament.date}</span>
                )}
                <span>{t('home.format')}: {tournament.type}</span>
                {tournament.price && <span>{t('schedule.fee')}: {tournament.price}</span>}
                {tournament.state === 'В процессе' && (
                  <span>{t('tournamentPage.roundsLabel')}: {tournament.playedRounds || 0} / {tournament.rounds || 0}</span>
                )}
                {heroPotDC > 0 && (
                  <span>{t('tournamentPage.collected', 'Собранные средства')}: {heroPotDC} DC</span>
                )}
              </div>
            </div>
            <div className="tournament-hero-cta">
              {getMainCTA()}
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Контент вкладок */}
        <div className="tournament-content">
          {activeTab === 'table' && (
            <div className="tab-content">
              <TournamentTable table={table} tournamentId={id} tournament={tournament} status={status} myRegistration={myRegistration} />
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="tab-content">
              <TournamentMatches
                matches={derivedData?.matches || []}
                tournamentId={id}
                isAdmin={isAdmin}
                highlightMatchIndex={highlightMatchIndex}
                onAddResult={(matchIndex) => {
                  // TODO: открыть модалку для добавления результата
                  console.log('Add result for match', matchIndex);
                }}
              />
            </div>
          )}

          {activeTab === 'players' && (
            <div className="tab-content">
              <TournamentPlayers
                entities={derivedData?.entities || []}
                tournamentId={id}
                tournamentType={tournament?.type || 'solo'}
                tournament={tournament}
                status={status}
                currentPlayerId={currentPlayerId}
                isAdmin={isAdmin}
                onFormMatchClick={navigateToMatch}
                onRemoveTeam={handleRemoveTeam}
                onAddResult={(matchIndex) => {
                  // TODO: открыть модалку для добавления результата
                  console.log('Add result for match', matchIndex);
                }}
              />
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="tab-content">
              {(() => {
                  const finance = tournament.finance || tournament.extra?.finance || {};
                  const entryFeeDC = finance.entryFeeDC ?? 0;
                  const potDC = finance.potDC ?? 0;
                  const finalFundRate = finance.finalFundRate ?? 0;
                  const payoutSummary = finance.payoutSummary || null;

                  if (!entryFeeDC && !potDC && !finalFundRate && !payoutSummary) {
                    return (
                      <EmptyState
                        title={t('tournamentPage.noTransactions')}
                        description={t('tournamentPage.noTransactionsDesc')}
                      />
                    );
                  }

                  const entries = tournament.registration?.entries || [];
                  const totalPaidDC = entryFeeDC > 0
                    ? entries.reduce((sum, e) => {
                        if (e.kind === 'solo') {
                          return sum + (e.paidAt ? entryFeeDC : 0);
                        }
                        const mp = e.memberPayments && typeof e.memberPayments === 'object' ? e.memberPayments : {};
                        const members = e.members || (e.captainId ? [e.captainId] : []);
                        const paid = members.reduce((s, pid) => s + (mp[pid] || 0), 0);
                        return sum + paid;
                      }, 0)
                    : 0;

                  const totalPotentialDC = entryFeeDC > 0
                    ? entries.reduce((sum, e) => {
                        const membersCount = e.kind === 'team'
                          ? (e.members?.length || 1)
                          : 1;
                        return sum + entryFeeDC * membersCount;
                      }, 0)
                    : 0;

                  const progressPercent = totalPotentialDC > 0
                    ? Math.round((totalPaidDC / totalPotentialDC) * 100)
                    : 0;

                  const closedTournament =
                    status === 'DONE' || tournament.state === 'Турнир окончен';
                  const persistedFinal = finance.finalFundContributedDC;
                  let toMainFinalFundDC = 0;
                  if (typeof persistedFinal === 'number' && !Number.isNaN(persistedFinal)) {
                    toMainFinalFundDC = persistedFinal;
                  } else if (entryFeeDC > 0 && totalPaidDC > 0) {
                    if (!closedTournament || potDC > 0) {
                      toMainFinalFundDC = Math.max(0, totalPaidDC - potDC);
                    }
                  }
                  const finalFundRatePercent =
                    finance.finalFundRate != null && finance.finalFundRate !== ''
                      ? Number(finance.finalFundRate)
                      : 15;

                  const myEntry = entries.find((e) => {
                    if (!currentPlayerId) return false;
                    if (e.kind === 'solo') return e.playerId === currentPlayerId;
                    return e.captainId === currentPlayerId || (e.members && e.members.includes(currentPlayerId));
                  });

                  let myPaid = 0;
                  if (myEntry && entryFeeDC > 0) {
                    if (myEntry.kind === 'solo') {
                      myPaid = myEntry.paidAt ? entryFeeDC : 0;
                    } else {
                      const mp = myEntry.memberPayments && typeof myEntry.memberPayments === 'object' ? myEntry.memberPayments : {};
                      myPaid = mp[currentPlayerId] || 0;
                    }
                  }

                  return (
                    <>
                      <div className="finance-summary">
                        {(toMainFinalFundDC > 0 || finalFundRatePercent > 0) && (
                          <div className="finance-item">
                            <div className="finance-label">
                              {t('tournamentPage.toMainFinalFund', 'В фонд главного турнира')}
                            </div>
                            <div className="finance-value tabular-nums">{toMainFinalFundDC} DC</div>
                          </div>
                        )}
                        {payoutSummary ? (
                          <div className="finance-item finance-item--prizes-sent">
                            <div className="finance-label">
                              {payoutSummary.walletsCredited !== false
                                ? t('tournamentPage.prizesDistributed', 'Призы зачислены на кошельки')
                                : t('tournamentPage.prizesPending', 'Пакет выплат создан — ожидает зачисления')}
                            </div>
                            <div className="finance-value tabular-nums">
                              {payoutSummary.payoutTotalDC ?? 0} DC
                            </div>
                            <ul className="finance-prize-list">
                              {(payoutSummary.lines || []).map((line) => {
                                const hasBreakdown = line.breakdown && line.breakdown.length > 0;
                                return (
                                  <li key={line.lineId || `${line.place}-${line.recipientLabel}`} className="finance-prize-line">
                                    <div className="finance-prize-line-header">
                                      <span className="finance-prize-place">
                                        {t('tournamentPage.prizePlace', { place: line.place })}
                                      </span>
                                      {hasBreakdown ? (
                                        <>
                                          <span className="finance-prize-team">{line.recipientLabel}</span>
                                          <span className="finance-prize-sum tabular-nums">{line.amountDC} DC</span>
                                        </>
                                      ) : (
                                        <>
                                          <Link
                                            className="finance-prize-recipient-link"
                                            to={`/player/${encodeURIComponent(line.recipientId || line.recipientLabel || '')}`}
                                          >
                                            {line.recipientLabel || line.recipientId}
                                          </Link>
                                          <span className="finance-prize-sum tabular-nums">{line.amountDC} DC</span>
                                        </>
                                      )}
                                    </div>
                                    {hasBreakdown && (
                                      <ul className="finance-prize-breakdown">
                                        {line.breakdown.map((b, idx) => (
                                          <li key={b.playerId || idx}>
                                            <Link
                                              to={`/player/${encodeURIComponent(b.playerId || b.label || '')}`}
                                            >
                                              {b.label || b.playerId}
                                            </Link>
                                            <span className="tabular-nums"> — {b.amountDC} DC</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : (
                          <div className="finance-item">
                            <div className="finance-label">
                              {t('tournamentPage.collectedNet', 'Собранные средства (в призовой фонд)')}
                            </div>
                            <div className="finance-value tabular-nums">{potDC} DC</div>
                            {entryFeeDC > 0 && finalFundRatePercent > 0 && (
                              <div className="finance-hint">
                                {t('tournamentPage.collectedNetHint', { rate: finalFundRatePercent })}
                              </div>
                            )}
                          </div>
                        )}
                        {entryFeeDC > 0 && totalPotentialDC > 0 && (
                          <div className="finance-item">
                            <div className="finance-label">
                              {t('tournamentPage.paymentProgress', 'Прогресс оплаты')}
                            </div>
                            <div className="finance-value">
                              {totalPaidDC} / {totalPotentialDC} DC ({progressPercent}%)
                            </div>
                          </div>
                        )}
                      </div>

                      {myPaid > 0 && (
                        <div className="finance-my-entry">
                          <span className="finance-label">
                            {t('tournamentPage.yourEntryFee', 'Ваш взнос')}
                          </span>
                          <span className="finance-value">
                            {myPaid} DC{myEntry?.kind === 'team' && myEntry.name ? ` · ${myEntry.name}` : ''}
                          </span>
                        </div>
                      )}

                      {isBankir && (status === 'DONE' || tournament.state === 'Турнир окончен') && potDC > 0 && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={payoutLoading}
                          onClick={async () => {
                            setPayoutLoading(true);
                            try {
                              await adminFinanceApi.finalizePayout(id);
                              const [tData, wData] = await Promise.all([
                                tournamentApi.getById(id),
                                currentPlayerId ? financeApi.getWallet() : Promise.resolve(null),
                              ]);
                              if (tData) setTournament(tData);
                              if (wData) setWallet(wData);
                              loadTournament();
                              // После распределения призов перезагружаем страницу,
                              // чтобы сразу увидеть финальное состояние всех блоков.
                              window.location.reload();
                            } catch (e) {
                              window.alert(e.response?.data?.error || e.message);
                            } finally {
                              setPayoutLoading(false);
                            }
                          }}
                        >
                          {payoutLoading ? '…' : t('tournamentPage.distributePrizes', 'Выплатить призы на кошельки')}
                        </button>
                      )}
                      {isBankir && (status === 'DONE' || tournament.state === 'Турнир окончен') && potDC > 0 && (
                        <p className="finance-hint" style={{ marginTop: '0.5rem' }}>
                          {t('tournamentPage.distributePrizesHint')}
                        </p>
                      )}

                      {potDC === 0 && !isAdmin && !payoutSummary && (
                        <EmptyState
                          title={t('tournamentPage.noTransactions')}
                          description={t('tournamentPage.noTransactionsDesc')}
                        />
                      )}
                    </>
                  );
                })()}
            </div>
          )}

        </div>
      </div>

      {registerModalOpen && tournament && (
        <RegisterModal
          tournament={tournament}
          currentPlayerId={currentPlayerId}
          availableDC={wallet?.availableDC ?? 0}
          onClose={() => setRegisterModalOpen(false)}
          onSuccess={(updated) => {
            if (updated) setTournament(updated);
            loadTournament();
          }}
        />
      )}
      {deleteModalOpen && tournament && (
        <Modal
          title={t('missionControl.deleteTournament')}
          onClose={() => !deleteLoading && setDeleteModalOpen(false)}
          actions={[
            <button key="cancel" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>
              {t('common.cancel')}
            </button>,
            <button key="delete" className="btn btn-primary" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? t('common.loading') : t('missionControl.deleteTournament')}
            </button>
          ]}
        >
          <p>{t('missionControl.deleteConfirm', { name: tournament.name })}</p>
        </Modal>
      )}
    </>
  );
}

export default Tournament;
