/**
 * Ingest one match: get match from PUBG -> get telemetry URL -> download and save telemetry.
 * Used by Sprint 3 (ingestion) and later by pipeline.
 */
const pubgClient = require('../pubg/pubgClient');
const telemetryFetcher = require('../pubg/telemetryFetcher');

/**
 * Ingest match by matchId: fetch match, then telemetry, save to storage.
 * If telemetry already cached (gzip or JSON), skip download.
 * New ingests write to matches/<id>/telemetry.json.gz (feature store).
 * @param {string} matchId
 * @param {string} [shard]
 * @returns {Promise<{ matchId: string, cached: boolean, error?: string }>}
 */
async function ingestMatch(matchId, shard = pubgClient.DEFAULT_SHARD) {
  try {
    const gzipCached = await telemetryFetcher.hasCachedTelemetryGzip(matchId);
    const jsonCached = await telemetryFetcher.hasCachedTelemetry(matchId);
    if (gzipCached || jsonCached) {
      return { matchId, cached: true };
    }

    const { telemetryUrl } = await pubgClient.getMatch(matchId, shard);
    if (!telemetryUrl) {
      return { matchId, cached: false, error: 'No telemetry URL in match response' };
    }

    const result = await telemetryFetcher.fetchAndSaveTelemetryGzip(matchId, telemetryUrl);
    return {
      matchId,
      cached: result.cached,
    };
  } catch (e) {
    return {
      matchId,
      cached: false,
      error: e.message || String(e),
    };
  }
}

module.exports = {
  ingestMatch,
};
