/**
 * DNA storage layer: profiles, baseline, pool stats in DB (no JSON files).
 * Uses main app DB (knex), not dna_test.
 * @module dna/dnaStorage
 */

const { db } = require('../../../../lib/db');
const { emptyCell } = require('./v3/baseline');
const { GENE_KEYS } = require('./constants');

/**
 * @param {string} seasonId
 * @param {string} playerId
 * @returns {Promise<Object|null>} Full profile object or null
 */
async function getProfile(seasonId, playerId) {
  const row = await db('dna_profiles')
    .where('season_id', String(seasonId))
    .whereRaw('LOWER(player_id) = LOWER(?)', [String(playerId)])
    .first('data', 'player_id');
  if (!row || !row.data) return null;
  try {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const storedPlayerId = row.player_id != null ? row.player_id : playerId;
    return { ...data, playerId: data.playerId || storedPlayerId, seasonId: data.seasonId || seasonId };
  } catch (_e) {
    return null;
  }
}

/**
 * @param {string} seasonId
 * @param {string} playerId
 * @param {Object} profile - Full profile object (genes, genesV3, matches, etc.)
 */
async function saveProfile(seasonId, playerId, profile) {
  const coreScore = profile.coreScore != null ? profile.coreScore : null;
  const lastUpdated = profile.lastUpdated || null;
  const lastUpdatedV3 = profile.lastUpdatedV3 || null;
  const data = JSON.stringify(profile);

  await db('dna_profiles')
    .insert({
      season_id: String(seasonId),
      player_id: String(playerId),
      core_score: coreScore,
      data,
      last_updated: lastUpdated,
      last_updated_v3: lastUpdatedV3,
    })
    .onConflict(['season_id', 'player_id'])
    .merge({
      core_score: coreScore,
      data,
      last_updated: lastUpdated,
      last_updated_v3: lastUpdatedV3,
    });
}

/**
 * @param {string} seasonId
 * @returns {Promise<string[]>} player_id list
 */
async function listPlayerIdsBySeason(seasonId) {
  const rows = await db('dna_profiles')
    .where({ season_id: String(seasonId) })
    .select('player_id');
  return rows.map((r) => r.player_id);
}

/**
 * @returns {Promise<string[]>} Distinct season_id values (from profiles and baselines)
 */
async function listSeasons() {
  const [fromProfiles, fromBaselines] = await Promise.all([
    db('dna_profiles').distinct('season_id').pluck('season_id'),
    db('dna_baselines').distinct('season_id').pluck('season_id'),
  ]);
  const set = new Set([...fromProfiles, ...fromBaselines].filter(Boolean));
  return [...set].sort();
}

/**
 * @param {string} seasonId
 * @returns {Promise<Object>} Baseline model (version, seasonId, global, bins) or default
 */
async function loadBaseline(seasonId) {
  const row = await db('dna_baselines')
    .where({ season_id: String(seasonId) })
    .first('data');
  if (!row || !row.data) {
    return {
      version: 'baseline_v1',
      seasonId,
      global: emptyCell(),
      bins: {},
    };
  }
  try {
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  } catch (_e) {
    return {
      version: 'baseline_v1',
      seasonId,
      global: emptyCell(),
      bins: {},
    };
  }
}

/**
 * @param {string} seasonId
 * @param {Object} baseline - Full baseline object
 */
async function saveBaseline(seasonId, baseline) {
  const data = JSON.stringify(baseline);
  const updatedAt = baseline.updatedAt || new Date().toISOString();

  await db('dna_baselines')
    .insert({
      season_id: String(seasonId),
      data,
      updated_at: updatedAt,
    })
    .onConflict('season_id')
    .merge({ data, updated_at: updatedAt });
}

/**
 * @param {string} seasonId
 * @returns {Promise<Object|null>} { genes: { [key]: { median, mad } }, updatedAt } or null
 */
async function loadPoolStats(seasonId) {
  const rows = await db('dna_pool_stats')
    .where({ season_id: String(seasonId) })
    .select('gene_key', 'median', 'mad', 'updated_at');
  if (!rows.length) return null;
  const genes = {};
  let updatedAt = null;
  for (const r of rows) {
    genes[r.gene_key] = { median: r.median, mad: r.mad };
    if (r.updated_at) updatedAt = r.updated_at;
  }
  return { version: 'pool_stats_v1', seasonId, genes, updatedAt };
}

/**
 * @param {string} seasonId
 * @param {Object} payload - { genes: { [key]: { median, mad } }, updatedAt }
 */
async function savePoolStats(seasonId, payload) {
  const updatedAt = payload.updatedAt || new Date().toISOString();
  const genes = payload.genes || {};

  await db('dna_pool_stats').where({ season_id: String(seasonId) }).del();

  const rows = GENE_KEYS.filter((k) => genes[k]).map((key) => ({
    season_id: String(seasonId),
    gene_key: key,
    median: Number(genes[key].median),
    mad: Number(genes[key].mad),
    updated_at: updatedAt,
  }));

  if (rows.length) {
    await db('dna_pool_stats').insert(rows);
  }
}

module.exports = {
  getProfile,
  saveProfile,
  listPlayerIdsBySeason,
  listSeasons,
  loadBaseline,
  saveBaseline,
  loadPoolStats,
  savePoolStats,
  GENE_KEYS,
};
