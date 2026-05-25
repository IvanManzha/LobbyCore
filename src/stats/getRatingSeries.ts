import { PlayerProfile, RawTournament } from './types';
import { computeRatingBreakdown } from './rating';

export type RatingDataPoint = {
  date: string;
  tournamentName: string;
  tournamentId: string;
  value: number;
  delta: number | null; // Изменение относительно предыдущей точки
};

export type RatingSeriesData = {
  mainLine: RatingDataPoint[];
  advancedLines: {
    longAnchor: RatingDataPoint[];
    shortAnchor: RatingDataPoint[];
    windowRating: RatingDataPoint[];
  } | null;
};

const WINDOW_SIZE = 5;
const SHORT_ANCHOR_SIZE = 10;

const mean = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const getRatingSeries = (
  profile: PlayerProfile,
  tournaments: RawTournament[],
  options?: { year?: string | null }
): RatingSeriesData | null => {
  if (!profile || !profile.history || profile.history.length === 0) {
    return null;
  }

  // Фильтруем историю по году если указан
  let filteredHistory = profile.history.filter((entry) => {
    if (typeof entry.newRating !== 'number') return false;
    if (!options?.year) return true;
    return typeof entry.date === 'string' && entry.date.startsWith(`${options.year}-`);
  });

  // Исключаем отменённые турниры и Hot Drop
  const canceledIds = new Set(
    tournaments.filter((t) => t.state === 'Турнир отменен').map((t) => t.id || t._id)
  );
  filteredHistory = filteredHistory.filter((entry) => 
    !canceledIds.has(entry.tournamentId) && entry.tournamentId !== 'HotDrop'  // <-- исключаем Hot Drop
  );

  if (filteredHistory.length === 0) return null;

  // Сортируем по дате
  filteredHistory.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateA - dateB;
  });

  // Строим mainLine (Effective Rating)
  const mainLine: RatingDataPoint[] = [];
  let previousRating: number | null = null;

  filteredHistory.forEach((entry, index) => {
    const value = entry.newRating || 0;
    const delta = previousRating !== null ? value - previousRating : null;

    mainLine.push({
      date: entry.date || '',
      tournamentName: entry.tournamentName || 'Турнир',
      tournamentId: entry.tournamentId || '',
      value,
      delta
    });

    previousRating = value;
  });

  // Если точек меньше 2, возвращаем null (нужно для empty state)
  if (mainLine.length < 2) {
    return null;
  }

  // Строим advanced lines
  const ratings = filteredHistory.map((entry) => entry.newRating || 0);
  const longAnchorValue = typeof profile.longAnchor === 'number' ? profile.longAnchor : ratings[0];

  const longAnchor: RatingDataPoint[] = filteredHistory.map((entry) => ({
    date: entry.date || '',
    tournamentName: entry.tournamentName || 'Турнир',
    tournamentId: entry.tournamentId || '',
    value: longAnchorValue,
    delta: null
  }));

  const shortAnchor: RatingDataPoint[] = [];
  const windowRating: RatingDataPoint[] = [];

  for (let i = 0; i < filteredHistory.length; i++) {
    const entry = filteredHistory[i];
    const shortStart = Math.max(0, i + 1 - SHORT_ANCHOR_SIZE);
    const shortSlice = ratings.slice(shortStart, i + 1);
    const shortValue = mean(shortSlice);

    const windowStart = Math.max(0, i + 1 - WINDOW_SIZE);
    const windowSlice = ratings.slice(windowStart, i + 1);
    const windowValue = mean(windowSlice);

    shortAnchor.push({
      date: entry.date || '',
      tournamentName: entry.tournamentName || 'Турнир',
      tournamentId: entry.tournamentId || '',
      value: shortValue ?? 0,
      delta: null
    });

    windowRating.push({
      date: entry.date || '',
      tournamentName: entry.tournamentName || 'Турнир',
      tournamentId: entry.tournamentId || '',
      value: windowValue ?? 0,
      delta: null
    });
  }

  return {
    mainLine,
    advancedLines: {
      longAnchor,
      shortAnchor,
      windowRating
    }
  };
};
