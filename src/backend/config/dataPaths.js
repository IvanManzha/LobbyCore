const path = require('path');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../../data');

const devDataEnabled = process.env.DEV_DATA === 'true' || process.env.ADMIN_STUDIO === 'true';

// When DEV_DATA=true and no explicit env override, main app uses dev files (tournaments.dev.json, feed.dev.json)
const tournamentsPath = process.env.TOURNAMENTS_PATH
  ? path.resolve(process.env.TOURNAMENTS_PATH)
  : (devDataEnabled ? path.join(dataDir, 'tournaments.dev.json') : path.join(dataDir, 'tournaments.json'));

const tournamentsDir = process.env.TOURNAMENTS_DIR
  ? path.resolve(process.env.TOURNAMENTS_DIR)
  : (devDataEnabled ? path.join(dataDir, 'tournaments.dev') : path.join(dataDir, 'tournaments'));

const playersDir = process.env.PLAYERS_DIR
  ? path.resolve(process.env.PLAYERS_DIR)
  : path.join(dataDir, 'players');

const snapshotsDir = process.env.SNAPSHOTS_DIR || process.env.RATING_SNAPSHOTS_DIR
  ? path.resolve(process.env.SNAPSHOTS_DIR || process.env.RATING_SNAPSHOTS_DIR)
  : path.join(dataDir, 'ratingSnapshots');

const feedPath = process.env.FEED_PATH
  ? path.resolve(process.env.FEED_PATH)
  : (devDataEnabled ? path.join(dataDir, 'feed.dev.json') : path.join(dataDir, 'feed.json'));

const playerStatsPath = process.env.PLAYER_STATS_PATH
  ? path.resolve(process.env.PLAYER_STATS_PATH)
  : path.join(dataDir, 'player_stats.json');

// Finance (DropCoins) — ledger-first
const walletsPath = process.env.FINANCE_WALLETS_PATH
  ? path.resolve(process.env.FINANCE_WALLETS_PATH)
  : path.join(dataDir, 'wallets.json');
const ledgerPath = process.env.FINANCE_LEDGER_PATH
  ? path.resolve(process.env.FINANCE_LEDGER_PATH)
  : path.join(dataDir, 'ledger.json');
const topupsPath = process.env.FINANCE_TOPUPS_PATH
  ? path.resolve(process.env.FINANCE_TOPUPS_PATH)
  : path.join(dataDir, 'topups.json');
const cashoutsPath = process.env.FINANCE_CASHOUTS_PATH
  ? path.resolve(process.env.FINANCE_CASHOUTS_PATH)
  : path.join(dataDir, 'cashouts.json');
const finalFundsPath = process.env.FINANCE_FINAL_FUNDS_PATH
  ? path.resolve(process.env.FINANCE_FINAL_FUNDS_PATH)
  : path.join(dataDir, 'final_funds.json');
const payoutBatchesPath = process.env.FINANCE_PAYOUT_BATCHES_PATH
  ? path.resolve(process.env.FINANCE_PAYOUT_BATCHES_PATH)
  : path.join(dataDir, 'payout_batches.json');

const steamLinkRequestsPath = process.env.STEAM_LINK_REQUESTS_PATH
  ? path.resolve(process.env.STEAM_LINK_REQUESTS_PATH)
  : path.join(dataDir, 'steam_link_requests.json');

/**
 * DNA storage directory. Profiles, baseline, pool_stats are now stored in DB (dna_profiles, dna_baselines, dna_pool_stats).
 * This path is still used for the gene dictionary (dictionary.json) and optional legacy paths.
 */
const dnaStorageDir = process.env.DNA_STORAGE_DIR
  ? path.resolve(process.env.DNA_STORAGE_DIR)
  : path.join(dataDir, 'dna');

/** @deprecated DNA profiles are in DB; use dnaStorage.getProfile/saveProfile */
function getDnaProfilePath(seasonId, playerId) {
  return path.join(dnaStorageDir, String(seasonId), `${String(playerId)}.json`);
}

function getDnaStorageDir() {
  return dnaStorageDir;
}

/** @deprecated DNA baseline is in DB; use dnaStorage.loadBaseline/saveBaseline */
function getDnaBaselinePath(seasonId) {
  return path.join(dnaStorageDir, String(seasonId), 'baseline_v1.json');
}

/** @deprecated DNA pool stats are in DB; use dnaStorage.loadPoolStats/savePoolStats */
function getDnaPoolStatsPath(seasonId) {
  return path.join(dnaStorageDir, String(seasonId), 'pool_stats_v1.json');
}

/** PUBG telemetry cache: data/pubg/telemetry/<matchId>.json */
const pubgTelemetryDir = process.env.PUBG_TELEMETRY_DIR
  ? path.resolve(process.env.PUBG_TELEMETRY_DIR)
  : path.join(dataDir, 'pubg', 'telemetry');

function getPubgTelemetryPath(matchId) {
  return path.join(pubgTelemetryDir, `${String(matchId)}.json`);
}

function getPubgTelemetryDir() {
  return pubgTelemetryDir;
}

/** PUBG feature store: data/pubg/matches/<matchId>/ */
const pubgMatchesDir = process.env.PUBG_MATCHES_DIR
  ? path.resolve(process.env.PUBG_MATCHES_DIR)
  : path.join(dataDir, 'pubg', 'matches');

function getPubgMatchDir(matchId) {
  return path.join(pubgMatchesDir, String(matchId));
}

function getPubgMatchMetaPath(matchId) {
  return path.join(pubgMatchesDir, String(matchId), 'match.json');
}

function getPubgTelemetryGzipPath(matchId) {
  return path.join(pubgMatchesDir, String(matchId), 'telemetry.json.gz');
}

function getPubgTelemetryIndexPath(matchId) {
  return path.join(pubgMatchesDir, String(matchId), 'telemetry.index.json');
}

function getPubgPlayerFeaturesPath(matchId, accountId) {
  return path.join(pubgMatchesDir, String(matchId), 'players', `${String(accountId).replace(/[^a-zA-Z0-9_.-]/g, '_')}.features.json`);
}

function getPubgPlayerTrackPath(matchId, accountId) {
  return path.join(pubgMatchesDir, String(matchId), 'players', `${String(accountId).replace(/[^a-zA-Z0-9_.-]/g, '_')}.track.json`);
}

function getPubgPlayerEventsPath(matchId, accountId) {
  return path.join(pubgMatchesDir, String(matchId), 'players', `${String(accountId).replace(/[^a-zA-Z0-9_.-]/g, '_')}.events.json`);
}

function getPubgTeamFeaturesPath(matchId, teamId) {
  return path.join(pubgMatchesDir, String(matchId), 'teams', `${String(teamId).replace(/[^a-zA-Z0-9_.-]/g, '_')}.features.json`);
}

/** Feature vectors: data/features/<matchId>/<playerId>.json */
const featuresDir = process.env.FEATURES_DIR
  ? path.resolve(process.env.FEATURES_DIR)
  : path.join(dataDir, 'features');

function getFeaturesPath(matchId, playerId) {
  return path.join(featuresDir, String(matchId), `${String(playerId).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

function getFeaturesDir() {
  return featuresDir;
}

function getAdminTournamentsPath() {
  return devDataEnabled ? path.join(dataDir, 'tournaments.dev.json') : null;
}

function getAdminTournamentsDir() {
  return devDataEnabled ? path.join(dataDir, 'tournaments.dev') : null;
}

function getAdminFeedPath() {
  return devDataEnabled ? path.join(dataDir, 'feed.dev.json') : null;
}

function getAdminLogsPath() {
  return devDataEnabled ? path.join(dataDir, 'admin-logs.json') : null;
}

function isDevDataMode() {
  return devDataEnabled;
}

module.exports = {
  dataDir,
  tournamentsPath,
  tournamentsDir,
  playersDir,
  snapshotsDir,
  feedPath,
  playerStatsPath,
  walletsPath,
  ledgerPath,
  topupsPath,
  cashoutsPath,
  finalFundsPath,
  payoutBatchesPath,
  steamLinkRequestsPath,
  dnaStorageDir,
  getDnaProfilePath,
  getDnaStorageDir,
  getDnaBaselinePath,
  getDnaPoolStatsPath,
  pubgTelemetryDir,
  getPubgTelemetryPath,
  getPubgTelemetryDir,
  pubgMatchesDir,
  getPubgMatchDir,
  getPubgMatchMetaPath,
  getPubgTelemetryGzipPath,
  getPubgTelemetryIndexPath,
  getPubgPlayerFeaturesPath,
  getPubgPlayerTrackPath,
  getPubgPlayerEventsPath,
  getPubgTeamFeaturesPath,
  featuresDir,
  getFeaturesPath,
  getFeaturesDir,
  devDataEnabled,
  getAdminTournamentsPath,
  getAdminTournamentsDir,
  getAdminFeedPath,
  getAdminLogsPath,
  isDevDataMode
};
