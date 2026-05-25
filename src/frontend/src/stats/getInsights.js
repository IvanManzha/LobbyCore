// Клиентская версия getInsights для фронтенда
// Синхронные расчеты на основе уже загруженных данных

const HOT_DROP_ID = 'HotDrop';

const mean = (values) => {
  if (!values || values.length === 0) return null;
  const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (numericValues.length === 0) return null;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
};

const parseNumeric = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Найти лучший турнир по очкам
 * @param {Array} history - массив записей истории игрока
 * @param {Array} tournaments - массив всех турниров (для дополнительных данных)
 * @returns {Object|null} - объект с данными лучшего турнира или null
 */
export const getBestTournament = (history, tournaments) => {
  if (!Array.isArray(history) || history.length === 0) return null;

  // Исключаем турнир HotDrop из хайлайтов
  const filteredHistory = history.filter(entry => entry.tournamentId !== HOT_DROP_ID);
  if (filteredHistory.length === 0) return null;

  // Фильтруем записи с валидными очками или киллами
  const validEntries = filteredHistory.filter(entry => {
    const points = parseNumeric(entry.points);
    const kills = parseNumeric(entry.personalKills);
    return (points != null && points > 0) || (kills != null && kills > 0);
  });

  if (validEntries.length === 0) return null;

  // Сортируем по очкам (убывание), при равенстве - по лучшему месту (возрастание)
  validEntries.sort((a, b) => {
    const pointsA = parseNumeric(a.points) || 0;
    const pointsB = parseNumeric(b.points) || 0;
    if (pointsB !== pointsA) return pointsB - pointsA;
    
    const placeA = parseNumeric(a.place);
    const placeB = parseNumeric(b.place);
    if (placeA == null && placeB == null) return 0;
    if (placeA == null) return 1;
    if (placeB == null) return -1;
    return placeA - placeB;
  });

  const best = validEntries[0];
  return {
    name: best.tournamentName || 'Турнир',
    place: parseNumeric(best.place),
    points: parseNumeric(best.points),
    kills: parseNumeric(best.personalKills),
    date: best.date || '',
    tournamentId: best.tournamentId || null
  };
};

/**
 * Вычислить тренды рейтинга и среднего места за последние N турниров
 * @param {Object} profileForYear - объект профиля с history и ratingHistory
 * @param {number} window - размер окна для сравнения (по умолчанию 5)
 * @returns {Object} - объект с трендами rating и avgPlace
 */
export const getTrends = (profileForYear, window = 5) => {
  if (!profileForYear || !Array.isArray(profileForYear.history) || profileForYear.history.length === 0) {
    return { rating: null, avgPlace: null };
  }

  // Исключаем HotDrop из истории для расчёта трендов
  const history = [...profileForYear.history]
    .filter(e => e.tournamentId !== HOT_DROP_ID)
    .sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateA - dateB;
  });

  // Нужно минимум window * 2 записей для сравнения
  if (history.length < window * 2) {
    return { rating: null, avgPlace: null };
  }

  // Rating trend
  let ratingTrend = null;
  if (Array.isArray(profileForYear.ratingHistory) && profileForYear.ratingHistory.length >= window * 2) {
    // Если ratingHistory привязан к турнирам, дополнительно фильтруем по HotDrop
    const ratings = profileForYear.ratingHistory
      .filter(r => typeof r === 'number' && !isNaN(r))
      .slice(-window * 2);
    
    if (ratings.length >= window * 2) {
      const recentWindow = ratings.slice(-window);
      const previousWindow = ratings.slice(-window * 2, -window);
      
      const recentAvg = mean(recentWindow);
      const previousAvg = mean(previousWindow);
      
      if (recentAvg != null && previousAvg != null) {
        const delta = recentAvg - previousAvg;
        ratingTrend = {
          delta: Math.round(delta * 10) / 10,
          direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
          label: delta > 0 ? `+${delta.toFixed(1)}` : delta < 0 ? delta.toFixed(1) : '0.0'
        };
      }
    }
  } else {
    // Пытаемся вычислить из history
    const entriesWithRating = history.filter(e => typeof e.newRating === 'number' && !isNaN(e.newRating));
    if (entriesWithRating.length >= window * 2) {
      const ratings = entriesWithRating.map(e => e.newRating).slice(-window * 2);
      const recentWindow = ratings.slice(-window);
      const previousWindow = ratings.slice(-window * 2, -window);
      
      const recentAvg = mean(recentWindow);
      const previousAvg = mean(previousWindow);
      
      if (recentAvg != null && previousAvg != null) {
        const delta = recentAvg - previousAvg;
        ratingTrend = {
          delta: Math.round(delta * 10) / 10,
          direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
          label: delta > 0 ? `+${delta.toFixed(1)}` : delta < 0 ? delta.toFixed(1) : '0.0'
        };
      }
    }
  }

  // Avg place trend
  let avgPlaceTrend = null;
  const entriesWithPlace = history
    .filter(e => {
      const place = parseNumeric(e.place);
      return place != null && place > 0;
    })
    .slice(-window * 2);
  
  if (entriesWithPlace.length >= window * 2) {
    const places = entriesWithPlace.map(e => parseNumeric(e.place));
    const recentWindow = places.slice(-window);
    const previousWindow = places.slice(-window * 2, -window);
    
    const recentAvg = mean(recentWindow);
    const previousAvg = mean(previousWindow);
    
    if (recentAvg != null && previousAvg != null) {
      const delta = previousAvg - recentAvg; // Инвертируем: меньше = лучше
      avgPlaceTrend = {
        delta: Math.round(delta * 10) / 10,
        direction: delta > 0 ? 'improved' : delta < 0 ? 'worsened' : 'stable',
        label: delta > 0 ? `Улучшилось на ${delta.toFixed(1)}` : delta < 0 ? `Ухудшилось на ${Math.abs(delta).toFixed(1)}` : 'Без изменений'
      };
    }
  }

  return { rating: ratingTrend, avgPlace: avgPlaceTrend };
};

/**
 * Вычислить разбивку вклада очков: placement vs kills
 * @param {Array} history - массив записей турниров
 * @param {Object} stats - объект статистики
 * @returns {Object|null} - объект с долями вклада или null
 */
export const getContributionBreakdown = (history, stats) => {
  if (!Array.isArray(history) || history.length === 0) return null;

  // Исключаем турнир HotDrop
  const filteredHistory = history.filter(entry => entry.tournamentId !== HOT_DROP_ID);

  // Фильтруем записи с очками и киллами
  const entriesWithData = filteredHistory.filter(entry => {
    const points = parseNumeric(entry.points);
    const kills = parseNumeric(entry.personalKills);
    return points != null && points > 0 && kills != null && kills >= 0;
  });

  // Нужно минимум 3 турнира для статистики
  if (entriesWithData.length < 3) return null;

  let totalPoints = 0;
  let totalKills = 0;
  let estimatedKillPoints = 0;

  entriesWithData.forEach(entry => {
    const points = parseNumeric(entry.points) || 0;
    const kills = parseNumeric(entry.personalKills) || 0;
    
    totalPoints += points;
    totalKills += kills;
    
    // Приблизительная оценка: считаем, что за килл дается примерно 1-2 очка
    // Это упрощенная оценка, так как точная формула зависит от турнира
    estimatedKillPoints += kills * 1.5;
  });

  if (totalPoints === 0) return null;

  const killsShare = Math.min(100, Math.max(0, (estimatedKillPoints / totalPoints) * 100));
  const placementShare = Math.max(0, 100 - killsShare);

  return {
    placementShare: Math.round(placementShare),
    killsShare: Math.round(killsShare),
    totalPoints,
    totalKills,
    label: 'Приблизительная оценка на основе среднего значения очков за килл'
  };
};

/**
 * Получить данные о покрытии (coverage) статистики
 * @param {Object} stats - объект статистики с полем coverage
 * @returns {Object|null} - объект с данными coverage или null
 */
export const getCoverage = (stats) => {
  if (!stats || !stats.coverage) return null;

  const kills = stats.coverage.kills || {};
  const deaths = stats.coverage.deaths || {};

  const killsTracked = kills.trackedMatches || 0;
  const killsTotal = kills.totalMatches || 0;
  const deathsTracked = deaths.trackedMatches || 0;
  const deathsTotal = deaths.totalMatches || 0;

  if (killsTotal === 0 && deathsTotal === 0) return null;

  return {
    kills: {
      tracked: killsTracked,
      total: killsTotal,
      label: kills.label || '',
      percentage: killsTotal > 0 ? Math.round((killsTracked / killsTotal) * 100) : 0
    },
    deaths: {
      tracked: deathsTracked,
      total: deathsTotal,
      label: deaths.label || '',
      percentage: deathsTotal > 0 ? Math.round((deathsTracked / deathsTotal) * 100) : 0
    }
  };
};

/**
 * Вычислить консистентность (Top-X% rate)
 * @param {Array} history - массив записей турниров
 * @param {Object} stats - объект статистики для получения метрики top_rate
 * @returns {Object|null} - объект с данными консистентности или null
 */
export const getConsistency = (history, stats) => {
  if (!Array.isArray(history) || history.length === 0) return null;
  if (!stats || !stats.core) return null;

  // Исключаем турнир HotDrop
  const filteredHistory = history.filter(entry => entry.tournamentId !== HOT_DROP_ID);

  // Получаем метрику top_rate
  const topRateMetric = stats.core.find(m => m.id === 'top_rate');
  if (!topRateMetric) return null;

  // Извлекаем X из label (например, "Top-3" -> 3)
  const topRateLabel = topRateMetric.label || '';
  const match = topRateLabel.match(/top[-\s]?(\d+)/i);
  if (!match) return null;

  const topX = parseInt(match[1], 10);
  if (isNaN(topX) || topX <= 0) return null;

  // Фильтруем записи с валидными местами
  const entriesWithPlace = filteredHistory.filter(entry => {
    const place = parseNumeric(entry.place);
    return place != null && place > 0 && place <= topX;
  });

  const totalTournaments = filteredHistory.filter(entry => {
    const place = parseNumeric(entry.place);
    return place != null && place > 0;
  }).length;

  if (totalTournaments === 0) return null;

  const topXTournaments = entriesWithPlace.length;
  const topXRate = Math.round((topXTournaments / totalTournaments) * 100);

  return {
    topXRate,
    totalTournaments,
    topXTournaments,
    topX,
    label: `Top-${topX}`
  };
};
