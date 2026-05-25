/**
 * PUBG feature store API: ingest, list matches, player features.
 */
const fs = require('fs').promises;
const path = require('path');
const { ingestMatchFull } = require('../services/pubg/telemetryMetricsPipeline');
const {
  pubgMatchesDir,
  getPubgMatchMetaPath,
  getPubgTelemetryIndexPath,
  getPubgPlayerFeaturesPath,
} = require('../config/dataPaths');

/**
 * POST /api/v1/pubg/ingest
 * Body: { matchId [, shard ] }
 */
async function postIngest(req, res, next) {
  try {
    const matchId = req.body?.matchId ?? req.query?.matchId;
    const shard = req.body?.shard ?? req.query?.shard ?? 'steam';
    if (!matchId) {
      return res.status(400).json({ error: 'matchId required' });
    }
    const result = await ingestMatchFull(matchId, shard);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/pubg/matches
 * List ingested matches (scan data/pubg/matches for match.json or telemetry.index.json).
 */
async function getMatches(req, res, next) {
  try {
    let entries;
    try {
      entries = await fs.readdir(pubgMatchesDir, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.json([]);
      }
      throw e;
    }
    const dirs = entries.filter((d) => d.isDirectory()).map((d) => d.name);
    const list = [];
    for (const matchId of dirs) {
      const metaPath = getPubgMatchMetaPath(matchId);
      const indexPath = getPubgTelemetryIndexPath(matchId);
      let meta = null;
      try {
        const raw = await fs.readFile(metaPath, 'utf8');
        meta = JSON.parse(raw);
      } catch (_e) {
        try {
          await fs.access(indexPath);
          meta = { matchId, mapName: null, startedAt: null };
        } catch (_e2) {
          continue;
        }
      }
      list.push({
        matchId: meta.matchId || matchId,
        mapName: meta.mapName,
        startedAt: meta.startedAt,
      });
    }
    list.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
    res.json(list);
  } catch (e) {
    next(e);
  }
}

/**
 * Resolve playerId (nickname) to accountId using match.json participants.
 * @param {Object} meta - match.json content
 * @param {string} playerIdOrAccountId
 * @returns {string|null} accountId
 */
function resolveAccountId(meta, playerIdOrAccountId) {
  if (!meta || !playerIdOrAccountId) return null;
  const participants = meta.participants || [];
  const key = String(playerIdOrAccountId).trim().toLowerCase();
  for (const p of participants) {
    const aid = p.accountId ? String(p.accountId) : null;
    const name = (p.name || '').toString().trim().toLowerCase();
    if (aid && (aid.toLowerCase() === key || name === key || name.includes(key) || key.includes(name))) {
      return aid;
    }
  }
  return null;
}

/**
 * GET /api/v1/pubg/match/:matchId/player/:accountId/features
 * Query: playerId (nickname) — resolve to accountId from match.json.
 */
async function getPlayerFeatures(req, res, next) {
  try {
    const { matchId, accountId: paramAccountId } = req.params;
    const playerId = req.query?.playerId;

    let meta = null;
    try {
      const raw = await fs.readFile(getPubgMatchMetaPath(matchId), 'utf8');
      meta = JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') return res.status(404).json({ error: 'Match not found' });
      throw e;
    }

    const accountId = playerId ? resolveAccountId(meta, playerId) : paramAccountId;
    if (!accountId) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const featuresPath = getPubgPlayerFeaturesPath(matchId, accountId);
    try {
      const raw = await fs.readFile(featuresPath, 'utf8');
      const features = JSON.parse(raw);
      return res.json(features);
    } catch (e) {
      if (e.code === 'ENOENT') return res.status(404).json({ error: 'Features not found' });
      throw e;
    }
  } catch (e) {
    next(e);
  }
}

module.exports = {
  postIngest,
  getMatches,
  getPlayerFeatures,
  resolveAccountId,
};
