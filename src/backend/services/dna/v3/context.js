/**
 * DNA v3 — context C/N/R/L (0..1) and context key for 24 bins.
 * @module dna/v3/context
 */

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

/**
 * Compute context components from bucket features (all in 0..1).
 * @param {Object} features - from extractBucketsFromVector: normCombatTime, normEngagements, normDamageExchanged, normSquadKnocks, normReviveNeed, normOutsideTime, normZoneEntries, normDistance, placeScore, normAliveTime
 * @returns {{ C: number, N: number, R: number, L: number }}
 */
function computeContext(features) {
  const f = features || {};
  const C = clamp01(
    0.45 * (f.normCombatTime ?? 0.5) +
    0.35 * (f.normEngagements ?? 0.5) +
    0.2 * (f.normDamageExchanged ?? 0.5)
  );
  const N = clamp01(
    0.6 * (f.normSquadKnocks ?? 0.5) +
    0.4 * (f.normReviveNeed ?? 0.5)
  );
  const R = clamp01(
    0.45 * (f.normOutsideTime ?? 0.5) +
    0.35 * (f.normZoneEntries ?? 0.5) +
    0.2 * (f.normDistance ?? 0.5)
  );
  const L = clamp01(
    0.65 * (f.placeScore ?? 0.5) +
    0.35 * (f.normAliveTime ?? 0.5)
  );
  return { C, N, R, L };
}

/**
 * Map context to one of 24 bin keys: C0..2, N0..1, R0..1, L0..1.
 * @param {{ C: number, N: number, R: number, L: number }} ctx
 * @returns {string} e.g. "C0_N0_R0_L0"
 */
function contextKey(ctx) {
  const C = ctx.C ?? 0.5;
  const N = ctx.N ?? 0.5;
  const R = ctx.R ?? 0.5;
  const L = ctx.L ?? 0.5;
  const cBin = C < 0.33 ? 0 : C < 0.66 ? 1 : 2;
  const nBin = N < 0.5 ? 0 : 1;
  const rBin = R < 0.5 ? 0 : 1;
  const lBin = L < 0.5 ? 0 : 1;
  return `C${cBin}_N${nBin}_R${rBin}_L${lBin}`;
}

module.exports = {
  computeContext,
  contextKey,
};
