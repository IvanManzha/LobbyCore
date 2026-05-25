/**
 * DNA tier 1..8 from total DNA rating (aligned with backend dnaEngine.computeDnaTier).
 */
const DNA_RATING_MIN = 800;
const DNA_RATING_RANGE = 1400;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function computeDnaTierFromRating(rating) {
  if (rating == null || !Number.isFinite(Number(rating))) return 1;
  const r = clamp(Math.round(Number(rating)), DNA_RATING_MIN, DNA_RATING_MIN + DNA_RATING_RANGE);
  const frac = (r - DNA_RATING_MIN) / DNA_RATING_RANGE;
  const tier = 1 + Math.floor(frac * 8);
  return Math.max(1, Math.min(8, tier));
}
