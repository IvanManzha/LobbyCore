import {
  CoverageInfo,
  MetricItem,
  PlayerStatsInput,
  PlayerStatsOptions,
  PlayerStatsResponse,
  PlayerStatsMeta,
  RawTournament,
  TournamentMode,
  NormalizedMatch
} from './types';
import {
  clamp,
  formatInteger,
  formatNumber,
  formatPercent,
  formatRatio,
  roundTo,
  safeDivide,
  thresholdsForFormat,
  isValidPlacement
} from './helpers';
import { extractPlayerMatchesFromTable, fallbackMatchFromHistory, getTournamentStatus, normalizeTournament } from './normalize';
import { computeCoverage } from './coverage';

const buildMetric = (
  id: string,
  label: string,
  value: number | null,
  displayValue: string,
  tooltip?: string,
  coverage?: CoverageInfo
): MetricItem => ({
  id,
  label,
  value,
  displayValue,
  tooltip,
  coverage
});

const resolveModeFilter = (modeFilter: PlayerStatsMeta['modeFilter']) => {
  if (!modeFilter || modeFilter === 'all') return null;
  return modeFilter;
};

const sortMatchesChronologically = (matches: NormalizedMatch[]) => {
  return [...matches].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    return a.roundIndex - b.roundIndex;
  });
};

const filterTournaments = (
  tournaments: RawTournament[],
  options: PlayerStatsOptions
) => {
  const modeFilter = resolveModeFilter(options.modeFilter || 'all');
  const includeLive = options.includeLive ?? false;
  const scope = options.scope || 'all_time';
  const year = options.year || null;

  return tournaments.filter((tournament) => {
    const status = getTournamentStatus(tournament.state);
    const mode = normalizeTournament(tournament, null).mode;

    if (modeFilter && mode !== modeFilter) return false;

    if (scope === 'live_only') return status === 'LIVE';
    if (scope === 'all_time' || scope === 'year') {
      if (status !== 'DONE' && !includeLive) return false;
    }

    if (year) {
      return typeof tournament.date === 'string' && tournament.date.startsWith(`${year}-`);
    }

    return true;
  });
};


const calcTopRates = (matches: NormalizedMatch[], mode: TournamentMode) => {
  const completed = matches.filter((match) => isValidPlacement(match.placement));
  if (completed.length === 0) {
    return {
      wins: 0,
      winRate: null,
      top3Rate: null,
      topRate: null,
      topRateLabel: 'Top-3'
    };
  }

  let wins = 0;
  let top3 = 0;
  let topRate = 0;
  let topRateLabel = 'Top-3';

  completed.forEach((match) => {
    const thresholds = thresholdsForFormat(match.participantsCount, mode);
    if (match.placement === 1) wins += 1;
    if (match.placement != null && match.placement <= thresholds.top3Count) top3 += 1;
    const isSmallLobby = match.participantsCount != null && match.participantsCount < 10;
    const topRateThreshold = isSmallLobby
      ? Math.max(1, Math.ceil((match.participantsCount || 0) * 0.5))
      : thresholds.top3Count;
    if (match.placement != null && match.placement <= topRateThreshold) {
      topRate += 1;
    }
    topRateLabel = isSmallLobby ? 'Top-50%' : `Top-${thresholds.top3Count}`;
  });

  const winRate = clamp((wins / completed.length) * 100, 0, 100);
  const top3Rate = clamp((top3 / completed.length) * 100, 0, 100);
  const topRateValue = clamp((topRate / completed.length) * 100, 0, 100);

  return {
    wins,
    winRate,
    top3Rate,
    topRate: topRateValue,
    topRateLabel
  };
};

const calcStability = (matches: NormalizedMatch[]) => {
  const completed = matches.filter((match) => isValidPlacement(match.placement) && match.participantsCount != null);
  if (completed.length === 0) return null;
  const stableMatches = completed.filter((match) => {
    const threshold = Math.max(1, Math.ceil((match.participantsCount || 0) * 0.3));
    return match.placement != null && match.placement <= threshold;
  }).length;

  return clamp((stableMatches / completed.length) * 100, 0, 100);
};

const calcPlacementDistribution = (matches: NormalizedMatch[]) => {
  const completed = matches.filter((match) => isValidPlacement(match.placement));
  if (completed.length === 0) return '—';

  let top3 = 0;
  let topX = 0;
  let other = 0;
  let topXLabel = 'Top-10';

  completed.forEach((match) => {
    const thresholds = thresholdsForFormat(match.participantsCount, match.mode);
    if (match.placement != null && match.placement <= thresholds.top3Count) {
      top3 += 1;
      return;
    }
    if (match.placement != null && match.placement <= thresholds.top10Count) {
      topX += 1;
      topXLabel = thresholds.top10Label;
      return;
    }
    other += 1;
    topXLabel = thresholds.top10Label;
  });

  return `1-${Math.min(3, completed.length)}: ${top3}, ${topXLabel}: ${topX}, Остальные: ${other}`;
};

const calcBestStreak = (matches: NormalizedMatch[]) => {
  const completed = sortMatchesChronologically(matches).filter((match) => isValidPlacement(match.placement));
  if (completed.length === 0) return null;
  let best = 0;
  let current = 0;
  completed.forEach((match) => {
    const thresholds = thresholdsForFormat(match.participantsCount, match.mode);
    if (match.placement != null && match.placement <= thresholds.top3Count) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return best || null;
};

export const buildPlayerStats = (
  playerName: string,
  input: PlayerStatsInput,
  options: PlayerStatsOptions = {}
): PlayerStatsResponse => {
  const scope = options.scope || 'all_time';
  const modeFilter = options.modeFilter || 'all';
  const year = options.year || null;

  const tournaments = filterTournaments(input.tournaments, options)
    .filter((tournament) => (tournament.id || tournament._id) !== 'HotDrop');  // <-- исключаем Hot Drop из статистики

  const matches = tournaments.flatMap((tournament) => {
    const table = input.tablesById[tournament.id || tournament._id || ''] || null;
    if (table) {
      const extracted = extractPlayerMatchesFromTable(playerName, tournament, table);
      if (extracted.length > 0) return extracted;
    }
    const historyEntry = (input.profile.history || []).find((entry) => entry.tournamentId === tournament.id);
    return fallbackMatchFromHistory(historyEntry, tournament);
  });

  const tournamentIds = new Set(tournaments.map((tournament) => tournament.id || tournament._id));
  const orphanHistory = (input.profile.history || []).filter((entry) => {
    if (!entry.tournamentId || tournamentIds.has(entry.tournamentId)) return false;
    if (entry.tournamentId === 'HotDrop') return false;  // <-- исключаем Hot Drop из статистики
    if (!year) return true;
    return typeof entry.date === 'string' && entry.date.startsWith(`${year}-`);
  });
  orphanHistory.forEach((entry) => {
    matches.push(...fallbackMatchFromHistory(entry, {
      id: entry.tournamentId,
      name: entry.tournamentName,
      date: entry.date,
      type: 'unknown',
      state: 'Турнир окончен'
    }));
  });

  const completedMatches = matches.filter((match) => isValidPlacement(match.placement));
  const matchesPlayed = completedMatches.length;
  const tournamentsPlayed = Array.from(new Set(matches.map((match) => match.tournamentId))).length;
  const tournamentsCompleted = Array.from(new Set(completedMatches.map((match) => match.tournamentId))).length;

  const places = completedMatches.map((match) => match.placement || 0);
  const avgPlace = roundTo(safeDivide(places.reduce((a, b) => a + b, 0), places.length) ?? null, 1);
  const bestPlace = places.length > 0 ? Math.min(...places) : null;

  const killsMatches = completedMatches.filter((match) => match.kills != null);
  const totalKills = killsMatches.reduce((sum, match) => sum + (match.kills || 0), 0);
  const avgKills = roundTo(safeDivide(totalKills, killsMatches.length) ?? null, 1);
  const bestKills = killsMatches.length > 0 ? Math.max(...killsMatches.map((match) => match.kills || 0)) : null;

  const deathsMatches = completedMatches.filter((match) => match.deaths != null);
  const totalDeaths = deathsMatches.reduce((sum, match) => sum + (match.deaths || 0), 0);
  // K/D считается только если deaths были треканы хотя бы в одном матче
  const kdValue = deathsMatches.length === 0
    ? null  // Если deaths вообще не трекались, K/D = null
    : totalDeaths === 0
      ? (totalKills > 0 ? Infinity : null)  // Если deaths трекались, но все = 0, и есть kills, то Infinity
      : safeDivide(totalKills, totalDeaths);

  const pointsMatches = completedMatches.filter((match) => match.points != null);
  const avgPoints = roundTo(safeDivide(pointsMatches.reduce((sum, match) => sum + (match.points || 0), 0), pointsMatches.length) ?? null, 1);

  const modeForRates = completedMatches[0]?.mode || 'unknown';
  const { winRate, top3Rate, topRate, topRateLabel } = calcTopRates(completedMatches, modeForRates);

  const stability = calcStability(completedMatches);
  const placementDistribution = calcPlacementDistribution(completedMatches);
  const bestTop3Streak = calcBestStreak(completedMatches);

  const coverage = computeCoverage(matches);

  const dnaRating = input.profile.dna_rating ?? null;
  const ratingTooltip = 'DNA-рейтинг: рассчитывается по 8 генам (accuracy, tactics, aggression, survival, positioning, teamwork, resource, composure), сохраняется после каждого турнира';

  const coreMetrics: MetricItem[] = [
    buildMetric(
      'rating',
      'Rating',
      dnaRating,
      formatInteger(dnaRating),
      ratingTooltip
    ),
    buildMetric(
      'tournaments_played',
      'Tournaments played',
      tournamentsPlayed,
      formatInteger(tournamentsPlayed),
      'Количество турниров с хотя бы одним учтённым матчем'
    ),
    buildMetric(
      'matches_played',
      'Matches played',
      matchesPlayed,
      formatInteger(matchesPlayed),
      'Общее количество завершённых матчей (с известным местом)'
    ),
    buildMetric(
      'avg_place',
      'Avg place',
      avgPlace,
      formatNumber(avgPlace, 1),
      'Среднее место по всем завершённым матчам (чем меньше, тем лучше)'
    ),
    buildMetric(
      'kills_per_match',
      'Kills / Match',
      avgKills,
      formatNumber(avgKills, 1),
      'Среднее количество киллов за матч (считается только по матчам, где киллы были учтены)',
      coverage.kills.totalMatches > 0 && coverage.kills.trackedMatches < coverage.kills.totalMatches
        ? coverage.kills
        : undefined
    ),
    buildMetric(
      'winrate',
      'Winrate',
      winRate,
      formatPercent(winRate),
      'Процент побед (1 место) от общего числа завершённых матчей'
    ),
    buildMetric(
      'top_rate',
      topRateLabel,
      topRate,
      formatPercent(topRate),
      `Процент матчей, где игрок попал в ${topRateLabel} (адаптируется для малых лобби)`
    ),
    buildMetric(
      'kd',
      'K/D',
      kdValue ?? null,
      formatRatio(kdValue ?? null),
      deathsMatches.length > 0 
        ? 'Отношение киллов к смертям (считается только по матчам, где смерти были учтены)' 
        : 'Недостаточно данных о смертях для расчёта K/D',
      coverage.deaths.totalMatches > 0 && coverage.deaths.trackedMatches < coverage.deaths.totalMatches
        ? coverage.deaths
        : undefined
    )
  ];

  const secondaryMetrics: MetricItem[] = [
    buildMetric(
      'best_place',
      'Best place',
      bestPlace,
      formatInteger(bestPlace),
      'Лучшее место за период'
    ),
    buildMetric(
      'best_kills',
      'Best kills (match)',
      bestKills,
      formatInteger(bestKills),
      'Максимум киллов в одном матче'
    ),
    buildMetric(
      'avg_points',
      'Avg points / Match',
      avgPoints,
      formatNumber(avgPoints, 1),
      'Средние очки за матч'
    ),
    buildMetric(
      'placement_distribution',
      'Placement distribution',
      null,
      placementDistribution,
      'Распределение мест по матчам'
    ),
    buildMetric(
      'stability',
      'Stability',
      stability,
      formatPercent(stability),
      'Стабильность = доля матчей в верхних 30% таблицы'
    ),
    buildMetric(
      'top3_streak',
      'Top-3 streak',
      bestTop3Streak,
      formatInteger(bestTop3Streak),
      'Лучшая серия попаданий в Top-3'
    )
  ];

  const recentMatches = sortMatchesChronologically(completedMatches).slice(-5);
  const formItems = recentMatches.map((match) => {
    const thresholds = thresholdsForFormat(match.participantsCount, match.mode);
    return {
      placement: match.placement || 0,
      isTop: match.placement != null && match.placement <= thresholds.top3Count
    };
  });

  const meta: PlayerStatsMeta = {
    scope,
    year,
    modeFilter,
    matchesPlayed,
    tournamentsPlayed,
    tournamentsCompleted,
    hasData: matchesPlayed > 0
  };

  return {
    core: coreMetrics,
    secondary: secondaryMetrics,
    coverage,
    formLast5: {
      items: formItems,
      tooltip: 'Последние 5 матчей, подсвечены попадания в Top-3'
    },
    ratingBreakdown: null,
    meta
  };
};
