/**
 * DNA v3 — baseline calibration: Welford μ/σ per bin, blend priors with empirical.
 * @module dna/v3/baseline
 */

const { GENES } = require('./types');
const { priorMuSigma } = require('./priors');

const EPS = 1e-6;
const K_BIN = 25;
const K_GLOB = 60;

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, Number(x) || 0));
}
function clamp01(x) {
  return clamp(x, 0, 1);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function emptyCell() {
  const mean = {};
  const m2 = {};
  for (const g of GENES) {
    mean[g] = 0.5;
    m2[g] = 0;
  }
  return { n: 0, mean, m2 };
}

/**
 * Weighted Welford update for one cell.
 * @param {Object} cell - { n, mean, m2 }
 * @param {Record<string, number>} x - values per gene (0..1)
 * @param {number} [w=1]
 */
function welfordUpdate(cell, x, w = 1) {
  const n0 = cell.n;
  const n1 = n0 + w;
  for (const g of GENES) {
    const xg = x[g] != null ? Number(x[g]) : 0.5;
    const delta = xg - cell.mean[g];
    const mean1 = cell.mean[g] + (w / n1) * delta;
    const delta2 = xg - mean1;
    cell.m2[g] = cell.m2[g] + w * delta * delta2;
    cell.mean[g] = mean1;
  }
  cell.n = n1;
}

function getSigma(cell, g) {
  if (cell.n < 2) return 0.17;
  const varg = Math.max((cell.m2[g] || 0) / (cell.n - 1), 0);
  return Math.sqrt(varg) || 0.17;
}

/**
 * Blend priors with empirical (bin + global). Returns expected μ, σ per gene.
 * @param {Object} baseline - BaselineModel
 * @param {string} key - context key
 * @param {string} quality - 'OK'|'PARTIAL'|'NONE'
 * @returns {Record<string, { mu: number, sigma: number }>}
 */
function blendExpected(baseline, key, quality) {
  const pri = priorMuSigma(key);
  const bin = baseline.bins && baseline.bins[key] ? baseline.bins[key] : emptyCell();
  const glob = baseline.global ? baseline.global : emptyCell();

  const wBin = bin.n / (bin.n + K_BIN);
  const wGlob = glob.n / (glob.n + K_GLOB);
  const q = quality === 'OK' ? 1 : quality === 'PARTIAL' ? 0.6 : 0.2;

  const out = {};
  for (const g of GENES) {
    const muEmpBin = bin.mean[g] ?? 0.5;
    const muEmpGlob = glob.mean[g] ?? 0.5;
    const sigBin = clamp(getSigma(bin, g), 0.08, 0.28);
    const sigGlob = clamp(getSigma(glob, g), 0.08, 0.28);

    const muEmp = lerp(muEmpGlob, muEmpBin, wBin);
    const sigEmp = lerp(sigGlob, sigBin, wBin);

    const muPrior = pri[g].mu;
    const sigPrior = pri[g].sigma;

    const wEmp = clamp01(q * Math.max(wGlob, wBin));
    const mu = lerp(muPrior, muEmp, wEmp);
    const sigma = Math.max(lerp(sigPrior, sigEmp, wEmp), EPS);

    out[g] = { mu, sigma };
  }
  return out;
}

/**
 * Update baseline from match actuals (only if quality OK or PARTIAL).
 * @param {Object} baseline - BaselineModel (mutated)
 * @param {string} key - context key
 * @param {Record<string, number>} actual - actual per gene 0..1
 * @param {string} quality - 'OK'|'PARTIAL'|'NONE'
 */
function updateBaselineFromMatch(baseline, key, actual, quality) {
  const w = quality === 'OK' ? 1 : quality === 'PARTIAL' ? 0.5 : 0;
  if (w <= 0) return;

  if (!baseline.bins) baseline.bins = {};
  if (!baseline.bins[key]) baseline.bins[key] = emptyCell();
  welfordUpdate(baseline.bins[key], actual, w);

  if (!baseline.global) baseline.global = emptyCell();
  welfordUpdate(baseline.global, actual, w);
}

module.exports = {
  emptyCell,
  welfordUpdate,
  getSigma,
  blendExpected,
  updateBaselineFromMatch,
};
