/**
 * DNA pool normalization: per-gene median and MAD across all players in a season.
 * Raw values are mapped so that pool median → 50 and spread (MAD) → ±25, so that
 * if everyone has low values (e.g. 20–30), 25 becomes 50 and the range stretches.
 * @module dna/poolStats
 */

const dnaStorage = require('./dnaStorage');
const { GENE_KEYS } = require('./constants');

const MAD_MIN = 1e-6;
/** Below this MAD we skip pool normalization (insufficient spread → scale would blow up to 0/100). */
const MAD_SKIP_NORMALIZE = 1;
const SCALE_HALF_RANGE = 25;

function median(sortedArr) {
  if (!sortedArr || sortedArr.length === 0) return null;
  const n = sortedArr.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sortedArr[mid] : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
}

function medianAbsoluteDeviation(values, med) {
  if (!values.length) return 0;
  const m = med ?? median([...values].sort((a, b) => a - b));
  if (m == null) return 0;
  const absDiffs = values.map((v) => Math.abs(Number(v) - m)).filter((x) => Number.isFinite(x));
  if (!absDiffs.length) return 0;
  absDiffs.sort((a, b) => a - b);
  return median(absDiffs) ?? 0;
}

/**
 * Compute per-gene median and MAD from a list of gene value objects.
 * @param {Array<Record<string, number>>} valuesPerGene - e.g. [ { accuracy: 45, ... }, { accuracy: 52, ... } ] per player
 * @returns {{ median: number, mad: number } | null} per gene
 */
function statsForGene(values) {
  const nums = values
    .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
    .filter((v) => v != null);
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const med = median(sorted);
  const mad = medianAbsoluteDeviation(nums, med);
  return { median: med, mad: Math.max(mad, MAD_MIN) };
}

/**
 * Load all profiles in season from DB and collect genesV3.value (or genes) per player.
 * @param {string} seasonId
 * @returns {Promise<Record<string, number[]>>} geneKey -> array of values (one per player)
 */
async function collectPoolValues(seasonId) {
  const byGene = {};
  GENE_KEYS.forEach((k) => { byGene[k] = []; });

  const playerIds = await dnaStorage.listPlayerIdsBySeason(seasonId);
  for (const playerId of playerIds) {
    const profile = await dnaStorage.getProfile(seasonId, playerId);
    if (!profile) continue;

    let values = null;
    if (profile.genesV3 && profile.genesV3.value) {
      values = profile.genesV3.value;
    } else if (Array.isArray(profile.genes) && profile.genes.length) {
      values = profile.genes.reduce((acc, g) => {
        if (g.key && g.value != null) acc[g.key] = g.value;
        return acc;
      }, {});
    }
    if (!values) continue;

    for (const key of GENE_KEYS) {
      const v = values[key];
      if (v != null && Number.isFinite(v)) byGene[key].push(Number(v));
    }
  }

  return byGene;
}

/**
 * Compute pool statistics (median, MAD) per gene for the season and save to file.
 * @param {string} seasonId
 * @returns {Promise<Object>} pool stats object
 */
async function computePoolStats(seasonId) {
  const byGene = await collectPoolValues(seasonId);
  const genes = {};
  for (const key of GENE_KEYS) {
    const s = statsForGene(byGene[key] || []);
    if (s) genes[key] = s;
  }

  const payload = {
    version: 'pool_stats_v1',
    seasonId,
    updatedAt: new Date().toISOString(),
    genes,
  };

  await dnaStorage.savePoolStats(seasonId, payload);
  return payload;
}

/**
 * Load pool stats from DB.
 * @param {string} seasonId
 * @returns {Promise<Object|null>} { genes: { [geneKey]: { median, mad } }, ... } or null
 */
async function loadPoolStats(seasonId) {
  return dnaStorage.loadPoolStats(seasonId);
}

/**
 * Normalize a single raw value using pool median/MAD: median → 50, median±MAD → 50±25.
 * @param {number} raw - 0..100
 * @param {string} geneKey
 * @param {Object|null} poolStats - from loadPoolStats
 * @returns {number} clamped 0..100
 */
function normalizeValue(raw, geneKey, poolStats) {
  if (raw == null || !Number.isFinite(raw)) return raw;
  if (!poolStats?.genes?.[geneKey]) return Math.max(0, Math.min(100, raw));
  const { median: med, mad } = poolStats.genes[geneKey];
  const effectiveMad = Math.max(mad, MAD_MIN);
  if (effectiveMad < MAD_SKIP_NORMALIZE) {
    return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
  }
  const scale = SCALE_HALF_RANGE / effectiveMad;
  const normalized = 50 + (raw - med) * scale;
  return Math.max(0, Math.min(100, Math.round(normalized * 10) / 10));
}

/**
 * Normalize a full gene values object (e.g. match geneValues or profile.genesV3.value).
 * @param {Record<string, number>} geneValues
 * @param {Object|null} poolStats
 * @returns {Record<string, number>} new object with normalized values
 */
function normalizeGeneValues(geneValues, poolStats) {
  if (!geneValues || typeof geneValues !== 'object') return geneValues || {};
  if (!poolStats?.genes) return { ...geneValues };
  const out = {};
  for (const key of Object.keys(geneValues)) {
    const v = geneValues[key];
    if (key in poolStats.genes) {
      out[key] = normalizeValue(v, key, poolStats);
    } else {
      out[key] = v;
    }
  }
  return out;
}

module.exports = {
  computePoolStats,
  loadPoolStats,
  normalizeValue,
  normalizeGeneValues,
  collectPoolValues,
  GENE_KEYS,
};
