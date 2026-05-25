import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { tournamentApi, playerApi, subscribeToUpdates } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { DEVELOPERS } from '../config/app';
import { useLayoutConfigSetter } from '../contexts/LayoutConfigContext';
import { useTranslation } from '../contexts/LanguageContext';
import ActivityFeed from '../components/ActivityFeed';
import MissionControl from '../components/MissionControl';
import EmptyState from '../components/EmptyState';
import StatusPill from '../components/StatusPill';
import RowList, { DataRow } from '../components/RowList';
import Skeleton from '../components/Skeleton';
import './Home.css';

function Home() {
  const [activeTournament, setActiveTournament] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [playerStats, setPlayerStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const defaultAdmin = 'ivanchk';
  const adminUsers = (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = user && adminUsers.includes(((user.pubgNick || user.username) || '').toLowerCase());
  const isDeveloper = useMemo(() => {
    if (!user) return false;
    const userKey = (user.pubgNick || user.username || '').toLowerCase();
    return DEVELOPERS.length > 0 && DEVELOPERS.includes(userKey);
  }, [user]);
  const buildEmptyStats = () => ({
    core: [],
    secondary: [],
    coverage: {
      kills: { trackedMatches: 0, totalMatches: 0, label: '' },
      deaths: { trackedMatches: 0, totalMatches: 0, label: '' },
      kd: { trackedMatches: 0, totalMatches: 0, label: '' }
    },
    formLast5: { items: [], tooltip: '' },
    ratingBreakdown: null,
    meta: {
      scope: 'year',
      year: null,
      modeFilter: 'all',
      matchesPlayed: 0,
      tournamentsPlayed: 0,
      tournamentsCompleted: 0,
      hasData: false
    }
  });

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToUpdates(() => {
      loadData();
    });
    const onTournamentUpdated = () => loadData();
    window.addEventListener('tournament-updated', onTournamentUpdated);
    return () => {
      unsubscribe();
      window.removeEventListener('tournament-updated', onTournamentUpdated);
    };
  }, [user]);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      loadData();
    }
  }, [location.pathname]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем активный турнир
      try {
        const active = await tournamentApi.getActive();
        setActiveTournament(active);
      } catch (err) {
        setActiveTournament(null);
      }

      // Загружаем все турниры
      const allTournaments = await tournamentApi.getAll();
      setTournaments(allTournaments);

      // Загружаем статистику и профиль игрока
      if (user) {
        const name = user.pubgNick || user.username;
        try {
          let yearsData = [];
          try {
            yearsData = await playerApi.getAvailableYears(name);
          } catch (err) {
            console.warn('Не удалось загрузить доступные периоды:', err);
          }

          const fallbackYears = ['2026', '2025'];
          const safeYears = Array.isArray(yearsData) ? yearsData : [];
          const mergedYears = Array.from(new Set([...safeYears, ...fallbackYears]))
            .sort((a, b) => b.localeCompare(a));
          setAvailableYears(mergedYears);

          const currentYear = new Date().getFullYear().toString();
          const yearToUse = selectedYear && mergedYears.includes(selectedYear)
            ? selectedYear
            : (mergedYears.includes(currentYear) ? currentYear : mergedYears[0]);

          setSelectedYear(yearToUse);
          const [stats, profileData] = await Promise.all([
            playerApi.getStats(name, yearToUse),
            playerApi.getProfile(name).catch(() => null),
          ]);
          setPlayerStats(stats);
          setProfile(profileData);
        } catch (err) {
          console.warn('Не удалось загрузить статистику игрока');
          setPlayerStats(buildEmptyStats());
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
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
  const getYearFromDate = (date) => (typeof date === 'string' ? date.split('-')[0] : null);
  const statsForYear = playerStats || buildEmptyStats();
  const userResultByTournamentId = useMemo(() => {
    const map = {};
    if (!profile?.history || !Array.isArray(profile.history)) return map;
    for (const e of profile.history) {
      const id = e.tournamentId ?? e.tournament_id;
      if (id) map[id] = { place: e.place, points: e.points };
    }
    return map;
  }, [profile]);
  const hasMatches = statsForYear.meta.matchesPlayed > 0;
  const getMetric = (id) => statsForYear.core?.find((item) => item.id === id);
  const ratingMetric = getMetric('rating');
  const winRateMetric = getMetric('winrate');
  const killsMetric = getMetric('kills_per_match');
  const topRateMetric = getMetric('top_rate');
  const matchesMetric = getMetric('matches_played');
  const recentResults = statsForYear.formLast5?.items || [];
  const ratingTooltip = 'DNA-рейтинг: рассчитывается по 8 генам, сохраняется после каждого турнира';

  const firstTournamentId = tournaments.length > 0 ? getTournamentId(tournaments[0]) : null;
  const activities = useMemo(() => ([
    { id: '1', time: '2 мин назад', text: 'Добавлен результат матча #3', href: firstTournamentId ? `/tournament/${firstTournamentId}` : '/tournaments' },
    { id: '2', time: '15 мин назад', text: 'Команда X поднялась на 2 позиции ↑2', href: '/tournaments' },
    { id: '3', time: '1 час назад', text: 'Завершён турнир Y — победитель …', href: '/tournaments' },
  ]), [firstTournamentId]);

  const headerAction = useMemo(() => (
    isAdmin ? (
      <Link to="/create" className="btn btn-primary">
        Создать турнир
      </Link>
    ) : null
  ), [isAdmin]);

  const handleYearChange = async (year) => {
    setSelectedYear(year);
    if (!user) return;
    try {
    const stats = await playerApi.getStats(user.pubgNick || user.username, year);
      setPlayerStats(stats);
    } catch (err) {
      console.warn('Не удалось загрузить статистику игрока');
      setPlayerStats(buildEmptyStats());
    }
  };

  const hasTournaments = tournaments.length > 0;

  const asideContent = useMemo(() => (
    <div className="aside-stack">
      <ActivityFeed activities={activities} />
    </div>
  ), [activities]);
  const setLayoutConfig = useLayoutConfigSetter();
  useEffect(() => {
    if (setLayoutConfig && !loading) {
      setLayoutConfig({ headerAction: hasTournaments && headerAction ? headerAction : null, asideContent });
    }
  }, [loading, hasTournaments, headerAction, asideContent, setLayoutConfig]);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="panel mission-control-skeleton">
          <Skeleton height={24} width="200px" />
          <Skeleton height={16} width="70%" />
          <Skeleton height={42} width="160px" />
        </div>
        <div className="tournaments-list">
          <Skeleton height={18} width="140px" />
          <Skeleton height={120} />
        </div>
      </div>
    );
  }

  const tournamentsForYear = selectedYear
    ? tournaments.filter((tournament) => getYearFromDate(tournament.date) === selectedYear)
    : tournaments;
  const sortedTournaments = [...tournamentsForYear].sort((a, b) => new Date(b.date) - new Date(a.date));
  const hasTournamentsForYear = sortedTournaments.length > 0;

  const showHeaderPrimary = Boolean(hasTournaments && headerAction);

  return (
    <div className="dashboard">
        <MissionControl
          tournaments={tournaments}
          activeTournament={activeTournament}
          isAdmin={isAdmin}
          getTournamentStatus={getTournamentStatus}
          getTournamentId={getTournamentId}
          canEditTournament={isDeveloper}
          canDeleteTournament={isAdmin}
        />

        {isAuthenticated && playerStats && hasMatches && (
          <div className="panel summary-panel">
            <div className="summary-left">
              <div className="summary-label">
                {t('home.rating')}
                <span className="metric-tooltip" title={ratingTooltip} aria-label={ratingTooltip}>
                  i
                </span>
              </div>
              <div className="summary-value-large">{ratingMetric?.displayValue || '—'}</div>
              {availableYears.length > 1 && (
                <select
                  className="summary-year"
                  value={selectedYear}
                  onChange={(event) => handleYearChange(event.target.value)}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="summary-center">
              <div className="summary-stat">
                <div className="summary-stat-label">{t('home.winrate')}</div>
                <div className="summary-stat-value">{winRateMetric?.displayValue || '—'}</div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-label">{t('home.killsMatch')}</div>
                <div className="summary-stat-value">
                  {killsMetric?.displayValue || '—'}
                  {statsForYear.coverage?.kills?.totalMatches > 0 &&
                    statsForYear.coverage.kills.trackedMatches < statsForYear.coverage.kills.totalMatches && (
                      <span className="coverage-badge" title={statsForYear.coverage.kills.label}>
                        !
                      </span>
                  )}
                </div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-label">{topRateMetric?.label || 'Top'}</div>
                <div className="summary-stat-value">{topRateMetric?.displayValue || '—'}</div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-label">{t('home.matches')}</div>
                <div className="summary-stat-value">{matchesMetric?.displayValue || '—'}</div>
              </div>
            </div>
            <div className="summary-right">
              <div className="summary-label">{t('home.last5')}</div>
              {recentResults.length > 0 ? (
                <div className="summary-streak">
                  {recentResults.map((entry, idx) => (
                    <span
                      key={`${entry.placement}-${idx}`}
                      className={`streak-dot ${entry.isTop ? 'win' : 'loss'}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="muted">{t('home.noGames')}</div>
              )}
            </div>
          </div>
        )}

        <div className="dashboard-main">
          {hasTournaments && (
            <div className="tournaments-list">
              <div className="section-header">
                <h3>{t('home.recentTournaments')}</h3>
                <Link to="/tournaments" className="btn btn-ghost">{t('home.allTournaments')}</Link>
              </div>
              {hasTournamentsForYear ? (
                <RowList headers={[t('home.viewTournament'), t('home.date'), t('home.format'), t('home.status')]}>
                  {sortedTournaments.slice(0, 5).map((tournament) => {
                    const tid = getTournamentId(tournament);
                    const userResult = userResultByTournamentId[tid];
                    const yourResultStr = userResult
                      ? [userResult.place != null && `${userResult.place} ${t('home.place')}`, userResult.points != null && `${userResult.points} ${t('home.points')}`]
                        .filter(Boolean)
                        .join(', ')
                      : null;
                    const nameCol = (
                      <span key="name" className="tournament-row-name">
                        {tournament.name}
                        {yourResultStr && (
                          <span className="tournament-row-your-result">{yourResultStr}</span>
                        )}
                      </span>
                    );
                    const status = getTournamentStatus(tournament);
                    return (
                      <DataRow
                        key={tid}
                        columns={[
                          nameCol,
                          tournament.date,
                          tournament.type,
                          <StatusPill key="status" status={status} />
                        ]}
                        action={status === 'DONE' ? t('home.results') : '→'}
                        to={`/tournament/${tid}`}
                        rowClassName={status === 'DONE' ? 'row--done' : ''}
                      />
                    );
                  })}
                </RowList>
              ) : (
                <div className="tournaments-list-empty">
                  <EmptyState
                    title={t('home.noTournamentsForPeriod')}
                    primaryAction={<Link className="btn btn-primary" to="/tournaments">{t('home.tournamentList')}</Link>}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
}

export default Home;
