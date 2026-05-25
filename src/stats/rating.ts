import { PlayerProfile, RatingBreakdown } from './types';

type RatingOptions = {
  year?: string | null;
  scope?: 'all_time' | 'year' | 'last_5_tournaments' | 'live_only';
};

const WINDOW_SIZE = 5;
const SHORT_ANCHOR_SIZE = 10;

const mean = (values: number[]) => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const computeRatingBreakdown = (
  profile: PlayerProfile,
  options: RatingOptions = {}
): RatingBreakdown | null => {
  const history = (profile.history || [])
    .filter((entry) => typeof entry.newRating === 'number')
    .filter((entry) => entry.tournamentId !== 'HotDrop')  // <-- исключаем Hot Drop из расчета рейтинга
    .filter((entry) => {
      if (!options.year) return true;
      return typeof entry.date === 'string' && entry.date.startsWith(`${options.year}-`);
    })
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  if (history.length === 0) return null;

  const ratings = history.map((entry) => entry.newRating || 0);
  const longAnchor = typeof profile.longAnchor === 'number' ? profile.longAnchor : ratings[0];
  const shortAnchor = mean(ratings.slice(-SHORT_ANCHOR_SIZE));
  const windowRating = mean(ratings.slice(-WINDOW_SIZE));
  const effectiveRating = ratings[ratings.length - 1];

  return {
    longAnchor: longAnchor ?? null,
    shortAnchor: shortAnchor ?? null,
    windowRating: windowRating ?? null,
    effectiveRating: effectiveRating ?? null,
    windowSize: WINDOW_SIZE,
    shortWindowSize: SHORT_ANCHOR_SIZE,
    formula: 'Рейтинг = WindowRating + влияние долгосрочного и краткосрочного якоря'
  };
};
