/**
 * DNA pipeline: ingest matchIds → extract features for each player → recompute DNA profiles.
 * When DNA_USE_V3=true, also runs v3 gene update (skill/form, baseline calibration) per match per player.
 */
const { ingestMatch } = require('./ingestMatch');
const featureExtractor = require('./featureExtractor');
const dnaEngine = require('./dnaEngine');
const DnaService = require('./DnaService');
const poolStats = require('./poolStats');
const dnaStorage = require('./dnaStorage');
const v3Update = require('./v3/updatePlayerDNA');
const { persistDnaRating } = require('./dnaRatingPersistence');

const DNA_USE_V3 = process.env.DNA_USE_V3 === 'true' || process.env.DNA_USE_V3 === '1';
const GENE_KEYS = dnaEngine.GENE_KEYS;

/**
 * Run full pipeline: for each matchId ingest telemetry; for each (matchId, playerId) extract features;
 * for each playerId recompute DNA profile with given matchIds.
 * @param {string[]} matchIds
 * @param {string[]} playerIds
 * @param {string} [seasonId] Year slice, e.g. "2025", "2026" (default from DnaService).
 * @param {Object} [opts] { retryFailed: boolean, onProgress?: (progress) => void }
 * @returns {Promise<{ ingested: number, failed: string[], extracted: number, recomputed: number }>}
 */
async function runPipeline(matchIds, playerIds, seasonId = DnaService.DEFAULT_SEASON, opts = {}) {
  const { onProgress } = opts;
  const failed = [];
  let ingested = 0;

  onProgress?.({ phase: 'ingest', current: 0, total: matchIds.length });

  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
    const result = await ingestMatch(matchId);
    if (result.error) {
      failed.push(matchId);
      onProgress?.({ phase: 'ingest', current: i + 1, total: matchIds.length, failed: [...failed] });
      continue;
    }
    if (!result.cached) ingested += 1;
    onProgress?.({ phase: 'ingest', current: i + 1, total: matchIds.length, ingested });
  }

  const extractTotal = matchIds.length * playerIds.length;
  let extracted = 0;

  onProgress?.({ phase: 'extract', current: 0, total: extractTotal });

  for (const matchId of matchIds) {
    for (const playerId of playerIds) {
      try {
        await featureExtractor.extractAndSaveFeatures(matchId, playerId);
        extracted += 1;
      } catch (e) {
        // Skip if telemetry missing or no player in match
      }
      onProgress?.({ phase: 'extract', current: extracted, total: extractTotal });
    }
  }

  let recomputed = 0;

  onProgress?.({ phase: 'recompute', current: 0, total: playerIds.length });

  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    try {
      await dnaEngine.recompute(playerId, seasonId, matchIds);
      recomputed += 1;
    } catch (e) {
      // Skip if no features
    }
    onProgress?.({ phase: 'recompute', current: i + 1, total: playerIds.length, recomputed });
  }

  let recomputedV3 = 0;
  if (DNA_USE_V3 && matchIds.length > 0) {
    onProgress?.({ phase: 'recompute_v3', current: 0, total: playerIds.length });
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      try {
        let baseline = await v3Update.loadBaseline(seasonId);
        const profile = await dnaStorage.getProfile(seasonId, playerId) || {};
        let player = profile.genesV3 || v3Update.createInitialPlayerState(seasonId);
        const matchGeneValues = [];
        const processedMatchIds = [];
        for (const matchId of matchIds) {
          let telemetry = null;
          try {
            telemetry = await featureExtractor.loadTelemetryForDna(matchId);
          } catch (_e) {}
          if (!telemetry) continue;
          const result = await v3Update.updatePlayerDNAForMatch({
            player,
            baseline,
            telemetry,
            playerId,
            seasonId,
            loadSave: false,
          });
          player = result.player;
          baseline = result.baseline;
          const snapshot = {};
          for (const key of GENE_KEYS) {
            const v = player.value && player.value[key];
            const num = v != null && Number.isFinite(v) ? v : 50;
            snapshot[key] = Math.round(Math.max(0, Math.min(100, num)) * 10) / 10;
          }
          matchGeneValues.push(snapshot);
          processedMatchIds.push(matchId);
        }
        profile.genesV3 = player;
        profile.lastUpdatedV3 = new Date().toISOString();
        const existingMatches = profile.matches || [];
        const byMatchId = new Map(existingMatches.map((m) => [m.matchId || m.id, { ...m }]));
        processedMatchIds.forEach((matchId, idx) => {
          const gv = matchGeneValues[idx] || {};
          const existing = byMatchId.get(matchId) || {};
          byMatchId.set(matchId, {
            id: existing.id || matchId,
            matchId,
            label: existing.label || `Match ${idx + 1}`,
            order: existing.order ?? idx,
            dateISO: existing.dateISO,
            dateShort: existing.dateShort,
            summary: existing.summary || {},
            geneValues: gv,
          });
        });
        profile.matches = Array.from(byMatchId.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        profile.playerId = profile.playerId || playerId;
        profile.seasonId = profile.seasonId || seasonId;
        await dnaStorage.saveProfile(seasonId, playerId, profile);
        await v3Update.saveBaseline(baseline, seasonId);
        recomputedV3 += 1;
      } catch (e) {
        // Skip on error
      }
      onProgress?.({ phase: 'recompute_v3', current: i + 1, total: playerIds.length, recomputedV3 });
    }
    if (recomputedV3 > 0) {
      try {
        await poolStats.computePoolStats(seasonId);
      } catch (_e) {
        // non-fatal
      }
    }
  }

  if (recomputed > 0 || (DNA_USE_V3 && recomputedV3 > 0)) {
    for (const playerId of playerIds) {
      try {
        await persistDnaRating(playerId, seasonId, { date: new Date() });
      } catch (_e) {
        // non-fatal
      }
    }
  }

  return {
    ingested,
    failed,
    extracted,
    recomputed,
    recomputedV3: DNA_USE_V3 ? recomputedV3 : undefined,
  };
}

module.exports = {
  runPipeline,
};
