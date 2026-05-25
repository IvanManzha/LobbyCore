import { CoverageInfo, TournamentMode } from './types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const safeDivide = (numerator: number | null, denominator: number | null): number | null => {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
};

export const roundTo = (value: number | null, digits: number): number | null => {
  if (value == null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const formatNumber = (value: number | null, digits: number): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
};

export const formatInteger = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return Math.round(value).toString();
};

export const formatPercent = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
};

export const formatRatio = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(2);
};

export const normalizeMode = (raw?: string | null): TournamentMode => {
  const value = (raw || '').toLowerCase();
  if (value === 'solo') return 'solo';
  if (value === 'duo') return 'duo';
  if (value === 'squad') return 'squad';
  if (value === 'mixed') return 'mixed';
  return 'unknown';
};

export const thresholdsForFormat = (participantsCount: number | null, mode: TournamentMode) => {
  const count = participantsCount && participantsCount > 0 ? participantsCount : null;
  const top3Count = count ? Math.min(3, count) : 3;
  let top10Count = count ? Math.min(10, count) : 10;
  let topLabel = 'Top-10';
  if (count && count < 10) {
    top10Count = Math.max(1, Math.ceil(count * 0.5));
    topLabel = 'Top-50%';
  }

  const winLabel = mode === 'solo' ? 'Победа = 1 место' : 'Победа = 1 место команды';

  return {
    top3Count,
    top10Count,
    top10Label: topLabel,
    winLabel
  };
};

export const buildCoverage = (
  trackedMatches: number,
  totalMatches: number,
  label: string
): CoverageInfo => ({
  trackedMatches,
  totalMatches,
  label
});

export const parseNumeric = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const isValidPlacement = (value: number | null): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const sum = (values: number[]): number =>
  values.reduce((acc, value) => acc + value, 0);

export const mean = (values: number[]): number | null =>
  values.length > 0 ? sum(values) / values.length : null;

export const stdDev = (values: number[], avg?: number): number | null => {
  if (values.length === 0) return null;
  const meanValue = avg ?? mean(values);
  if (meanValue == null) return null;
  const variance = values.reduce((acc, value) => acc + (value - meanValue) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

export const percentile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = clamp(p, 0, 100) / 100 * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};
