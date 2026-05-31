const path = require('path');
const fs = require('fs').promises;
const { dbDnaTest } = require('../../../../lib/db');
const dnaStorage = require('./dnaStorage');
const dnaEngine = require('./dnaEngine');
const { GENE_KEYS } = require('./constants');
const poolStats = require('./poolStats');
const { archetypeFromGenes, strongestWeakestGenes } = require('./archetype');
const featureExtractor = require('./featureExtractor');

const DEFAULT_SEASON = process.env.DNA_DEFAULT_SEASON || '2025';

const DICTIONARY_PATH = path.join(__dirname, '..', '..', 'data', 'dna_dictionary.json');
let dictionaryCache = null;

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function confidenceLabelFromMatches(matchesCount) {
  if (matchesCount >= 15) return 'high';
  if (matchesCount >= 6) return 'medium';
  return 'low';
}

function asNumberOrNull(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function genesArrayToMap(genes) {
  const out = {};
  if (!Array.isArray(genes)) return out;
  for (const g of genes) {
    if (!g || !g.key) continue;
    const v = asNumberOrNull(g.value);
    if (v == null) continue;
    out[String(g.key)] = v;
  }
  return out;
}

function mapToGenesArray(geneValues, dictionaryByKey = {}) {
  const values = geneValues && typeof geneValues === 'object' ? geneValues : {};
  return GENE_KEYS.map((key) => {
    const dict = dictionaryByKey[key] || {};
    const value = asNumberOrNull(values[key]);
    return {
      key,
      label: dict.label || dict.name || key,
      shortLabel: dict.shortLabel,
      value,
    };
  });
}

function buildDictionaryIndex(list) {
  const byKey = {};
  for (const item of list || []) {
    const key = item?.key || item?.id;
    if (key) byKey[String(key)] = item;
  }
  return byKey;
}

async function getDictionary() {
  if (dictionaryCache) return dictionaryCache;
  try {
    const raw = await fs.readFile(DICTIONARY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    dictionaryCache = Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    dictionaryCache = [];
  }
  return dictionaryCache;
}

async function getAvailableSeasons() {
  const seasons = await dnaStorage.listSeasons().catch(() => []);
  const set = new Set((seasons || []).filter(Boolean).map(String));
  set.add(String(DEFAULT_SEASON));
  set.add(String(new Date().getFullYear()));
  return Array.from(set).sort();
}

function buildStubProfile(playerId, seasonId) {
  return {
    playerId,
    seasonId,
    coreScore: null,
    genes: [],
    matches: [],
    matchHistory: [],
    reasons: { perGene: {} },
    confidence: { level: 0, matchesCount: 0, label: 'low' },
    seasonSlice: { seasonId, matchIds: [] },
    lastUpdated: null,
    lastUpdatedV3: null,
  };
}

async function buildProfileFromDnaTestDbV3(playerId, seasonId = DEFAULT_SEASON) {
  let row;
  try {
    row = await dbDnaTest('dna_profiles')
      .where('season_id', String(seasonId))
      .whereRaw('LOWER(player_id) = LOWER(?)', [String(playerId)])
      .first('data', 'player_id');
  } catch (e) {
    // Тестовая БД может не иметь таблицы dna_profiles (миграции не запускали)
    if (e?.code === 'SQLITE_ERROR' || e?.message?.includes('no such table')) return null;
    throw e;
  }
  if (!row || !row.data) return null;
  try {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const storedPlayerId = row.player_id != null ? row.player_id : playerId;
    return { ...data, playerId: data.playerId || storedPlayerId, seasonId: data.seasonId || seasonId };
  } catch (_parseErr) {
    return null;
  }
}

async function getProfileOrStub(playerId, seasonId = DEFAULT_SEASON, options = {}) {
  const useDnaTest = options?.useDnaTest === true;
  const season = String(seasonId || DEFAULT_SEASON);
  const id = String(playerId || '').trim();
  if (!id) return buildStubProfile('', season);

  const profile = useDnaTest
    ? await buildProfileFromDnaTestDbV3(id, season)
    : await dnaStorage.getProfile(season, id);

  return profile || buildStubProfile(id, season);
}

function computeCoverage(profile) {
  const matches = Array.isArray(profile?.matchHistory) && profile.matchHistory.length
    ? profile.matchHistory
    : (Array.isArray(profile?.matches) ? profile.matches : []);
  let matchesTotal = matches.length;
  let telemetryMatches = matches.filter((m) => m && m.geneValues && typeof m.geneValues === 'object').length;

  // Если матчей нет, но есть гены (старый формат профиля без history) — считаем, что матчей было достаточно.
  if (matchesTotal === 0) {
    const hasGenesV3 = !!(profile?.genesV3 && profile.genesV3.value && typeof profile.genesV3.value === 'object');
    const hasGenesArr = Array.isArray(profile?.genes) && profile.genes.length > 0;
    if (hasGenesV3 || hasGenesArr) {
      matchesTotal = 10;
      telemetryMatches = 0;
    }
  }

  return { matchesTotal, telemetryMatches };
}

async function mapProfileToV2(profile, poolStatsData = null) {
  const dict = await getDictionary();
  const dictByKey = buildDictionaryIndex(dict);

  const base = profile && typeof profile === 'object' ? profile : {};
  const seasonId = String(base.seasonId || DEFAULT_SEASON);
  const playerId = String(base.playerId || '');

  const matchHistory = Array.isArray(base.matchHistory) && base.matchHistory.length
    ? base.matchHistory
    : (Array.isArray(base.matches) ? base.matches : []);

  let rawValues =
    (base.genesV3 && base.genesV3.value && typeof base.genesV3.value === 'object')
      ? base.genesV3.value
      : (Array.isArray(base.genes) ? genesArrayToMap(base.genes) : {});

  // Если в профиле из тестовой БД нет верхнеуровневых генов, но есть matchHistory с geneValues — берём из последнего матча
  if (!rawValues || Object.keys(rawValues).length === 0) {
    const lastMatch = matchHistory.length ? matchHistory[matchHistory.length - 1] : null;
    if (lastMatch?.geneValues && typeof lastMatch.geneValues === 'object' && Object.keys(lastMatch.geneValues).length > 0) {
      rawValues = lastMatch.geneValues;
    }
  }

  const normalizedValues = poolStatsData ? poolStats.normalizeGeneValues(rawValues, poolStatsData) : { ...rawValues };
  const genes = mapToGenesArray(normalizedValues, dictByKey);

  const last = matchHistory.length ? matchHistory[matchHistory.length - 1] : null;
  const prev = matchHistory.length >= 2 ? matchHistory[matchHistory.length - 2] : null;
  const lastGeneValues = last?.geneValues && typeof last.geneValues === 'object'
    ? (poolStatsData ? poolStats.normalizeGeneValues(last.geneValues, poolStatsData) : last.geneValues)
    : null;
  const prevGeneValues = prev?.geneValues && typeof prev.geneValues === 'object'
    ? (poolStatsData ? poolStats.normalizeGeneValues(prev.geneValues, poolStatsData) : prev.geneValues)
    : null;

  const genesWithTrend = genes.map((g) => {
    if (!g || !g.key) return g;
    const key = g.key;
    const a = lastGeneValues ? asNumberOrNull(lastGeneValues[key]) : null;
    const b = prevGeneValues ? asNumberOrNull(prevGeneValues[key]) : null;
    if (a == null || b == null) return { ...g, trend: null };
    const delta = Math.round((a - b) * 10) / 10;
    return { ...g, trend: { delta, direction: delta > 0.6 ? 'up' : delta < -0.6 ? 'down' : 'flat', basis: 'last_match' } };
  });

  const coverage = computeCoverage(base);
  const confidence = confidenceLabelFromMatches(coverage.matchesTotal);
  const dominantTrait = archetypeFromGenes(genesWithTrend);
  const extremes = strongestWeakestGenes(genesWithTrend, 2);

  const coreScore = base.coreScore != null ? asNumberOrNull(base.coreScore) : null;
  const dnaTierFromCore = coreScore != null ? dnaEngine.computeDnaTier(coreScore) : null;

  return {
    playerId,
    seasonId,
    coreScore,
    genes: genesWithTrend,
    matches: Array.isArray(base.matches) ? base.matches : [],
    matchHistory,
    seasonSlice: base.seasonSlice || { seasonId },
    confidence,
    coverage,
    dominantTrait,
    strongestGenes: extremes.strongest,
    weakestGenes: extremes.weakest,
    reasons: base.reasons || { perGene: {} },
    lastUpdated: base.lastUpdated || null,
    lastUpdatedV3: base.lastUpdatedV3 || null,
    updatedAt: base.lastUpdatedV3 || base.lastUpdated || null,
    dnaTier: base.dnaTier != null ? asNumberOrNull(base.dnaTier) : dnaTierFromCore,
  };
}

async function getCalibrationStatus(playerId, seasonId = DEFAULT_SEASON, options = {}) {
  const prof = await getProfileOrStub(playerId, seasonId, options);
  const coverage = computeCoverage(prof);
  const minRequired = 3;
  const progress = clamp01(coverage.matchesTotal / minRequired);
  return {
    seasonId: String(seasonId || DEFAULT_SEASON),
    playerId: String(playerId || ''),
    matchesTotal: coverage.matchesTotal,
    minRequired,
    progress,
    status: coverage.matchesTotal >= minRequired ? 'ready' : (coverage.matchesTotal > 0 ? 'partial' : 'empty'),
  };
}

async function getLeaderboard(seasonId = DEFAULT_SEASON, options = {}) {
  const useDnaTest = options?.useDnaTest === true;
  const season = String(seasonId || DEFAULT_SEASON);

  if (useDnaTest) {
    let rows;
    try {
      rows = await dbDnaTest('dna_profiles')
        .where({ season_id: season })
        .orderBy('core_score', 'desc')
        .limit(100)
        .select('player_id', 'core_score', 'data');
    } catch (e) {
      if (e?.code === 'SQLITE_ERROR' || e?.message?.includes('no such table')) return [];
      throw e;
    }
    return rows.map((r) => {
      let genesMap = {};
      try {
        const data = r.data ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : null;
        const values = data?.genesV3?.value || genesArrayToMap(data?.genes);
        for (const k of GENE_KEYS) {
          const v = asNumberOrNull(values?.[k]);
          if (v != null) genesMap[k] = v;
        }
      } catch (_e) {}
      return {
        playerId: r.player_id,
        playerName: r.player_id,
        coreScore: asNumberOrNull(r.core_score) ?? 0,
        genes: genesMap,
      };
    });
  }

  const playerIds = await dnaStorage.listPlayerIdsBySeason(season);
  const entries = [];
  for (const playerId of playerIds) {
    const profile = await dnaStorage.getProfile(season, playerId);
    if (!profile) continue;
    const values =
      (profile.genesV3 && profile.genesV3.value) ? profile.genesV3.value : genesArrayToMap(profile.genes);
    const genes = {};
    for (const k of GENE_KEYS) {
      const v = asNumberOrNull(values?.[k]);
      if (v != null) genes[k] = v;
    }
    entries.push({
      playerId: profile.playerId || playerId,
      playerName: profile.playerId || playerId,
      coreScore: asNumberOrNull(profile.coreScore) ?? 0,
      genes,
    });
  }
  entries.sort((a, b) => (b.coreScore || 0) - (a.coreScore || 0));
  return entries.slice(0, 100);
}

async function syncGenesFromDnaTestDb(playerId, seasonId = DEFAULT_SEASON) {
  const season = String(seasonId || DEFAULT_SEASON);
  const id = String(playerId || '').trim();
  if (!id) return null;
  const rows = await dbDnaTest('matches as m')
    .join('participants as p', 'p.match_ref', 'm.id')
    .whereRaw('LOWER(p.player_name) = ? OR LOWER(p.player_id) = ?', [id.toLowerCase(), id.toLowerCase()])
    .groupBy('m.id', 'm.match_id', 'm.played_at', 'm.telemetry')
    .orderBy('m.played_at', 'asc')
    .select('m.match_id as matchId', 'm.played_at as playedAt', 'm.telemetry as telemetry');

  if (!rows || rows.length === 0) {
    const stub = buildStubProfile(id, season);
    await dnaStorage.saveProfile(season, id, stub);
    return stub;
  }

  const matchesMeta = [];
  const vectors = [];
  for (const row of rows) {
    if (!row?.telemetry) continue;
    let telemetry;
    try {
      telemetry = typeof row.telemetry === 'string' ? JSON.parse(row.telemetry) : row.telemetry;
    } catch (_e) {
      continue;
    }
    const vector = featureExtractor.extractFeatures(telemetry, id);
    matchesMeta.push({
      matchId: row.matchId,
      dateISO: row.playedAt || null,
    });
    vectors.push(vector);
  }

  if (vectors.length === 0) {
    const stub = buildStubProfile(id, season);
    await dnaStorage.saveProfile(season, id, stub);
    return stub;
  }

  const profile = dnaEngine.buildProfile(id, season, matchesMeta, vectors);
  profile.matchHistory = Array.isArray(profile.matches) ? profile.matches : [];
  profile.lastUpdated = new Date().toISOString();
  await dnaStorage.saveProfile(season, id, profile);
  return profile;
}

module.exports = {
  DEFAULT_SEASON,
  getDictionary,
  getAvailableSeasons,
  buildProfileFromDnaTestDbV3,
  getProfileOrStub,
  mapProfileToV2,
  getCalibrationStatus,
  getLeaderboard,
  syncGenesFromDnaTestDb,
};
