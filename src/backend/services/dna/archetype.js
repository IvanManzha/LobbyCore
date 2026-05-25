/**
 * Dominant Trait / Archetype: map player genes to a single player style label.
 * Used for display in profile, leaderboard, tournament table. Not a number — identity marker.
 * Rules evaluated in order; first match wins. "High" = gene value >= HIGH_THRESHOLD (or top-2 by value).
 */
const { GENE_KEYS } = require('./constants');

const HIGH_THRESHOLD = 65;

/** @type {Array<{ archetype: string, condition: (genesMap: Record<string, number>) => boolean }>} */
const ARCHETYPE_RULES = [
  {
    archetype: 'Aggressor',
    condition: (g) => (g.combat || 0) >= HIGH_THRESHOLD && (g.pressure || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Skirmisher',
    condition: (g) => (g.pressure || 0) >= HIGH_THRESHOLD && (g.combat || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Closer',
    condition: (g) => (g.conversion || 0) >= HIGH_THRESHOLD && (g.combat || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Finisher',
    condition: (g) => (g.conversion || 0) >= HIGH_THRESHOLD && (g.combat || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Tactician',
    condition: (g) =>
      (g.positioning || 0) >= HIGH_THRESHOLD &&
      (g.teamwork || 0) >= HIGH_THRESHOLD &&
      (g.survival || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Anchor',
    condition: (g) => (g.survival || 0) >= HIGH_THRESHOLD && (g.positioning || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Survivor',
    condition: (g) => (g.survival || 0) >= HIGH_THRESHOLD && (g.positioning || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Stabilizer',
    condition: (g) => (g.teamwork || 0) >= HIGH_THRESHOLD && (g.recovery || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Support',
    condition: (g) => (g.teamwork || 0) >= HIGH_THRESHOLD && (g.recovery || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Predator',
    condition: (g) => (g.combat || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Frontline',
    condition: (g) => (g.combat || 0) >= HIGH_THRESHOLD || (g.pressure || 0) >= HIGH_THRESHOLD,
  },
  {
    archetype: 'Controller',
    condition: (g) => (g.positioning || 0) >= HIGH_THRESHOLD && (g.survival || 0) >= HIGH_THRESHOLD,
  },
];

/**
 * Build map geneKey -> value from genes array (from DNA profile).
 * @param {Array<{ key: string, value: number|null }>} genes
 * @returns {Record<string, number>}
 */
function genesToMap(genes) {
  const map = {};
  if (!Array.isArray(genes)) return map;
  for (const g of genes) {
    if (g && g.key && typeof g.value === 'number' && !Number.isNaN(g.value)) {
      map[g.key.toLowerCase()] = g.value;
    }
  }
  return map;
}

/**
 * Get dominant trait / archetype from genes. First matching rule wins.
 * @param {Array<{ key: string, value: number|null }>} genes - DNA profile genes array
 * @returns {string} archetype label, or 'All-Rounder' if no rule matches
 */
function archetypeFromGenes(genes) {
  const g = genesToMap(genes);
  for (const rule of ARCHETYPE_RULES) {
    if (rule.condition(g)) return rule.archetype;
  }
  return 'All-Rounder';
}

/**
 * Get strongest and weakest gene keys by value (for DNA Lab display).
 * @param {Array<{ key: string, value: number|null }>} genes
 * @param {number} topN
 * @returns {{ strongest: string[], weakest: string[] }}
 */
function strongestWeakestGenes(genes, topN = 2) {
  if (!Array.isArray(genes) || genes.length === 0) {
    return { strongest: [], weakest: [] };
  }
  const withValues = genes
    .filter((g) => g && g.key && typeof g.value === 'number')
    .map((g) => ({ key: g.key, value: g.value }));
  if (withValues.length === 0) return { strongest: [], weakest: [] };
  withValues.sort((a, b) => b.value - a.value);
  const strongest = withValues.slice(0, topN).map((x) => x.key);
  const weakest = withValues.slice(-topN).reverse().map((x) => x.key);
  return { strongest, weakest };
}

module.exports = {
  archetypeFromGenes,
  strongestWeakestGenes,
  HIGH_THRESHOLD,
};
