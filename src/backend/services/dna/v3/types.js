/**
 * DNA Genes v3 — types and constants.
 * Gene keys match existing UI (dnaEngine.GENE_KEYS): accuracy, tactics, aggression, survival, positioning, teamwork, resource, composure.
 * @module dna/v3/types
 */

/** @typedef {'accuracy'|'tactics'|'aggression'|'survival'|'positioning'|'teamwork'|'resource'|'composure'} GeneKey */

/** @typedef {string} ContextKey */

const GENES = [
  'accuracy',
  'tactics',
  'aggression',
  'survival',
  'positioning',
  'teamwork',
  'resource',
  'composure',
];

/**
 * @typedef {Object} BaselineCell
 * @property {number} n
 * @property {Record<GeneKey, number>} mean
 * @property {Record<GeneKey, number>} m2
 */

/**
 * @typedef {Object} BaselineModel
 * @property {string} version
 * @property {string} seasonId
 * @property {BaselineCell} global
 * @property {Record<ContextKey, BaselineCell>} bins
 */

/**
 * @typedef {Object} PlayerGeneState
 * @property {string} seasonId
 * @property {Record<GeneKey, number>} value
 * @property {Record<GeneKey, number>} skill
 * @property {Record<GeneKey, number>} form
 * @property {Record<GeneKey, number[]>} actualHist
 */

/** @typedef {'OK'|'PARTIAL'|'NONE'} MatchQuality */

/**
 * @typedef {Object} GeneUpdateDebug
 * @property {ContextKey} contextKey
 * @property {{ C: number; N: number; R: number; L: number }} context
 * @property {Record<GeneKey, { mu: number; sigma: number }>} expected
 * @property {Record<GeneKey, number>} actual
 * @property {Record<GeneKey, number>} proxy
 * @property {Record<GeneKey, number>} residual
 * @property {Record<GeneKey, number>} zForm
 * @property {Record<GeneKey, number>} impact
 * @property {Record<GeneKey, number>} raw
 * @property {Record<GeneKey, number>} next
 */

module.exports = {
  GENES,
};
