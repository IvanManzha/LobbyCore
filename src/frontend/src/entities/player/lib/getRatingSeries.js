// Серия ladder-рейтинга для графика.
// Источник: profile.ladderRatingHistory (из БД player_ladder_history).
// Шкала ladder: 0–2500.

const LADDER_MIN = 0;
const LADDER_MAX = 2500;
const MOVING_AVERAGE_WINDOW = 5;

const mean = (values) => {
  if (!values || values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/** Линейная регрессия: возвращает массив значений тренда для каждой точки. */
function linearTrend(values) {
  if (!values || values.length === 0) return [];
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => intercept + slope * i);
}

/** Форматировать дату в YYYY-MM-DD для точки графика. */
function toDateStr(occurredAt) {
  if (!occurredAt) return '';
  const d = typeof occurredAt === 'string' ? new Date(occurredAt) : occurredAt;
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Построить серию по массиву точек { date, value, tournamentId?, tournamentName? } и ratings[]. */
function buildSeriesFromPoints(points, ratings) {
  const mainLine = points.map((p, i) => ({
    date: p.date,
    tournamentName: p.tournamentName ?? 'Матч',
    tournamentId: p.tournamentId ?? '',
    value: p.value,
    delta: i > 0 ? p.value - points[i - 1].value : null
  }));

  const movingAverage = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i + 1 - MOVING_AVERAGE_WINDOW);
    const slice = ratings.slice(start, i + 1);
    movingAverage.push({
      date: points[i].date,
      tournamentName: points[i].tournamentName ?? 'Матч',
      tournamentId: points[i].tournamentId ?? '',
      value: mean(slice) ?? 0,
      delta: null
    });
  }

  const trendValues = linearTrend(ratings);
  const trend = points.map((p, i) => ({
    date: p.date,
    tournamentName: p.tournamentName ?? 'Матч',
    tournamentId: p.tournamentId ?? '',
    value: trendValues[i] ?? 0,
    delta: null
  }));

  return { mainLine, movingAverage, trend };
}

export const getRatingSeries = (profile, tournaments, options = {}) => {
  const canceledIds = new Set(
    (tournaments || [])
      .filter((t) => t && t.state === 'Турнир отменен')
      .map((t) => t.id || t._id)
  );

  const tournamentNameById = new Map(
    (tournaments || []).map((t) => [t.id || t._id, t.name || 'Турнир'])
  );

  // История ladder-рейтинга из БД (player_ladder_history)
  if (!profile?.ladderRatingHistory || !Array.isArray(profile.ladderRatingHistory) || profile.ladderRatingHistory.length === 0) {
    return null;
  }

  let list = profile.ladderRatingHistory.filter((entry) => {
    const r = entry.rating;
    if (typeof r !== 'number' || r < LADDER_MIN || r > LADDER_MAX) return false;
    if (options.year) {
      const dateStr = toDateStr(entry.occurred_at);
      const season = entry.season_id;
      if (season && String(season) !== String(options.year)) return false;
      if (dateStr && !dateStr.startsWith(String(options.year))) return false;
    }
    if (entry.tournament_id && canceledIds.has(entry.tournament_id)) return false;
    return true;
  });

  list.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  if (list.length < 2) return null;

  const points = list.map((entry) => ({
    date: toDateStr(entry.occurred_at),
    value: entry.rating,
    tournamentId: entry.tournament_id ?? '',
    tournamentName: entry.tournament_id ? tournamentNameById.get(entry.tournament_id) : undefined
  }));
  const ratings = list.map((e) => e.rating);
  const { mainLine, movingAverage, trend } = buildSeriesFromPoints(points, ratings);
  return {
    mainLine,
    advancedLines: { movingAverage, trend }
  };
};
