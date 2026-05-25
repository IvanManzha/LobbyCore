/**
 * DNA Engine: feature vectors v2 -> 7 genes (Combat, Pressure, Conversion, Survival, Positioning, Recovery, Teamwork).
 * Match score [10, 90], confidence-weighted EMA update, genes in [2, 98].
 */
const fs = require('fs').promises;
const { getFeaturesPath } = require('../../config/dataPaths');
const dnaStorage = require('./dnaStorage');
const { GENE_KEYS } = require('./constants');
const { archetypeFromGenes } = require('./archetype');

const GENE_LABELS = {
  combat: 'Combat',
  pressure: 'Pressure',
  conversion: 'Conversion',
  survival: 'Survival',
  positioning: 'Positioning',
  recovery: 'Recovery',
  teamwork: 'Teamwork',
};

/** Weights for total DNA rating (7 genes). */
const GENE_WEIGHTS = {
  combat: 1.1,
  pressure: 1,
  conversion: 1.1,
  survival: 1.05,
  positioning: 1.05,
  recovery: 1,
  teamwork: 1.05,
};

const DNA_RATING_MIN = 800;
const DNA_RATING_RANGE = 1400;

/** EMA learning rate. */
const ALPHA = 0.18;

/** Gene value bounds. */
const GENE_MIN = 2;
const GENE_MAX = 98;

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

/** sat(x; K) = clamp(x/K, 0, 1) */
function sat(x, K) {
  if (K <= 0) return 0;
  return clamp(Number(x) / K, 0, 1);
}

/**
 * Build helpers from one match feature vector (v2 fields + legacy aliases).
 * @param {Object} f - MatchFeatureVector (may have v2 names or legacy damageDealt, placement, etc.)
 */
function getHelpers(f) {
  const teamRank = f.teamRank ?? f.placement ?? 50;
  const numStartTeams = Math.max(2, Number(f.numStartTeams) || 16);
  const individualRank = f.individualRank ?? f.placement ?? 50;
  const numStartPlayers = Math.max(2, Number(f.numStartPlayers) || 100);

  const P_team = clamp(1 - (teamRank - 1) / (numStartTeams - 1), 0, 1);
  const P_ind = clamp(1 - (individualRank - 1) / (numStartPlayers - 1), 0, 1);

  const timeContact = Number(f.timeToFirstEnemyContactAfterLand) || 0;
  const survivalPost = Number(f.survivalAfterFirstEnemyContactSec) || 0;
  const EarlySafe = sat(timeContact, 240);
  const PostFight = sat(survivalPost, 180);

  const shots = Math.max(0, Number(f.shotsTotal) ?? Number(f.shotsApprox) ?? 0);
  const hits = Math.max(0, Number(f.enemyHits) ?? Number(f.engagementsCount) ?? 0);
  const HitRate = shots > 0 ? hits / shots : 0;

  const dOut = Math.max(0, Number(f.damageDealtLive) ?? Number(f.damageDealt) ?? 0);
  const dIn = Math.max(0, Number(f.damageTakenEnemy) ?? Number(f.damageTaken) ?? 0);
  const DmgEff = (dOut + dIn) > 0 ? dOut / (dOut + dIn) : 0.5;

  const firstOut = Number(f.firstOutgoingDamageSec);
  const firstIn = Number(f.firstIncomingDamageSec);
  let I = 0.5;
  if (firstOut >= 0 && firstIn >= 0) {
    if (firstOut < firstIn) I = 1;
    else if (firstOut > firstIn) I = 0;
  }

  const timeAlive = Number(f.timeAfterLandSec) ?? Number(f.timeAliveSeconds) ?? 0;
  const H = (timeAlive < 45 && dOut === 0) ? 1 : 0;

  return {
    P_team, P_ind, EarlySafe, PostFight, HitRate, DmgEff, I, H,
    shots, hits, dOut, dIn,
    k: Math.max(0, Number(f.kills) ?? 0),
    n: Math.max(0, Number(f.knocks) ?? 0),
    a: Math.max(0, Number(f.assists) ?? 0),
    r: Math.max(0, Number(f.revives) ?? 0),
    th: Math.max(0, Number(f.throwableUses) ?? 0),
    dTeam: Math.max(0, Number(f.damageDealtTeam) ?? 0),
    ff: Math.max(0, Number(f.friendlyFireIncidents) ?? 0),
    bPost: Math.max(0, Number(f.boostPointsAfterContact) ?? 0),
    rec: Math.max(0, Math.min(1, Number(f.recoveryAfterContactRatio) ?? 0)),
    tkp: Math.max(0, Math.min(1, Number(f.teamKillParticipationHuman) ?? 0)),
    timeAliveShare: Math.max(0, Math.min(1, Number(f.timeAliveShare) ?? 0)),
    hPost: Math.max(0, Number(f.healUsesAfterContact) ?? 0),
  };
}

/**
 * Match score for each of the 7 genes (1–100).
 * @param {Object} features - MatchFeatureVector v2 (or legacy with aliases)
 * @returns {{ combat, pressure, conversion, survival, positioning, recovery, teamwork }}
 */
function scoreMatchGenes(features) {
  const h = getHelpers(features);

  const Z = (h.shots >= 20 && h.hits === 0) ? 1 : 0;
  const W = (h.dOut >= 120 && h.k === 0 && h.n === 0) ? 1 : 0;
  const R0 = (h.dIn >= 80 && h.bPost === 0 && h.rec < 0.05) ? 1 : 0;

  const combat = clamp(
    36 + 18 * sat(h.dOut, 250) + 12 * sat(h.hits, 10) + 10 * sat(h.k + 0.5 * h.n, 2) + 8 * sat(h.HitRate, 0.18) - 8 * sat(h.dTeam, 50),
    1, 100
  );

  // Pressure: чуть снижаем базу и веса, чтобы не было систематического перекоса вверх.
  const pressure = clamp(
    40
      + 11 * (1 - h.EarlySafe)
      + 9 * sat(h.shots, 80)
      + 7 * sat(h.th, 3)
      + 7 * h.I
      + 7 * sat(h.dIn, 120)
      - 6 * Z,
    1, 100
  );

  const conversion = clamp(
    38 + 22 * sat(h.k + 0.7 * h.n, 2) + 14 * h.DmgEff + 8 * sat(h.HitRate, 0.18) - 10 * W,
    1, 100
  );

  // Survival: награждаем долгую жизнь, но чуть мягче по коэффициентам.
  const survival = clamp(
    34
      + 16 * h.P_team                    // плейсмент важен, но не доминирует
      + 3  * h.P_ind                     // индивидуальный плейсмент чуть добавляет
      + 20 * sat(h.timeAliveShare, 0.7)  // долгая жизнь → заметный, но не экстремальный буст
      + 10 * h.PostFight,                // жизнь после первого контакта
    1, 100
  );

  // Positioning: "насколько стабильно и аккуратно двигался по карте".
  // Базовый score в 0..1 из плейсмента, доли жизни и контактов.
  const posBase =
    0.4 * h.P_team +                       // хороший командный плейсмент = адекватные ротации
    0.3 * sat(h.timeAliveShare, 0.7) +     // долго жил → явно не фидил по позиционированию
    0.15 * h.PostFight +                   // выжил после первых серьёзных контактов
    0.1  * h.EarlySafe +                   // не лез в совсем бессмысленный ранний файт
    0.05 * (1 - h.H);                      // не умирал "без выстрела" в первые 45 сек

  // Не даём позиционированию падать в "абсолютный ноль" за единичные плохие матчи:
  // минимальное значение ~0.2 (≈ 20 по шкале 1–100) для совсем плохих игр.
  const posRaw = 0.2 + 0.8 * clamp(posBase, 0, 1);

  const positioning = clamp(
    1 + 99 * posRaw,                       // 0.2..1 → ≈20..100
    1, 100
  );
  const recovery = clamp(
    40 + 16 * sat(h.bPost, 100) + 16 * h.rec + 8 * sat(h.dIn, 150) + 8 * h.PostFight - 10 * R0,
    1, 100
  );
  const teamwork = clamp(
    38 + 18 * sat(h.a + h.r, 2) + 16 * sat(h.tkp, 1) + 8 * sat(h.k, 2) - 18 * sat(h.dTeam, 50) - 10 * sat(h.ff, 1),
    1, 100
  );

  return { combat, pressure, conversion, survival, positioning, recovery, teamwork };
}

/**
 * Confidence per gene for this match (0.25–1).
 * @param {Object} features - MatchFeatureVector v2
 * @returns {{ combat, pressure, conversion, survival, positioning, recovery, teamwork }}
 */
function getGeneConfidence(features) {
  const h = getHelpers(features);

  const combat = 0.25 + 0.75 * sat(h.shots + 2 * h.hits + h.dOut / 12, 60);
  const pressure = 0.30 + 0.70 * sat(h.shots + 3 * h.th + h.dIn / 8, 70);
  const conversion = 0.25 + 0.75 * sat(h.dOut / 20 + h.hits + 2 * h.k + h.n, 35);
  const survival = 0.50 + 0.50 * sat(h.timeAliveShare, 0.5);
  const timeContact = Number(features.timeToFirstEnemyContactAfterLand) || 0;
  const timeAliveMin = (Number(features.timeAfterLandSec) || 0) / 60;
  const positioning = 0.35 + 0.65 * sat(timeAliveMin + timeContact / 120, 6);
  const recovery = 0.25 + 0.75 * sat(h.dIn / 20 + h.bPost / 30 + 5 * h.hPost, 20);
  const teamwork = 0.25 + 0.75 * sat(6 * (h.a + h.r) + 20 * sat(h.tkp, 1) + 15 * h.ff, 40);

  return { combat, pressure, conversion, survival, positioning, recovery, teamwork };
}

/**
 * EMA update: G_new = clamp(G_prev + α * C * (S - G_prev), 2, 98).
 * @param {Object|Array} prevGenes - { combat, ... } or profile.genes array
 * @param {Object} scores - scoreMatchGenes result
 * @param {Object} confidence - getGeneConfidence result
 * @returns {{ [key: string]: number }}
 */
function updateGenes(prevGenes, scores, confidence) {
  const prev = toGeneObject(prevGenes);
  const out = {};
  for (const key of GENE_KEYS) {
    const G = prev[key] ?? 50;
    const S = scores[key] ?? 50;
    const C = confidence[key] ?? 0.5;
    const next = G + ALPHA * C * (S - G);
    out[key] = clamp(next, GENE_MIN, GENE_MAX);
  }
  return out;
}

function toGeneObject(genes) {
  if (!genes) return {};
  if (Array.isArray(genes)) {
    return genes.reduce((acc, g) => ({ ...acc, [g.key]: g.value }), {});
  }
  return { ...genes };
}

/**
 * Compute 7 genes from feature vectors: start at 50, apply EMA per match with confidence.
 * @param {Object[]} featureVectors - chronological order
 * @param {{ calibrationEndIndex?: number }} [options] - ignored (no calibration in 7-gene flow)
 * @returns {{ genes: Array<{ key, label, value, trend }>, matchGeneValues: Object[] }}
 */
function computeGenes(featureVectors, options = {}) {
  const n = featureVectors.length;
  let current = {};
  GENE_KEYS.forEach((k) => { current[k] = 50; });

  const matchGeneValues = [];
  let prevGenes = { ...current };

  for (let i = 0; i < n; i++) {
    const vec = featureVectors[i] || {};
    if (vec.isTeamMode === false) {
      current.teamwork = prevGenes.teamwork ?? 50;
    }
    const scores = scoreMatchGenes(vec);
    const conf = getGeneConfidence(vec);
    current = updateGenes(current, scores, conf);
    matchGeneValues.push({ ...scores });
    prevGenes = { ...current };
  }

  const genes = GENE_KEYS.map((key) => {
    const valueNum = current[key] ?? 50;
    const value = valueNum;
    let trend = 0;
    if (n > 0) {
      const lastScores = matchGeneValues[n - 1] || {};
      const prev = n > 1 ? (() => {
        let p = {};
        GENE_KEYS.forEach((k) => { p[k] = 50; });
        for (let j = 0; j < n - 1; j++) {
          const s = scoreMatchGenes(featureVectors[j] || {});
          const c = getGeneConfidence(featureVectors[j] || {});
          p = updateGenes(p, s, c);
        }
        return p;
      })() : { [key]: 50 };
      trend = Number((valueNum - (prev[key] ?? 50)).toFixed(1));
    }
    return {
      key,
      label: GENE_LABELS[key] || key,
      value,
      trend,
    };
  });

  return { genes, matchGeneValues };
}

/**
 * Debug: genes + matchGeneValues + per-match scores/confidence.
 */
function computeGenesDebug(featureVectors) {
  const { genes, matchGeneValues } = computeGenes(featureVectors);
  const rawPerMatch = featureVectors.map((vec, i) => ({
    scores: scoreMatchGenes(vec || {}),
    confidence: getGeneConfidence(vec || {}),
    valueAfter: matchGeneValues[i] || {},
  }));
  return { genes, matchGeneValues, rawPerMatch };
}

/**
 * Compute total DNA rating from genes array (0-100 each). Scaled to 800-2200.
 */
function computeDnaRating(genes) {
  if (!Array.isArray(genes) || genes.length === 0) return DNA_RATING_MIN;
  let wSum = 0;
  let vSum = 0;
  for (const g of genes) {
    const w = GENE_WEIGHTS[g.key] ?? 1;
    const v = typeof g.value === 'number' ? Math.max(0, Math.min(100, g.value)) : 50;
    wSum += w;
    vSum += v * w;
  }
  const weightedAvg = wSum > 0 ? vSum / wSum : 50;
  const rating = DNA_RATING_MIN + (weightedAvg / 100) * DNA_RATING_RANGE;
  return Math.round(Math.max(DNA_RATING_MIN, Math.min(DNA_RATING_MIN + DNA_RATING_RANGE, rating)));
}

/**
 * Map DNA rating [800, 2200] to tier 1–8 (equal bands).
 */
function computeDnaTier(rating) {
  if (rating == null || !Number.isFinite(rating)) return 1;
  const r = clamp(Math.round(rating), DNA_RATING_MIN, DNA_RATING_MIN + DNA_RATING_RANGE);
  const frac = (r - DNA_RATING_MIN) / DNA_RATING_RANGE; // 0..1
  const tier = 1 + Math.floor(frac * 8); // 1..9 before clamp
  return Math.max(1, Math.min(8, tier));
}

/**
 * Calibration end index (kept for API compatibility; not used in 7-gene computeGenes).
 */
function getCalibrationEndIndex(matchesMeta, totalCount) {
  if (!matchesMeta?.length || totalCount === 0) return 0;
  return Math.min(8, totalCount);
}

function computeConfidence(matchesCount, coverage = 1) {
  const n = matchesCount || 0;
  let level = 0;
  let label = 'low';
  if (n >= 15) { level = 0.95; label = 'high'; }
  else if (n >= 8) { level = 0.7; label = 'medium'; }
  else if (n >= 3) { level = 0.4; label = 'low'; }
  level *= coverage;
  return { level, matchesCount: n, label };
}

function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Build DNAProfile from ordered match list and feature vectors (7 genes).
 */
function buildProfile(playerId, seasonId, matchesMeta, featureVectors) {
  const { genes, matchGeneValues } = computeGenes(featureVectors);
  const matchesCount = featureVectors.length;
  const confidence = computeConfidence(matchesCount);

  const matches = matchesMeta.map((m, i) => {
    const vec = featureVectors[i] || {};
    const geneValues = i < matchGeneValues.length ? matchGeneValues[i] : {};
    return {
      id: m.matchId,
      matchId: m.matchId,
      label: `Match ${i + 1}`,
      order: i,
      dateISO: m.dateISO,
      dateShort: formatDateShort(m.dateISO),
      summary: {
        kills: vec.kills ?? 0,
        damage: vec.damageDealt ?? vec.damageDealtLive ?? 0,
        placement: vec.placement ?? vec.individualRank ?? 99,
        win: (vec.win || vec.individualRank === 1) ? true : false,
      },
      geneValues,
    };
  });

  const coreScore = computeDnaRating(genes);
  const dominantTrait = archetypeFromGenes(genes);

  return {
    playerId,
    seasonId,
    genesVersion: 2,
    coreScore,
    dominantTrait,
    genes,
    matches,
    seasonSlice: { seasonId, matchIds: matchesMeta.map((m) => m.matchId) },
    confidence,
  };
}

async function loadFeatureVectors(playerId, matchIds) {
  const out = [];
  for (const matchId of matchIds) {
    const fp = getFeaturesPath(matchId, playerId);
    try {
      const raw = await fs.readFile(fp, 'utf8');
      out.push({ matchId, vector: JSON.parse(raw) });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  return out;
}

async function recompute(playerId, seasonId, matchIds, datesByMatchId = {}) {
  const loaded = await loadFeatureVectors(playerId, matchIds);
  const featureVectors = loaded.map((x) => x.vector);
  const matchesMeta = loaded.map((x, i) => ({
    matchId: x.matchId,
    dateISO: Array.isArray(datesByMatchId) ? datesByMatchId[i]?.dateISO : (datesByMatchId[x.matchId] || {}).dateISO,
  }));

  const profile = buildProfile(playerId, seasonId, matchesMeta, featureVectors);
  profile.lastUpdated = new Date().toISOString();
  await dnaStorage.saveProfile(seasonId, playerId, profile);
  return profile;
}

module.exports = {
  computeGenes,
  computeGenesDebug,
  computeConfidence,
  computeDnaRating,
  buildProfile,
  loadFeatureVectors,
  recompute,
  getCalibrationEndIndex,
  scoreMatchGenes,
  getGeneConfidence,
  updateGenes,
  getHelpers,
  GENE_KEYS,
  GENE_LABELS,
  GENE_WEIGHTS,
  ALPHA,
  GENE_MIN,
  GENE_MAX,
  computeDnaTier,
};
