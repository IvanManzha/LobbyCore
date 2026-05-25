/**
 * DNA v3 — orchestration: one-match update for a player (features → context → baseline blend → genes update).
 * @module dna/v3/updatePlayerDNA
 */

const dnaStorage = require('../dnaStorage');
const featureExtractor = require('../featureExtractor');
const { GENES } = require('./types');
const { extractBucketsFromVector, DEFAULT_MATCH_DURATION_SEC } = require('./features');
const { computeContext, contextKey } = require('./context');
const { computeActualProxyVectors } = require('./actualProxy');
const { blendExpected, updateBaselineFromMatch, emptyCell } = require('./baseline');
const { updateGenesV3 } = require('./genes_v3');
const dnaEngine = require('../dnaEngine');
const { updateGenes: updateGenesAdditive } = require('../geneUpdate');

/**
 * Get match duration in seconds from telemetry (first/last event time or default).
 * @param {Object|Array} telemetry
 * @returns {number}
 */
function getMatchDurationSec(telemetry) {
  let events = telemetry;
  if (telemetry && Array.isArray(telemetry.events)) events = telemetry.events;
  else if (telemetry && Array.isArray(telemetry.Telemetry)) events = telemetry.Telemetry;
  if (!Array.isArray(events) || events.length < 2) return DEFAULT_MATCH_DURATION_SEC;
  const parseTime = (evt) => {
    const d = evt._D ?? evt.eventTime ?? evt.event_time;
    if (d == null) return 0;
    if (typeof d === 'number' && Number.isFinite(d)) return d < 1e12 ? d : d / 1000;
    return new Date(d).getTime() / 1000;
  };
  const first = parseTime(events[0]);
  const last = parseTime(events[events.length - 1]);
  const dur = last - first;
  return dur > 0 && dur < 3600 ? Math.round(dur) : DEFAULT_MATCH_DURATION_SEC;
}

/**
 * Determine match quality from raw vector and telemetry presence.
 * @param {Object} rawVector
 * @param {boolean} hasTelemetry
 * @returns {'OK'|'PARTIAL'|'NONE'}
 */
function getMatchQuality(rawVector, hasTelemetry) {
  if (!hasTelemetry) return 'NONE';
  const v = rawVector || {};
  const hasPlacement = v.placement != null && v.placement >= 1 && v.placement <= 100;
  const hasSomeEvents = (v.damageDealt || 0) + (v.damageTaken || 0) + (v.kills || 0) > 0 || (v.timeAliveSeconds || 0) > 60;
  if (hasPlacement && hasSomeEvents) return 'OK';
  if (hasPlacement) return 'PARTIAL';
  return 'NONE';
}

function createInitialPlayerState(seasonId) {
  const value = {};
  const skill = {};
  const form = {};
  const actualHist = {};
  for (const g of GENES) {
    value[g] = 50;
    skill[g] = 0;
    form[g] = 0;
    actualHist[g] = [];
  }
  return { seasonId, value, skill, form, actualHist };
}

/**
 * Load or create baseline for season (from DB).
 * @param {string} seasonId
 * @returns {Promise<Object>} BaselineModel
 */
async function loadBaseline(seasonId) {
  return dnaStorage.loadBaseline(seasonId);
}

/**
 * Save baseline to DB.
 * @param {Object} baseline
 * @param {string} seasonId
 */
async function saveBaseline(baseline, seasonId) {
  await dnaStorage.saveBaseline(seasonId, baseline);
}

/**
 * Save player genesV3 state into profile (merge with existing profile in DB).
 * @param {string} playerId
 * @param {string} seasonId
 * @param {Object} playerState - PlayerGeneState
 */
async function savePlayerState(playerId, seasonId, playerState) {
  const profile = (await dnaStorage.getProfile(seasonId, playerId)) || {};
  profile.genesV3 = playerState;
  profile.lastUpdatedV3 = new Date().toISOString();
  profile.playerId = profile.playerId || playerId;
  profile.seasonId = profile.seasonId || seasonId;
  await dnaStorage.saveProfile(seasonId, playerId, profile);
}

/**
 * Update player DNA state for one match. Loads/saves baseline and profile when loadSave is true.
 * @param {Object} args
 * @param {Object} args.player - PlayerGeneState (if null, will be loaded from profile or created)
 * @param {Object} args.baseline - BaselineModel (if null, will be loaded)
 * @param {Object|Array} args.telemetry - match telemetry
 * @param {string} args.playerId
 * @param {string} args.seasonId
 * @param {'OK'|'PARTIAL'|'NONE'} [args.quality] - if not provided, computed from vector/telemetry
 * @param {boolean} [args.loadSave=true] - if true, load baseline and profile from disk and save after update
 * @returns {Promise<{ player: Object, baseline: Object, debug: Object }>}
 */
async function updatePlayerDNAForMatch(args) {
  const {
    player: playerIn,
    baseline: baselineIn,
    telemetry,
    playerId,
    seasonId,
    quality: qualityIn,
    loadSave = true,
  } = args;

  let baseline = baselineIn;
  let player = playerIn;
  if (loadSave) {
    if (!baseline) baseline = await loadBaseline(seasonId);
    if (!player) {
      const profile = await dnaStorage.getProfile(seasonId, playerId);
      player = (profile && profile.genesV3) ? profile.genesV3 : createInitialPlayerState(seasonId);
    }
  } else {
    if (!baseline) baseline = { version: 'baseline_v1', seasonId, global: emptyCell(), bins: {} };
    if (!player) player = createInitialPlayerState(seasonId);
  }

  const rawVector = featureExtractor.extractFeatures(telemetry, playerId);
  const durationSec = getMatchDurationSec(telemetry);
  const features = extractBucketsFromVector(rawVector, durationSec);
  const ctx = computeContext(features);
  const key = contextKey(ctx);
  const quality = qualityIn != null ? qualityIn : getMatchQuality(rawVector, !!telemetry);
  const { actual, proxy } = computeActualProxyVectors(features, ctx, quality);
  const expected = blendExpected(baseline, key, quality);
  const isTeamMode = features.isTeamMode !== false;
  const { next, debug } = updateGenesV3({
    player,
    contextKey: key,
    context: ctx,
    actual,
    proxy,
    expected,
    isTeamMode,
  });
  next.prevValue = player.value ? { ...player.value } : {};
  updateBaselineFromMatch(baseline, key, actual, quality);

  // v2-style additive genes (smooth 7-gene profile) driven by match scores + confidence.
  // IMPORTANT: use raw v2 feature vector (rawVector), not bucketized features,
  // otherwise scores clamp вокруг 50 и гены «залипают» в середине шкалы.
  try {
    const scores = dnaEngine.scoreMatchGenes(rawVector || {});
    const confidence = dnaEngine.getGeneConfidence(rawVector || {});
    const prevGenesObj = player.value || {};
    const updatedGenes = updateGenesAdditive(prevGenesObj, scores, confidence);
    next.value = { ...(next.value || {}), ...updatedGenes };
  } catch (_e) {
    // non-fatal: keep previous next.value if additive update fails
  }

  if (loadSave) {
    await savePlayerState(playerId, seasonId, next);
    await saveBaseline(baseline, seasonId);
  }

  return { player: next, baseline, debug };
}

module.exports = {
  updatePlayerDNAForMatch,
  loadBaseline,
  saveBaseline,
  savePlayerState,
  createInitialPlayerState,
  getMatchQuality,
  getMatchDurationSec,
};
