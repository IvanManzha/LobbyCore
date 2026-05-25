/**
 * DNA v3 — priors L/M/H → μ/σ for baseline initialization.
 * 24 context bins: C0..2, N0..1, R0..1, L0..1.
 * @module dna/v3/priors
 */

const { GENES } = require('./types');

/** @typedef {'L'|'M'|'H'} Level */

const LEVEL_TO_MU = { L: 0.35, M: 0.5, H: 0.65 };
const LEVEL_TO_SIGMA = { L: 0.14, M: 0.17, H: 0.2 };

const DEFAULT_LEVEL = 'M';

function buildAllContextKeys() {
  const keys = [];
  for (let c = 0; c < 3; c++) {
    for (let n = 0; n < 2; n++) {
      for (let r = 0; r < 2; r++) {
        for (let l = 0; l < 2; l++) {
          keys.push(`C${c}_N${n}_R${r}_L${l}`);
        }
      }
    }
  }
  return keys;
}

const ALL_CONTEXT_KEYS = buildAllContextKeys();

/** @type {Record<string, Record<string, Level>>} */
const PRIOR_LEVELS = {};
for (const key of ALL_CONTEXT_KEYS) {
  const row = {};
  for (const g of GENES) {
    row[g] = DEFAULT_LEVEL;
  }
  // POS: higher μ in all bins so residual isn't always positive and POS stops creeping up
  row.positioning = 'H';
  PRIOR_LEVELS[key] = row;
}

/**
 * Get prior μ and σ for each gene in a context bin.
 * @param {string} key - context key e.g. "C0_N0_R0_L0"
 * @returns {Record<string, { mu: number, sigma: number }>}
 */
function priorMuSigma(key) {
  const row = PRIOR_LEVELS[key] || {};
  const out = {};
  for (const g of GENES) {
    const lvl = row[g] || DEFAULT_LEVEL;
    out[g] = {
      mu: LEVEL_TO_MU[lvl],
      sigma: LEVEL_TO_SIGMA[lvl],
    };
  }
  return out;
}

module.exports = {
  LEVEL_TO_MU,
  LEVEL_TO_SIGMA,
  PRIOR_LEVELS,
  priorMuSigma,
  ALL_CONTEXT_KEYS,
};
