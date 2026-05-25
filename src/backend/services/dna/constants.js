/**
 * Shared DNA constants (7 genes). Used by dnaEngine, dnaStorage, poolStats to avoid circular deps.
 */
const GENE_KEYS = [
  'combat', 'pressure', 'conversion', 'survival',
  'positioning', 'recovery', 'teamwork',
];

module.exports = { GENE_KEYS };
