/**
 * DNA v3 — bucket features from raw match vector and match duration.
 * Produces normalized 0..1 fields for context and actual/proxy.
 * @module dna/v3/features
 */

const DEFAULT_MATCH_DURATION_SEC = 1200;

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

/**
 * Softcap for count-like metrics: 1 - exp(-x/k). Result in 0..1 for x >= 0.
 * Reduces sharp jumps from a few items.
 * @param {number} x - raw count
 * @param {number} k - scale (e.g. 10 for heals+boosts, 8 for engagements)
 * @returns {number} 0..1
 */
function softcap(x, k) {
  const val = Number(x) || 0;
  if (val <= 0) return 0;
  const scale = Number(k) || 1;
  return 1 - Math.exp(-val / scale);
}

/**
 * Build normalized bucket features from raw feature vector (from featureExtractor.extractFeatures).
 * @param {Object} rawVector - { damageDealt, damageTaken, kills, assists, timeAliveSeconds, timeInBlueSeconds, healsUsed, boostsUsed, vehicleDistance, revives, placement, win }
 * @param {number} [matchDurationSec] - match length in seconds (default 1200)
 * @returns {Object} Bucket features in 0..1: normCombatTime, normEngagements, normDamageExchanged, normSquadKnocks, normReviveNeed, normOutsideTime, normZoneEntries, normDistance, placeScore, normAliveTime
 */
function extractBucketsFromVector(rawVector, matchDurationSec = DEFAULT_MATCH_DURATION_SEC) {
  const d = rawVector || {};
  const duration = Math.max(1, matchDurationSec || DEFAULT_MATCH_DURATION_SEC);
  const damageDealt = Number(d.damageDealt) || 0;
  const damageTaken = Number(d.damageTaken) || 0;
  const kills = Number(d.kills) || 0;
  const assists = Number(d.assists) || 0;
  const timeAlive = Math.max(0, Number(d.timeAliveSeconds) || 0);
  const timeInBlue = Math.max(0, Number(d.timeInBlueSeconds) || 0);
  const healsUsed = Number(d.healsUsed) || 0;
  const boostsUsed = Number(d.boostsUsed) || 0;
  const vehicleDistance = Number(d.vehicleDistance) || 0;
  const revives = Number(d.revives) || 0;
  const placement = Math.max(1, Math.min(100, Number(d.placement) || 99));
  const win = d.win ? 1 : 0;

  const damageExchanged = damageDealt + damageTaken;
  const normCombatTime = clamp01(damageExchanged / 800);
  const normEngagements = clamp01((kills * 2 + assists) / 15);
  const normDamageExchanged = clamp01(damageExchanged / 1000);
  const normSquadKnocks = clamp01((assists + revives) / 8);
  const normReviveNeed = clamp01(revives / 5);
  const normOutsideTime = clamp01(1 - timeInBlue / duration);
  const normZoneEntries = clamp01(timeInBlue / duration);
  const normDistance = clamp01(vehicleDistance / 50000);
  const placeScore = clamp01((100 - placement) / 99);
  const normAliveTime = clamp01(timeAlive / duration);

  // Softcap buckets (k: heals+boosts 10, throwables 8, engagements 8, revives 3)
  const softcapHealBoost = softcap(healsUsed + boostsUsed, 10);
  const throwablesRaw = (Number(d.throwablesUsed) || 0) + (Number(d.smokesUsed) || 0) + (Number(d.grenadesUsed) || 0);
  const softcapThrowables = softcap(throwablesRaw, 8);
  const softcapEngagements = softcap(kills * 2 + assists, 8);
  const softcapRevives = softcap(revives, 3);

  // Optional: zoneDamage, outsideTime for POS/TAC/RES (when featureExtractor provides them)
  const zoneDamage = Number(d.zoneDamage) || 0;
  const zoneDmgN = clamp01(zoneDamage / 280);
  const outsideTimeSec = Math.max(0, duration - timeInBlue);
  const normOutsideTimeSec = clamp01(outsideTimeSec / 950);
  const shotsApprox = d.shotsApprox != null ? Number(d.shotsApprox) : null;

  const isTeamMode = d.isTeamMode !== false;

  return {
    normCombatTime,
    normEngagements,
    normDamageExchanged,
    normSquadKnocks,
    normReviveNeed,
    normOutsideTime,
    normZoneEntries,
    normDistance,
    placeScore,
    normAliveTime,
    softcapHealBoost,
    softcapThrowables,
    softcapEngagements,
    softcapRevives,
    zoneDmgN,
    normOutsideTimeSec,
    shotsApprox,
    isTeamMode,
    // pass-through for actual/proxy
    damageDealt,
    damageTaken,
    kills,
    assists,
    timeAliveSeconds: timeAlive,
    healsUsed,
    boostsUsed,
    revives,
    placement,
    win,
    durationSec: duration,
    timeInBlueSeconds: timeInBlue,
    zoneDamage,
    damageExchanged,
    vehicleDistance,
  };
}

module.exports = {
  extractBucketsFromVector,
  softcap,
  clamp01,
  DEFAULT_MATCH_DURATION_SEC,
};
