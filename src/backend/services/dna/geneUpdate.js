/**
 * Gene additive update with asymmetric edge damping.
 * Based on match score m_g in [0,100], confidence c_g in [0,1],
 * previous gene G_g in [2,99] and capped per-match delta.
 */

const { GENE_KEYS } = require('./constants');

// Base learning rate in gene space (points per fully confident, extreme match in center).
const DEFAULT_ALPHA = 5.5;
const GENE_MIN = 2;
const GENE_MAX = 99;

// Default caps (in gene points) for one match:
// - near center genes can move up/down by ~3–5 points on strong signals
// - near edges movement shrinks to ~0.3 points to keep extremes sticky.
const DEFAULT_PARAMS = {
  alpha: DEFAULT_ALPHA,
  upMin: 0.3,
  upMax: 5.0,
  downMin: 0.3,
  downMax: 5.0,
  power: 3,
};

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function computeCaps(geneValue, params = DEFAULT_PARAMS) {
  const { upMin, upMax, downMin, downMax, power } = params;
  const z = clamp((geneValue - GENE_MIN) / (GENE_MAX - GENE_MIN), 0, 1);
  const up =
    upMin +
    (upMax - upMin) * Math.pow(1 - z, power);
  const down =
    downMin +
    (downMax - downMin) * Math.pow(z, power);
  return { capUp: up, capDown: down };
}

/**
 * Update single gene value.
 * @param {number} prevGene - previous gene value G_g in [2,99]
 * @param {number} matchScore - m_g in [0,100]
 * @param {number} confidence - c_g in [0,1]
 * @param {Object} [params]
 * @returns {number} new gene value
 */
function updateGene(prevGene, matchScore, confidence, params = DEFAULT_PARAMS) {
  const G = Number.isFinite(prevGene) ? prevGene : 50;
  const m = Number.isFinite(matchScore) ? matchScore : 50;
  const c = Number.isFinite(confidence) ? confidence : 0.5;

  const alpha = params.alpha ?? DEFAULT_ALPHA;

  const s = (m - 50) / 50;
  const rawDelta = alpha * c * s;

  const { capUp, capDown } = computeCaps(G, params);

  let delta;
  if (rawDelta >= 0) {
    delta = Math.min(rawDelta, capUp);
  } else {
    delta = Math.max(rawDelta, -capDown);
  }

  const next = G + delta;
  return clamp(next, GENE_MIN, GENE_MAX);
}

/**
 * Batch update for all genes given:
 * - prevGenes: { [key]: number } or array of { key, value }
 * - matchScores: { [key]: number } in [0,100]
 * - confidences: { [key]: number } in [0,1]
 */
function toGeneObject(genes) {
  if (!genes) return {};
  if (Array.isArray(genes)) {
    return genes.reduce((acc, g) => ({ ...acc, [g.key]: g.value }), {});
  }
  return { ...genes };
}

function updateGenes(prevGenes, matchScores, confidences, params = DEFAULT_PARAMS) {
  const prev = toGeneObject(prevGenes);
  const out = {};
  for (const key of GENE_KEYS) {
    const G = prev[key] ?? 50;
    const m = matchScores?.[key] ?? 50;
    const c = confidences?.[key] ?? 0.5;
    out[key] = updateGene(G, m, c, params);
  }
  return out;
}

module.exports = {
  updateGene,
  updateGenes,
  computeCaps,
  DEFAULT_PARAMS,
  GENE_MIN,
  GENE_MAX,
};

