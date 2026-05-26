import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { tournamentApi, subscribeToUpdates } from '@/services/api';
import { useLayoutConfig } from '@/contexts/LayoutConfigContext';
import { EmptyState, StatusPill, Skeleton } from '@/shared/ui';
import { useAuth } from '@/features/auth';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  getMyRegistration,
  formatTournamentDate,
  getRegistrationDeadlineDisplay,
} from '@/entities/tournament';
import './Schedule.css';

function Schedule() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('date-desc');
  const [, setTick] = useState(0);
  const { user } = useAuth();
  const { t } = useTranslation();
  const currentPlayerId = user?.pubgNick || user?.username || null;

  // Обновление countdown регистрации раз в минуту
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadTournaments();
    const unsubscribe = subscribeToUpdates(() => loadTournaments());
    return () => unsubscribe();
  }, []);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const data = await tournamentApi.getAll();
      setTournaments(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('schedule.loadError'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getTournamentStatus = (tournament) => {
    if (tournament.state === 'В процессе') return 'LIVE';
    if (tournament.state === 'Турнир окончен' || tournament.state === 'DONE') return 'DONE';
    return 'REG';
  };

  const getTournamentId = (tournament) => tournament?.id || tournament?._id;



  const defaultAdmin = 'ivanchk';
  const adminUsers = (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = user && adminUsers.includes(((user.pubgNick || user.username) || '').toLowerCase());
  const headerAction = isAdmin ? (
    <Link to="/create" className="btn btn-primary">
      {t('nav.createTournament')}
    </Link>
  ) : null;

  // Поиск: общий фильтр по строке (для обеих групп)
  const matchesSearch = (tournament) => {
    if (!query.trim()) return true;
    const q = String(query).toLowerCase().trim();
    const status = getTournamentStatus(tournament);
    const statusMap = { LIVE: t('tournament.inProgress').toLowerCase(), DONE: t('tournament.finished').toLowerCase(), REG: t('tournament.register').toLowerCase() };
    const statusText = statusMap[status] || '';
    const haystack = [
      tournament.name,
      tournament.type,
      tournament.date,
      tournament.state,
      status,
      statusText
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  };

  // Таблица 1: активные турниры (REG + LIVE) — без дублирования
  const activeTournaments = useMemo(() => {
    const list = tournaments.filter((t) => {
      const s = getTournamentStatus(t);
      return s === 'REG' || s === 'LIVE';
    });
    return list.filter(matchesSearch);
  }, [tournaments, query]);

  // Таблица 2: только завершённые (DONE)
  const completedTournaments = useMemo(() => {
    const list = tournaments.filter((t) => getTournamentStatus(t) === 'DONE');
    return list.filter(matchesSearch);
  }, [tournaments, query]);

  // Фильтр «Мои»: активные и завершённые турниры, где участвовал текущий пользователь
  const participationFilter = (t) => {
    if (!currentPlayerId) return false;
    return !!getMyRegistration(t, currentPlayerId);
  };

  const displayedActive = useMemo(() => {
    return statusFilter === 'my' ? activeTournaments.filter(participationFilter) : activeTournaments;
  }, [statusFilter, activeTournaments, currentPlayerId]);

  const displayedCompleted = useMemo(() => {
    return statusFilter === 'my' ? completedTournaments.filter(participationFilter) : completedTournaments;
  }, [statusFilter, completedTournaments, currentPlayerId]);

  const sortByDate = (items, order) => {
    const arr = [...items];
    arr.sort((a, b) => {
      const aDate = a.date || '';
      const bDate = b.date || '';
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return order === 'date-asc' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    });
    return arr;
  };

  const sortedActive = useMemo(() => sortByDate(displayedActive, sort), [displayedActive, sort]);
  const sortedCompleted = useMemo(() => sortByDate(displayedCompleted, sort), [displayedCompleted, sort]);

  // Показывать таблицы в зависимости от фильтра (при «Мои» — активные и завершённые, только с участием пользователя)
  const showActiveTable = statusFilter === 'all' || statusFilter === 'active' || statusFilter === 'my';
  const showCompletedTable = statusFilter === 'all' || statusFilter === 'DONE' || statusFilter === 'my';
  const hasAnyFiltered = (showActiveTable && sortedActive.length > 0) || (showCompletedTable && sortedCompleted.length > 0);

  useLayoutConfig({ headerAction });
  if (loading) {
    return (
      <div className="schedule">
          <Skeleton height={36} />
          <Skeleton height={220} />
        </div>
    );
  }

  if (error) {
    return (
      <div className="error">{error}</div>
    );
  }

  return (
    <div className="schedule">
        <div className="schedule-controls">
          <div className="tabs-group">
            <button type="button" className={`btn btn-ghost ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>{t('schedule.filterAll')}</button>
            <button type="button" className={`btn btn-ghost ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>{t('schedule.filterActive')}</button>
            <button type="button" className={`btn btn-ghost ${statusFilter === 'DONE' ? 'active' : ''}`} onClick={() => setStatusFilter('DONE')}>{t('schedule.filterDone')}</button>
            <button type="button" className={`btn btn-ghost ${statusFilter === 'my' ? 'active' : ''}`} onClick={() => setStatusFilter('my')} title={t('schedule.filterMyTitle')}>{t('schedule.filterMy')}</button>
          </div>
          <div className="schedule-controls-right">
            <input
              className="input schedule-search"
              placeholder={t('schedule.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="select schedule-select"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="date-desc">{t('schedule.sortNewFirst')}</option>
              <option value="date-asc">{t('schedule.sortOldFirst')}</option>
            </select>
          </div>
        </div>

        {!hasAnyFiltered ? (
          <EmptyState
            title={t('schedule.emptyTitle')}
            description={t('schedule.emptyDesc')}
            primaryAction={isAdmin ? <Link to="/create" className="btn btn-primary">{t('nav.createTournament')}</Link> : null}
            secondaryAction={
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                }}
              >
                {t('schedule.resetFilters')}
              </button>
            }
          />
        ) : (
          <>
            {showActiveTable && sortedActive.length > 0 && (
              <div className="schedule-section">
                <h2 className="schedule-section-title">{t('schedule.activeSection')}</h2>
                <div className="table-shell">
                  <table className="table-premium schedule-table schedule-table--premium">
                    <thead>
                      <tr>
                        <th>{t('schedule.name')}</th>
                        <th>{t('schedule.date')}</th>
                        <th>{t('schedule.registration')}</th>
                        <th>{t('home.format')}</th>
                        <th>{t('schedule.fee')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedActive.map((tournament) => {
                        const status = getTournamentStatus(tournament);
                        const id = getTournamentId(tournament);
                        const isMy = currentPlayerId && getMyRegistration(tournament, currentPlayerId);
                        const regDeadline = status === 'REG' ? getRegistrationDeadlineDisplay(tournament, t) : null;
                        return (
                          <tr key={id || tournament.name} className={isMy ? 'schedule-row--my' : undefined}>
                            <td>
                              <div className="tournament-name">
                                <Link to={id ? `/tournament/${id}` : '#'}>{tournament.name || '—'}</Link>
                                <StatusPill status={status} />
                              </div>
                            </td>
                            <td>
                              <span className="schedule-date-value table-number">{formatTournamentDate(tournament.date)}</span>
                            </td>
                            <td>
                              {regDeadline ? (
                                <div className="schedule-reg-block">
                                  <span className="schedule-reg-countdown table-number">{regDeadline.countdown}</span>
                                  <span className="schedule-reg-short">{regDeadline.shortDate}</span>
                                </div>
                              ) : (
                                <span className="schedule-reg-empty">—</span>
                              )}
                            </td>
                            <td>
                              <span className="schedule-format-chip">{tournament.type || '—'}</span>
                            </td>
                            <td>
                              <span className="table-number schedule-price">
                                {tournament.price != null ? `${tournament.price}₽` : '—'}
                              </span>
                            </td>
                            <td>
                              {id ? (
                                <Link className="table-action" to={`/tournament/${id}`}>→</Link>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showCompletedTable && sortedCompleted.length > 0 && (
              <div className="schedule-section">
                <h2 className="schedule-section-title">{t('schedule.finishedSection')}</h2>
                <div className="table-shell">
                  <table className="table-premium schedule-table schedule-table--premium">
                    <thead>
                      <tr>
                        <th>{t('schedule.name')}</th>
                        <th>{t('schedule.date')}</th>
                        <th>{t('home.format')}</th>
                        <th>{t('schedule.fee')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCompleted.map((tournament) => {
                        const id = getTournamentId(tournament);
                        const isMy = currentPlayerId && getMyRegistration(tournament, currentPlayerId);
                        return (
                          <tr key={id || tournament.name} className={`schedule-row--done${isMy ? ' schedule-row--my' : ''}`}>
                            <td>
                              <div className="tournament-name">
                                <Link to={id ? `/tournament/${id}` : '#'}>{tournament.name || '—'}</Link>
                                <StatusPill status="DONE" />
                              </div>
                            </td>
                            <td>
                              <span className="schedule-date-value table-number">{formatTournamentDate(tournament.date)}</span>
                            </td>
                            <td>
                              <span className="schedule-format-chip">{tournament.type || '—'}</span>
                            </td>
                            <td>
                              <span className="table-number schedule-price">
                                {tournament.price != null ? `${tournament.price}₽` : '—'}
                              </span>
                            </td>
                            <td>
                              {id ? (
                                <Link className="table-action" to={`/tournament/${id}`}>{t('schedule.results')}</Link>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
  );
}

export default Schedule;

