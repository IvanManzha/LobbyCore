/**
 * PUBG API client for DNA ingestion.
 * Uses root services/pubgApi for getMatch; extracts telemetry URL.
 */
const path = require('path');
const rootPubgApi = path.resolve(__dirname, '../../../../services/pubgApi.js');
let getMatchFn;

try {
  const pubgApi = require(rootPubgApi);
  getMatchFn = pubgApi.getMatch;
} catch (e) {
  getMatchFn = null;
}

const DEFAULT_SHARD = 'steam';

/**
 * Get match by id from PUBG API.
 * @param {string} matchId
 * @param {string} [shard]
 * @returns {Promise<{ matchId: string, telemetryUrl: string | null, match: Object }>}
 */
async function getMatch(matchId, shard = DEFAULT_SHARD) {
  if (!getMatchFn) {
    throw new Error('PUBG API not available: services/pubgApi.js not found or PUBG_API_KEY not set');
  }
  const data = await getMatchFn(shard, matchId);
  const asset = (data.included || []).find((i) => i.type === 'asset');
  const telemetryUrl = asset?.attributes?.URL || null;
  return {
    matchId,
    telemetryUrl,
    match: data,
  };
}

module.exports = {
  getMatch,
  DEFAULT_SHARD,
};
