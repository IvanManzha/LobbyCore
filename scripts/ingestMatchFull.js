#!/usr/bin/env node
/**
 * Full ingest for one match: match meta, telemetry (gzip), index, per-player features/track/events.
 * Usage: node scripts/ingestMatchFull.js <matchId> [shard]
 * Or: npm run ingest:match -- <matchId>
 *    pnpm ingest:match <matchId>
 */
const matchId = process.argv[2];
const shard = process.argv[3] || 'steam';

if (!matchId) {
  console.error('Usage: node scripts/ingestMatchFull.js <matchId> [shard]');
  process.exit(1);
}

async function main() {
  const { ingestMatchFull } = require('../src/backend/services/pubg/telemetryMetricsPipeline');
  const result = await ingestMatchFull(matchId, shard);
  console.log(JSON.stringify(result, null, 2));
  if (result.coverage) {
    console.log('Players:', result.coverage.players);
    console.log('Time:', result.coverage.timeStart, '–', result.coverage.timeEnd);
  }
  if (!result.success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
