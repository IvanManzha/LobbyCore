/**
 * Full ingest pipeline: match meta → telemetry gzip → index → per-player features, track, events.
 */
const fs = require('fs').promises;
const path = require('path');
const pubgClient = require('./pubgClient');
const { normalizeMatch } = require('./matchNormalizer');
const { fetchAndSaveTelemetryGzip, readTelemetryFromGzip } = require('./telemetryFetcher');
const { buildTelemetryIndex } = require('./telemetryIndexBuilder');
const { extractAllPlayerFeatures, EXTRACTOR_VERSION } = require('./playerFeaturesExtractor');
const { extractTracks } = require('./trackExtractor');
const { extractMapEvents } = require('./mapEventsExtractor');
const {
  getPubgMatchDir,
  getPubgMatchMetaPath,
  getPubgTelemetryIndexPath,
  getPubgPlayerFeaturesPath,
  getPubgPlayerTrackPath,
  getPubgPlayerEventsPath,
} = require('../../config/dataPaths');

/**
 * Run full ingest for matchId. Idempotent: skips steps when files exist and version matches.
 * @param {string} matchId
 * @param {string} [shard]
 * @returns {Promise<{ matchId: string, cached: boolean, success: boolean, coverage?: object, error?: string }>}
 */
async function ingestMatchFull(matchId, shard = 'steam') {
  try {
    const result = { matchId, cached: false, success: true };

    const { match, telemetryUrl } = await pubgClient.getMatch(matchId, shard);
    const meta = normalizeMatch(matchId, match);

    const matchDir = getPubgMatchDir(matchId);
    await fs.mkdir(matchDir, { recursive: true });
    await fs.writeFile(getPubgMatchMetaPath(matchId), JSON.stringify(meta, null, 2), 'utf8');

    if (!telemetryUrl) {
      result.success = false;
      result.error = 'No telemetry URL in match';
      return result;
    }

    const telemetrySaved = await fetchAndSaveTelemetryGzip(matchId, telemetryUrl);
    result.cached = telemetrySaved.cached;

    const telemetry = await readTelemetryFromGzip(matchId);
    const index = buildTelemetryIndex(telemetry, { extractorVersion: EXTRACTOR_VERSION });
    await fs.writeFile(getPubgTelemetryIndexPath(matchId), JSON.stringify(index, null, 2), 'utf8');

    const playersDir = path.join(matchDir, 'players');
    await fs.mkdir(playersDir, { recursive: true });

    const accountIds = meta.participants.map((p) => p.accountId).filter(Boolean);
    const startedAt = meta.startedAt || '';
    const durationSec = meta.durationSec || 0;

    const featuresMap = extractAllPlayerFeatures(telemetry, meta.participants, matchId, startedAt, durationSec);
    const tracksMap = extractTracks(telemetry, accountIds);
    const eventsMap = extractMapEvents(telemetry, accountIds, matchId);

    for (const accountId of accountIds) {
      const featuresPath = getPubgPlayerFeaturesPath(matchId, accountId);
      let skipFeatures = false;
      try {
        const existing = JSON.parse(await fs.readFile(featuresPath, 'utf8'));
        if (existing.extractorVersion === EXTRACTOR_VERSION) skipFeatures = true;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      if (!skipFeatures) {
        const features = featuresMap.get(accountId);
        if (features) {
          await fs.writeFile(featuresPath, JSON.stringify(features, null, 2), 'utf8');
        }
      }

      const track = tracksMap.get(accountId);
      if (track) {
        track.matchId = matchId;
        await fs.writeFile(getPubgPlayerTrackPath(matchId, accountId), JSON.stringify(track, null, 2), 'utf8');
      }

      const eventsFile = eventsMap.get(accountId);
      if (eventsFile) {
        await fs.writeFile(getPubgPlayerEventsPath(matchId, accountId), JSON.stringify(eventsFile, null, 2), 'utf8');
      }
    }

    result.coverage = {
      players: accountIds.length,
      timeStart: index.timeStart,
      timeEnd: index.timeEnd,
      eventCountsByType: index.eventCountsByType,
    };
    return result;
  } catch (err) {
    return {
      matchId,
      cached: false,
      success: false,
      error: err.message || String(err),
    };
  }
}

module.exports = {
  ingestMatchFull,
  EXTRACTOR_VERSION,
};
