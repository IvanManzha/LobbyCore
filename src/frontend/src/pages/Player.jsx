import React, { useState, useEffect, useCallback, useMemo, useRef, useTransition, Suspense, lazy } from 'react';
import { useParams, Link } from 'react-router-dom';
import { playerApi, tournamentApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useLayoutConfig } from '../contexts/LayoutConfigContext';
const RatingChart = lazy(() => import('../components/RatingChart'));
import MetricGrid from '../components/MetricGrid';
import ChampionshipsAwardCard from '../components/profile/ChampionshipsAwardCard';
import InsightsPanel from '../components/InsightsPanel';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import StatusPill from '../components/StatusPill';
import { getRatingSeries } from '../stats/getRatingSeries';
import { getBestTournament, getTrends, getContributionBreakdown, getCoverage, getConsistency } from '../stats/getInsights';
import { useTranslation } from '../contexts/LanguageContext';
import { isSteamAuthEnabled } from '../config/featureFlags';
import DnaTierBadge from "../components/dna-lab/DnaTierBadge";
import './Player.css';

function Player() {
  const { name } = useParams();
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  /** Кэш статистики по годам: { '2025': statsData, '2026': statsData } — переключение года без повторной загрузки */
  const [statsByYear, setStatsByYear] = useState(() => ({}));
  const [tournaments, setTournaments] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const defaultAdmin = 'ivanchk';
  const adminUsers = (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = user && adminUsers.includes(((user.pubgNick || user.username) || '').toLowerCase());
  const [showCharts, setShowCharts] = useState(false);
  const [ratingSeries, setRatingSeries] = useState(null);
  const [isHistoryDesc, setIsHistoryDesc] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isLoadingYearStats, setIsLoadingYearStats] = useState(false);
  const [championships, setChampionships] = useState(null);
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
  const getHistoryForYear = useCallback((profileData, year) => {
    if (!profileData) return [];
    if (!year) return profileData.history || [];
    const snapshotHistory = profileData.yearSnapshots?.[year]?.history;
    if (Array.isArray(snapshotHistory)) {
      return snapshotHistory;
    }
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return (profileData.history || []).filter(entry => {
      if (!entry.date) return false;
      return entry.date >= yearStart && entry.date <= yearEnd;
    });
  }, []);

  const loadPlayerData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const decodedName = decodeURIComponent(name);

      let profileData;
      try {
        profileData = await playerApi.getProfile(decodedName);
        if (!profileData) {
          throw new Error('Profile not found');
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError(`Игрок "${decodedName}" не найден`);
          setLoading(false);
          return;
        }
        throw err;
      }

      setProfile(profileData);

      const statsIdentifier = profileData.username || decodedName;
      let yearsData = [];
      try {
        yearsData = await playerApi.getAvailableYears(statsIdentifier);
      } catch (err) {
        console.warn('Не удалось загрузить доступные годы:', err);
        if (profileData.history && profileData.history.length > 0) {
          const years = new Set();
          profileData.history.forEach(entry => {
            if (entry.date) {
              const year = entry.date.split('-')[0];
              if (year) years.add(year);
            }
          });
          yearsData = Array.from(years).sort((a, b) => b.localeCompare(a));
        }
      }

      const fallbackYears = ['2026', '2025'];
      const safeYears = Array.isArray(yearsData) ? yearsData : [];
      const mergedYears = Array.from(new Set([...safeYears, ...fallbackYears]))
        .sort((a, b) => b.localeCompare(a));
      setAvailableYears(mergedYears);

      // Устанавливаем год только если он еще не установлен; грузим статистику в кэш по году
      if (mergedYears.length > 0 && !selectedYear) {
        const currentYear = new Date().getFullYear().toString();
        const yearToSelect = mergedYears.includes(currentYear) ? currentYear : mergedYears[0];
        setSelectedYear(yearToSelect);
        try {
          const statsData = await playerApi.getStats(statsIdentifier, yearToSelect);
          setStatsByYear((prev) => ({ ...prev, [yearToSelect]: statsData }));
        } catch (err) {
          console.warn('Не удалось загрузить статистику:', err);
          setStatsByYear((prev) => ({ ...prev, [yearToSelect]: buildEmptyStats() }));
        }
      } else if (mergedYears.length === 0) {
        setStatsByYear({});
      }

      try {
        const tournamentsData = await tournamentApi.getAll();
        setTournaments(tournamentsData);
      } catch (err) {
        console.warn('Не удалось загрузить турниры:', err);
        setTournaments([]);
      }

      try {
        const ch = await playerApi.getChampionships(statsIdentifier);
        setChampionships(ch);
      } catch (err) {
        setChampionships(null);
      }

    } catch (err) {
      console.error('Ошибка загрузки данных игрока:', err);
      setError(err.response?.data?.error || err.message || t('playerPage.loadError'));
      setProfile(null);
      setStatsByYear({});
    } finally {
      setLoading(false);
    }
  }, [name]); // Убрали selectedYear из зависимостей, чтобы избежать циклов

  // Ref: для какого года сейчас показываем загрузку (чтобы не сбрасывать при приходе ответа за другой год)
  const loadingForYearRef = useRef(null);

  useEffect(() => {
    if (name) {
      setProfile(null);
      setStatsByYear({});
      setChampionships(null);
      setAvailableYears([]);
      setSelectedYear(null);
      setError(null);
      loadingForYearRef.current = null;
    }
    loadPlayerData();
  }, [name, loadPlayerData]);

  // Загрузка статистики при смене года: только если для этого года ещё нет кэша
  useEffect(() => {
    if (!selectedYear || !profile || !name) return;
    const decodedName = decodeURIComponent(name);
    const statsIdentifier = profile?.username || decodedName;

    // Уже есть данные по выбранному году — показываем сразу, без загрузки
    if (statsByYear[selectedYear] != null) {
      setIsLoadingYearStats(false);
      loadingForYearRef.current = null;
      return;
    }

    const requestedYear = selectedYear;
    loadingForYearRef.current = requestedYear;
    setIsLoadingYearStats(true);

    playerApi.getStats(statsIdentifier, requestedYear)
      .then((data) => {
        setStatsByYear((prev) => ({ ...prev, [requestedYear]: data }));
        if (requestedYear === loadingForYearRef.current && data.championships) {
          setChampionships(data.championships);
        }
      })
      .catch((err) => {
        console.warn('Не удалось загрузить статистику:', err);
        setStatsByYear((prev) => ({ ...prev, [requestedYear]: buildEmptyStats() }));
      })
      .finally(() => {
        if (requestedYear === loadingForYearRef.current) {
          setIsLoadingYearStats(false);
          loadingForYearRef.current = null;
        }
      });
  }, [selectedYear, profile, name, statsByYear]);

  // Мемоизируем отфильтрованную историю для оптимизации
  const history = useMemo(() => {
    if (!profile) return [];
    // getHistoryForYear уже фильтрует по году, не нужно фильтровать дважды
    const historyForYear = getHistoryForYear(profile, selectedYear);
    return [...historyForYear];
  }, [profile, selectedYear, getHistoryForYear]);

  const getTournamentStatus = (tournament) => {
    if (!tournament) return 'REG';
    if (tournament.state === 'В процессе') return 'LIVE';
    if (tournament.state === 'Турнир окончен' || tournament.state === 'DONE') return 'DONE';
    return 'REG';
  };

  const tournamentStatusMap = useMemo(() => {
    return new Map(
      (tournaments || []).map((tournament) => [
        tournament?.id || tournament?._id,
        getTournamentStatus(tournament)
      ])
    );
  }, [tournaments]);

  // Отсортированная история по дате
  const sortedHistory = useMemo(() => {
    const items = [...history];
    items.sort((a, b) => {
      const aDate = a.date || '';
      const bDate = b.date || '';

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      if (isHistoryDesc) {
        return bDate.localeCompare(aDate);
      }
      return aDate.localeCompare(bDate);
    });
    return items;
  }, [history, isHistoryDesc]);

  const profileForYear = useMemo(() => {
    if (!profile) return null;
    const historyForYear = getHistoryForYear(profile, selectedYear);
    const snapshot = selectedYear ? profile.yearSnapshots?.[selectedYear] : null;
    if (!snapshot) {
      return { ...profile, history: historyForYear };
    }
    return {
      ...profile,
      history: Array.isArray(snapshot.history) ? snapshot.history : historyForYear,
      effectiveRating: snapshot.effectiveRating ?? profile.effectiveRating,
      rating: snapshot.rating ?? profile.rating,
      ratingHistory: snapshot.ratingHistory ?? profile.ratingHistory,
      calibrating: snapshot.calibrating ?? profile.calibrating,
      longAnchor: snapshot.longAnchor ?? profile.longAnchor
    };
  }, [profile, selectedYear, getHistoryForYear]);

  // Загрузка данных для графика рейтинга
  useEffect(() => {
    if (!profileForYear || !tournaments) {
      setRatingSeries(null);
      return;
    }

    try {
      const series = getRatingSeries(profileForYear, tournaments, { year: selectedYear });
      setRatingSeries(series);
    } catch (error) {
      console.error('Ошибка подготовки данных графика:', error);
      setRatingSeries(null);
    }
  }, [profileForYear, tournaments, selectedYear]);

  const statsForYear = (selectedYear && statsByYear[selectedYear]) || buildEmptyStats();
  const hasMatches = statsForYear.meta.matchesPlayed > 0;
  const displayChampionships = (selectedYear && statsByYear[selectedYear]?.championships) ?? championships;

  // Расчет INSIGHTS (синхронные, мемоизированные)
  const insightsData = useMemo(() => {
    if (!statsForYear || !profileForYear || !tournaments || !hasMatches) {
      return null;
    }

    try {
      return {
        bestTournament: getBestTournament(profileForYear.history, tournaments),
        trends: getTrends(profileForYear, 5),
        breakdown: getContributionBreakdown(profileForYear.history, statsForYear),
        coverage: getCoverage(statsForYear),
        consistency: getConsistency(profileForYear.history, statsForYear)
      };
    } catch (error) {
      console.error('Ошибка расчета INSIGHTS:', error);
      return null;
    }
  }, [statsForYear, profileForYear, tournaments, hasMatches]);

  const getMetric = (id, fallbackLabel) => {
    return statsForYear.core?.find((item) => item.id === id) || {
      label: fallbackLabel || id,
      displayValue: '—',
      tooltip: t('playerPage.insufficientData')
    };
  };
  const tournamentsMetric = getMetric('tournaments_played', t('playerPage.tournamentsSection'));

  const asideContent = useMemo(() => {
    if (!profile) return null;
    return (
      <div className="profile-aside">
        {/* A) Award block: титул «Чемпионства» — визуально отделён от метрик */}
        <div className="profile-aside-block profile-aside-block--award">
          <ChampionshipsAwardCard championships={displayChampionships} />
        </div>
        {/* B) KPI section: обычные метрики */}
        {selectedYear && (statsByYear[selectedYear] != null || isLoadingYearStats) && (
          <div className="profile-aside-block profile-aside-block--kpi">
            <div className="section-title-small">{t('playerPage.metrics')}</div>
            <MetricGrid
              items={[
                getMetric('tournaments_played', t('playerPage.tournamentsSection')),
                getMetric('matches_played', t('playerPage.matchesPlayed', 'Матчи')),
                getMetric('avg_place', 'Avg place'),
                { ...getMetric('kills_per_match', 'Kills/Match'), coverage: statsForYear.coverage.kills },
                getMetric('winrate', 'Winrate'),
                getMetric('top_rate', 'Top')
              ]}
            />
          </div>
        )}
      </div>
    );
  }, [
    displayChampionships,
    isLoadingYearStats,
    profile,
    selectedYear,
    statsByYear,
    statsForYear,
    t
  ]);

  const championshipsTotal = displayChampionships?.total ?? 0;

  const layoutConfig = useMemo(
    () => ({ showInfoSidebar: true, asideContent }),
    [asideContent]
  );
  useLayoutConfig(layoutConfig, [
    profile?.username ?? '',
    selectedYear ?? '',
    !!statsForYear?.meta?.hasData,
    displayChampionships?.total ?? 0
  ]);

  if (loading) {
    return (
      <div className="player-profile">
        <div className="profile-header">
          <Skeleton height={48} width="240px" />
          <Skeleton height={32} width="120px" />
        </div>
        <Skeleton height={220} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={() => window.history.back()}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="error">
        <p>{t('playerPage.notFound')}</p>
        <button className="btn btn-secondary" onClick={() => window.history.back()}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="player-profile">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-header-left">
            <div className="profile-avatar">{(profile.pubgNick || profile.username || '?').charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="profile-header-title">
                {profile.pubgNick || profile.username}
                {championshipsTotal > 0 && (
                  <span className="profile-header-champion-badge" title={t('playerPage.championTitle')}>
                    🏆 {championshipsTotal}× Champion
                  </span>
                )}
              </h1>
              {profile.username && profile.pubgNick && profile.username !== profile.pubgNick && (
                <div className="muted">{t('playerPage.loginLabel')}: {profile.username}</div>
              )}
              <div className="profile-badges">
                {availableYears.length > 1 && (
                  <select
                    className="year-badge"
                    value={selectedYear || ''}
                    onChange={(e) => {
                      const newYear = e.target.value;
                      // Предотвращаем повторную загрузку если год не изменился
                      if (newYear !== selectedYear) {
                        startTransition(() => {
                          setSelectedYear(newYear);
                        });
                      }
                    }}
                    disabled={isPending || isLoadingYearStats}
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
<span className="profile-badge">
                {t('playerPage.tournamentsSection')}: {tournamentsMetric?.displayValue || '—'}
              </span>
              </div>
            </div>
          </div>
          <div className="profile-header-right">
            {isSteamAuthEnabled && profile.steam && (
              <a
                href={profile.steam.profileUrl || `https://steamcommunity.com/profiles/${profile.steam.steamId64}`}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-steam-icon"
                title={profile.steam.personaName ? `Steam: ${profile.steam.personaName}` : 'Steam'}
                aria-label="Steam profile"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l4.432 2.758c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.03 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.91c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.9c.262.543.714.9 1.314.9.93 0 1.685-.756 1.685-1.69 0-.93-.755-1.685-1.684-1.685-.93 0-1.69.755-1.69 1.684 0 .6.357 1.052.9 1.314l-.9 1.473c-.075-.045-.15-.09-.224-.135z"/>
                </svg>
              </a>
            )}
            {/* Hierarchy: Ladder (main competitive) → Archetype → DNA Lab link */}
            <div className="profile-ladder-block">
              <div className="profile-ladder-value">
                {profile.ladder_rating != null ? profile.ladder_rating : '—'}
                {profile.ladder_rank_label && (
                  <span className={`profile-ladder-rank profile-ladder-rank--${(profile.ladder_rank_label || '').toLowerCase()}`}>
                    {' '}{profile.ladder_rank_label}
                  </span>
                )}
              </div>
              {profile.ladder_last_delta != null && (
                <div className="profile-ladder-label">
                  <span className={profile.ladder_last_delta >= 0 ? 'profile-ladder-delta--pos' : 'profile-ladder-delta--neg'}>
                    Last: {profile.ladder_last_delta >= 0 ? '+' : ''}{profile.ladder_last_delta}
                  </span>
                </div>
              )}
              {profile.ladder_last_breakdown && (
                <div className="profile-ladder-breakdown" title={t('playerPage.ladderBreakdownTooltip')}>
                  <span className="profile-ladder-breakdown-text">
                    {profile.ladder_last_breakdown.ladder_before} → {profile.ladder_last_breakdown.ladder_after}
                    {profile.ladder_last_breakdown.delta != null && (
                      <span className={profile.ladder_last_breakdown.delta >= 0 ? 'profile-ladder-delta--pos' : 'profile-ladder-delta--neg'}>
                        {' '}({profile.ladder_last_breakdown.delta >= 0 ? '+' : ''}{profile.ladder_last_breakdown.delta})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
            {profile.dominant_trait && (
              <div className="profile-archetype-block">
                <div className="profile-archetype-value">
                  {profile.dominant_trait}
                  {profile.dnaTier != null && (
                    <span className="profile-dna-tier-badge">
                      <DnaTierBadge tier={profile.dnaTier} />
                    </span>
                  )}
                </div>
                <div className="profile-archetype-label">
                  {t('playerPage.archetype')}
                </div>
              </div>
            )}
            <Link to="/dna-lab" className="profile-dna-lab-link">
              {t('playerPage.dnaLabLink')}
            </Link>
          </div>
        </div>

        {!hasMatches ? (
          <div className="profile-section">
            <EmptyState
              title={t('playerPage.noMatchesInSeason')}
              description={t('playerPage.noMatchesDesc')}
              primaryAction={<Link className="btn btn-primary" to="/tournaments">{t('playerPage.viewTournaments')}</Link>}
              secondaryAction={isAdmin ? <Link className="btn btn-secondary" to="/create">{t('playerPage.createTournament')}</Link> : null}
            />
          </div>
        ) : (
          <>
            <div className="profile-section">
              <div className="section-header">
                <h2>{t('playerPage.progressChart')}</h2>
                {ratingSeries && (
                  <button
                    className="btn btn-ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      startTransition(() => {
                        setShowCharts(prev => !prev);
                      });
                    }}
                    disabled={isPending}
                  >
                    {isPending ? t('common.loading') : (showCharts ? t('playerPage.hideChart') : t('playerPage.showChart'))}
                  </button>
                )}
              </div>
              {ratingSeries ? (
                showCharts && (
                  <Suspense fallback={<Skeleton height={400} />}>
                    <RatingChart data={ratingSeries} loading={isLoadingYearStats} />
                  </Suspense>
                )
              ) : (
                !showCharts && (
                  <EmptyState
                    title={t('playerPage.noDataChart')}
                    description={t('playerPage.noDataChartDesc')}
                  />
                )
              )}
            </div>

            {insightsData && (
              <div className="profile-section">
                <InsightsPanel insightsData={insightsData} />
              </div>
            )}
          </>
        )}

        <div className="profile-section">
          <div className="section-header">
            <h2>{t('playerPage.tournamentsSection')}</h2>
          </div>
          {sortedHistory.length > 0 ? (
            <div className="table-shell">
              <table className="table-premium profile-tournaments-table">
                <thead>
                  <tr>
                    <th>{t('playerPage.tournament')}</th>
                    <th
                      className="sortable"
                      onClick={() => setIsHistoryDesc(prev => !prev)}
                    >
                      {t('home.date')} {isHistoryDesc ? '▼' : '▲'}
                    </th>
                    <th>{t('playerPage.place')}</th>
                    <th>{t('playerPage.points')}</th>
                    <th>{t('playerPage.kills')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortedHistory.map((entry, index) => {
                    const status = tournamentStatusMap.get(entry.tournamentId);
                    const tournamentLink = entry.tournamentId
                      ? `/tournament/${entry.tournamentId}`
                      : null;
                    const killsValue = entry.personalKills;
                    let killsCell = null;
                    if (typeof killsValue === 'number') {
                      killsCell = (
                        <span className="table-number">{killsValue}</span>
                      );
                    } else if (killsValue == null || killsValue === '-') {
                      killsCell = <span className="muted">—</span>;
                    } else {
                      killsCell = (
                        <span className="no-data-badge">No kills data</span>
                      );
                    }

                    return (
                      <tr key={entry.tournamentId || `${entry.tournamentName}-${index}`}>
                        <td>
                          <div className="history-tournament">
                            {tournamentLink ? (
                              <Link to={tournamentLink}>
{entry.tournamentName || t('playerPage.tournament')}
                            </Link>
                          ) : (
                            <span>{entry.tournamentName || t('playerPage.tournament')}</span>
                          )}
                          {status === 'LIVE' && <StatusPill status="LIVE" />}
                          {entry.tournamentId === 'HotDrop' && (
                            <span className="rating-excluded-badge" title={t('playerPage.ratingExcludedTooltip')}>
                              {t('playerPage.ratingExcluded')}
                            </span>
                          )}
                          </div>
                        </td>
                        <td>
                          <span className="table-number">
                            {entry.date || '—'}
                          </span>
                        </td>
                        <td>
                          <span className="table-number">
                            {typeof entry.place === 'number' ? entry.place : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="table-number">
                            {typeof entry.points === 'number' ? entry.points : '—'}
                          </span>
                        </td>
                        <td>{killsCell}</td>
                        <td>
                          {entry.tournamentId && (
                            <Link
                              className="table-action"
                              to={`/tournament/${entry.tournamentId}`}
                            >
                              →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted">{t('playerPage.noTournamentsPlayed')}</div>
          )}
        </div>
      </div>
  );
}

export default Player;
