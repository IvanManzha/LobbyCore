/**
 * DNA v3 — actual and proxy vectors per gene (0..1) from bucket features.
 * Refactored: TAC/SUR/POS/RES/COM/AGR new formulas; AIM and TMW unchanged.
 * @module dna/v3/actualProxy
 */

const { GENES } = require('./types');
const { softcap } = require('./features');

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

/**
 * Compute actual (core signal) and proxy (always defined) per gene from bucket features.
 * @param {Object} features - from extractBucketsFromVector (includes raw + softcapHealBoost, zoneDmgN, etc.)
 * @param {Object} [context] - { C, N, R, L } (optional, for future use)
 * @param {string} quality - 'OK'|'PARTIAL'|'NONE'
 * @returns {{ actual: Record<string, number>, proxy: Record<string, number> }}
 */
function computeActualProxyVectors(features, context, quality) {
  const f = features || {};
  const d = f.damageDealt != null ? f.damageDealt : 0;
  const dt = f.damageTaken != null ? f.damageTaken : 0;
  const k = f.kills != null ? f.kills : 0;
  const a = f.assists != null ? f.assists : 0;
  const t = f.timeAliveSeconds != null ? f.timeAliveSeconds : 0;
  const heal = f.healsUsed != null ? f.healsUsed : 0;
  const boost = f.boostsUsed != null ? f.boostsUsed : 0;
  const revives = f.revives != null ? f.revives : 0;
  const place = Math.max(1, Math.min(99, f.placement != null ? f.placement : 99));
  const win = f.win ? 1 : 0;
  const ratio = d + dt > 0 ? d / (d + dt) : 0.5;
  const placeScore = f.placeScore != null ? f.placeScore : clamp01((100 - place) / 99);

  // Normalized inputs (from features or computed)
  const dmgTakenPlayersN = clamp01(dt / 1200);
  const zoneDmgN = f.zoneDmgN != null ? f.zoneDmgN : 0;
  const aliveN = clamp01(t / 1800);
  const durationSec = f.durationSec || 1200;
  const timeInBlueSec = f.timeInBlueSeconds != null ? f.timeInBlueSeconds : 0;
  const outsideTimeSec = Math.max(0, durationSec - timeInBlueSec);
  const normOutsideTimeSec = f.normOutsideTimeSec != null ? f.normOutsideTimeSec : clamp01(outsideTimeSec / 950);
  const normZoneEntries = f.normZoneEntries != null ? f.normZoneEntries : clamp01(timeInBlueSec / Math.max(1, durationSec));
  const softcapHealBoost = f.softcapHealBoost != null ? f.softcapHealBoost : softcap(heal + boost, 10);
  const softcapThrowables = f.softcapThrowables != null ? f.softcapThrowables : 0;
  const softcapEngagements = f.softcapEngagements != null ? f.softcapEngagements : softcap(k * 2 + a, 8);
  const damageExchanged = f.damageExchanged != null ? f.damageExchanged : d + dt;
  const combatTimeProxy = Math.min(600, damageExchanged / 2);
  const shotsProxy = f.shotsApprox != null && f.shotsApprox > 0 ? f.shotsApprox : damageExchanged / 40;

  const R = context && context.R != null ? context.R : 0.5;
  const C = context && context.C != null ? context.C : 0.5;
  const L = context && context.L != null ? context.L : 0.5;
  const vehicleDistance = f.vehicleDistance != null ? f.vehicleDistance : 0;
  const distN = clamp01(vehicleDistance / 9000);
  const vehN = clamp01(vehicleDistance / 30000);
  const overRot = softcap(distN, 0.6) * (1 - R) + 0.6 * softcap(vehN, 0.6);
  const outsideN = normOutsideTimeSec;

  const actual = {};
  const proxy = {};

  // AIM (accuracy) — unchanged
  actual.accuracy = d > 0 ? clamp01(0.4 + ratio * 0.3 + (k / 12) * 0.25) : 0.5;
  proxy.accuracy = d > 0 ? actual.accuracy : clamp01(0.4 + placeScore * 0.2);

  // TAC (tactics): aliveN, placeScore, (1-dmgTakenPlayersN), (1-zoneDmgN)
  actual.tactics = clamp01(0.30 * aliveN + 0.25 * placeScore + 0.25 * (1 - dmgTakenPlayersN) + 0.20 * (1 - zoneDmgN));
  proxy.tactics = clamp01(0.55 * placeScore + 0.45 * (1 - dmgTakenPlayersN));

  // AGR (aggression): norm(kills), softcapEngagements, earlyFight proxy
  const normKills = clamp01(k / 8);
  const earlyFightProxy = f.normCombatTime != null ? f.normCombatTime : clamp01(damageExchanged / 800);
  actual.aggression = clamp01(0.45 * normKills + 0.30 * softcapEngagements + 0.25 * earlyFightProxy);
  proxy.aggression = clamp01(0.5 * softcap(shotsProxy, 250) + 0.5 * softcap(combatTimeProxy, 600));

  // SUR (survival): aliveN, placeScore, (1-timesKnocked), (1-dmgTakenPlayersN); timesKnocked proxy = revives/5
  const timesKnockedProxy = clamp01(revives / 5);
  actual.survival = clamp01(0.35 * aliveN + 0.25 * placeScore + 0.25 * (1 - timesKnockedProxy) + 0.15 * (1 - dmgTakenPlayersN));
  proxy.survival = clamp01(0.60 * placeScore + 0.40 * aliveN);

  // POS (positioning): место в матче напрямую влияет — placement основной драйвер
  const zoneEntriesN = normZoneEntries;
  actual.positioning = clamp01(
    0.60 * placeScore +
      0.15 * (1 - zoneDmgN) +
      0.15 * (1 - outsideN) +
      0.10 * (1 - overRot)
  );
  proxy.positioning = clamp01(0.70 * placeScore + 0.20 * (1 - zoneDmgN) + 0.10 * (1 - overRot));

  // TMW (teamwork) — unchanged
  actual.teamwork = clamp01(0.3 + (a / 6) * 0.35 + (revives / 4) * 0.35);
  proxy.teamwork = clamp01(0.35 + (a + revives) / 12);

  // RES (resource): softcapHealBoost, softcapThrowables, (1-zoneDmgN), (1-dmgTakenPlayersN)
  actual.resource = clamp01(0.35 * softcapHealBoost + 0.25 * softcapThrowables + 0.20 * (1 - zoneDmgN) + 0.20 * (1 - dmgTakenPlayersN));
  proxy.resource = clamp01(0.60 * softcapHealBoost + 0.40 * softcapThrowables);

  // COM (composure): pressure gating — only "real" under pressure; base = quality under fire
  const acc = ratio;
  const sprayIndex = 1 - acc;
  const surviveUnderFire = clamp01((f.normCombatTime != null ? f.normCombatTime * 800 : damageExchanged) / 600) * (1 - dmgTakenPlayersN);
  const base = clamp01(0.35 * (1 - sprayIndex) + 0.25 * acc + 0.20 * (1 - zoneDmgN) + 0.20 * surviveUnderFire);
  const pressure = clamp01(0.6 * C + 0.4 * L);
  actual.composure = clamp01(0.50 * (1 - pressure) + pressure * base);
  proxy.composure = clamp01(0.45 * (1 - sprayIndex) + 0.35 * (1 - dmgTakenPlayersN) + 0.20 * (1 - zoneDmgN));

  if (quality === 'NONE') {
    for (const g of GENES) {
      actual[g] = proxy[g] != null ? proxy[g] : 0.5;
    }
  } else if (quality === 'PARTIAL') {
    for (const g of GENES) {
      actual[g] = 0.5 * (actual[g] ?? 0.5) + 0.5 * (proxy[g] ?? 0.5);
    }
  }

  return { actual, proxy };
}

module.exports = {
  computeActualProxyVectors,
};
