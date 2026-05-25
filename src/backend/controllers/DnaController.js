const fs = require('fs').promises;
const archiver = require('archiver');
const DnaService = require('../services/dna/DnaService');
const poolStats = require('../services/dna/poolStats');
const { ingestMatch: ingestMatchFn } = require('../services/dna/ingestMatch');
const featureExtractor = require('../services/dna/featureExtractor');
const dnaEngine = require('../services/dna/dnaEngine');
const { runPipeline } = require('../services/dna/pipeline');
const { createJob, getJob, updateJob } = require('../services/dna/pipelineJobs');
const { extractMapData } = require('../services/dna/mapDataFromTelemetry');
const { extractZoneSnapshots } = require('../services/dna/zoneFromTelemetry');
const { extractTracks } = require('../services/pubg/trackExtractor');
const { extractMapEvents } = require('../services/pubg/mapEventsExtractor');
const { parseEvents: parseTelemetryEvents, getAccountId, isSameCharacter } = require('../services/pubg/telemetryHelpers');
const { db, dbDnaTest } = require('../../../lib/db');
const { resolveAccountId: resolvePubgAccountId } = require('./PubgController');
const { getPubgMatchMetaPath, getPubgPlayerTrackPath, getPubgPlayerEventsPath } = require('../config/dataPaths');

const MAP_NAME_TO_IMAGE = {
  Baltic_Main: '/maps/erangel.png',
  Chimera_Main: '/maps/paramo.png',
  Desert_Main: '/maps/miramar.png',
  DihorOtok_Main: '/maps/vikendi.png',
  Erangel_Main: '/maps/erangel.png',
  Heaven_Main: '/maps/haven.png',
  Kiki_Main: '/maps/deston.png',
  Neon_Main: '/maps/rondo.png',
  Savage_Main: '/maps/sanhok.png',
  Summerland_Main: '/maps/karakin.png',
  Tiger_Main: '/maps/taego.png',
};

const MAP_NAME_TO_WORLD_SIZE = {
  Baltic_Main: 816000,
  Chimera_Main: 306000,
  Desert_Main: 816000,
  DihorOtok_Main: 816000,
  Erangel_Main: 816000,
  Heaven_Main: 102000,
  Kiki_Main: 816000,
  Neon_Main: 816000,
  Savage_Main: 408000,
  Summerland_Main: 204000,
  Tiger_Main: 816000,
};

function getMapImageUrl(mapName) {
  if (!mapName || typeof mapName !== 'string') return '';
  return MAP_NAME_TO_IMAGE[mapName.trim()] || '';
}

function getMapWorldSize(mapName) {
  if (!mapName || typeof mapName !== 'string') return 306000;
  return MAP_NAME_TO_WORLD_SIZE[mapName.trim()] ?? 306000;
}

/**
 * Resolve primary/secondary (name or accountId) to accountId by scanning telemetry characters.
 * @param {Object} telemetry - Parsed telemetry (events array)
 * @param {string} primary - Primary player name or accountId
 * @param {string} [secondary] - Optional secondary player name or accountId
 * @returns {{ primaryAccountId: string|null, secondaryAccountId: string|null }}
 */
function resolveAccountIdsFromTelemetry(telemetry, primary, secondary) {
  const events = parseTelemetryEvents(telemetry);
  const idByKey = new Map(); // normalized key (lowercase name or id) -> accountId
  const collect = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const id = getAccountId(obj);
    const name = (obj.name ?? obj.Name ?? '').toString().trim();
    if (id) {
      idByKey.set(String(id).toLowerCase(), id);
      if (name) idByKey.set(name.toLowerCase(), id);
    }
  };
  for (const evt of events) {
    collect(evt.character ?? evt.Character);
    collect(evt.victim ?? evt.Victim);
    collect(evt.killer ?? evt.Killer);
    collect(evt.attacker ?? evt.Attacker);
    collect(evt.reviver ?? evt.Reviver);
  }
  const key = (s) => (s || '').toString().trim().toLowerCase();
  return {
    primaryAccountId: idByKey.get(key(primary)) || primary || null,
    secondaryAccountId: secondary ? (idByKey.get(key(secondary)) || secondary) : null,
  };
}

/**
 * Id/name pass: accountId -> display name from DB participants rows (PUBG API: player_id + player_name).
 * @param {Array<{ player_id?: string, player_name?: string, api_name?: string }>} rows
 * @returns {Record<string, string>}
 */
function buildIdNameMapFromParticipantRows(rows) {
  const out = {};
  for (const row of rows || []) {
    const id = row.player_id != null ? String(row.player_id).trim() : '';
    if (!id) continue;
    const name = (row.player_name || row.api_name || '').toString().trim();
    if (name) out[id] = name;
  }
  return out;
}

/**
 * Build id/team map from participants rows.
 * @param {Array<{ player_id?: string, team_id?: string|number }>} rows
 * @returns {Record<string, string>}
 */
function buildIdTeamMapFromParticipantRows(rows) {
  const out = {};
  for (const row of rows || []) {
    const id = row.player_id != null ? String(row.player_id).trim() : '';
    if (!id) continue;
    if (row.team_id != null && String(row.team_id).trim() !== '') {
      out[id] = String(row.team_id).trim();
    }
  }
  return out;
}

/**
 * Fill missing idNameMap entries from telemetry character objects (DB names win if present).
 * @param {Object} telemetry
 * @param {Record<string, string>} idNameMap - mutated in place
 */
function mergeTelemetryCharacterNamesIntoIdNameMap(telemetry, idNameMap) {
  if (!telemetry || !idNameMap) return;
  const events = parseTelemetryEvents(telemetry);
  const collect = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const id = getAccountId(obj);
    const name = (obj.name ?? obj.Name ?? '').toString().trim();
    if (id && name && !idNameMap[id]) idNameMap[id] = name;
  };
  for (const evt of events) {
    collect(evt.character ?? evt.Character);
    collect(evt.victim ?? evt.Victim);
    collect(evt.killer ?? evt.Killer);
    collect(evt.attacker ?? evt.Attacker);
    collect(evt.reviver ?? evt.Reviver);
    collect(evt.assistant ?? evt.Assistant);
  }
}

/**
 * GET /api/v1/dna/:playerId?seasonId=...&useDnaTest=true
 * Returns DNAProfile v2 (coverage, confidence string, matchHistory, genes with trend). When useDnaTest=true, builds profile from bd_dna_test.
 */
async function getProfile(req, res, next) {
  try {
    const { playerId } = req.params;
    const seasonId = req.query.seasonId || DnaService.DEFAULT_SEASON;
    const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';
    const normalizedId = String(playerId || '').trim().toLowerCase();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f20934ed-d84f-4eb9-803c-4dd6dccc9729',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DnaController.js:getProfile',message:'getProfile params',data:{playerId,seasonId,normalizedId,useDnaTest},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const options = { useDnaTest };
    const [profile, calibrationStatus, poolStatsData] = await Promise.all([
      DnaService.getProfileOrStub(playerId, seasonId, options),
      DnaService.getCalibrationStatus(playerId, seasonId, options),
      poolStats.loadPoolStats(seasonId),
    ]);
    const profileV2 = await DnaService.mapProfileToV2(profile, poolStatsData);
    profileV2.calibration = calibrationStatus;
    // #region agent log
    const matchCount = (profile && (profile.matchHistory || profile.matches)) ? (profile.matchHistory || profile.matches).length : 0;
    fetch('http://127.0.0.1:7242/ingest/f20934ed-d84f-4eb9-803c-4dd6dccc9729',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DnaController.js:getProfile',message:'profile result',data:{hasProfile:!!profile,matchCount,genesCount:(profileV2.genes||[]).length},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    res.json(profileV2);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/seasons
 * Returns list of available year/season slices (e.g. ["2025", "2026"]) for DNA Lab selector.
 */
async function getSeasons(req, res, next) {
  try {
    const seasons = await DnaService.getAvailableSeasons();
    res.json({ seasons });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/dictionary
 * Returns gene dictionary (description, howComputed, howToImprove, lowDataHint).
 */
async function getDictionary(req, res, next) {
  try {
    const list = await DnaService.getDictionary();
    res.json(list);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/leaderboard?seasonId=...&useDnaTest=true
 * Returns LeaderboardEntry[]. When useDnaTest=true, returns mock leaderboard for layout testing.
 */
async function getLeaderboard(req, res, next) {
  try {
    const seasonId = req.query.seasonId || DnaService.DEFAULT_SEASON;
    const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';
    const entries = await DnaService.getLeaderboard(seasonId, { useDnaTest });
    res.json(entries);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/v1/dna/ingest-match
 * Body: { matchId: string, shard?: string }
 * Fetches match from PUBG, downloads telemetry, saves to cache.
 */
async function ingestMatch(req, res, next) {
  try {
    const { matchId, shard } = req.body || {};
    if (!matchId) {
      return res.status(400).json({ error: 'matchId required' });
    }
    const result = await ingestMatchFn(matchId, shard);
    if (result.error) {
      return res.status(422).json({ matchId: result.matchId, cached: result.cached, error: result.error });
    }
    res.json({ matchId: result.matchId, cached: result.cached });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/v1/dna/extract-features
 * Body: { matchId: string, playerId: string }
 * Extracts feature vector from cached telemetry and saves to storage/features/<matchId>/<playerId>.json
 */
async function extractFeatures(req, res, next) {
  try {
    const { matchId, playerId } = req.body || {};
    if (!matchId || !playerId) {
      return res.status(400).json({ error: 'matchId and playerId required' });
    }
    const vector = await featureExtractor.extractAndSaveFeatures(matchId, playerId);
    res.json({ matchId, playerId, vector });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/v1/dna/recompute
 * Body: { playerId: string, seasonId?: string, matchIds: string[] }
 * Loads feature vectors for each matchId+playerId, computes genes, writes DNA profile.
 */
async function recompute(req, res, next) {
  try {
    const { playerId, seasonId = DnaService.DEFAULT_SEASON, matchIds } = req.body || {};
    if (!playerId || !Array.isArray(matchIds)) {
      return res.status(400).json({ error: 'playerId and matchIds (array) required' });
    }
    const profile = await dnaEngine.recompute(playerId, seasonId, matchIds);
    res.json(profile);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/v1/dna/pipeline
 * Body: { matchIds: string[], playerIds: string[], seasonId?: string }
 * Returns { jobId } immediately; runs pipeline in background. Poll GET /dna/pipeline/:jobId for status.
 */
async function pipeline(req, res, next) {
  try {
    const { matchIds, playerIds, seasonId = DnaService.DEFAULT_SEASON } = req.body || {};
    if (!Array.isArray(matchIds) || !Array.isArray(playerIds)) {
      return res.status(400).json({ error: 'matchIds and playerIds (arrays) required' });
    }
    const jobId = createJob();
    updateJob(jobId, { status: 'running' });
    res.json({ jobId });

    runPipeline(matchIds, playerIds, seasonId, {
      onProgress: (progress) => {
        updateJob(jobId, { status: 'running', progress });
      },
    })
      .then((result) => {
        updateJob(jobId, { status: 'done', progress: null, result });
      })
      .catch((err) => {
        updateJob(jobId, {
          status: 'failed',
          progress: null,
          error: err?.message || String(err),
        });
      });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/v1/dna/pipeline/retry
 * Body: { matchIds?: string[], jobId?: string }
 * Retries ingest for failed matchIds (from jobId result or provided matchIds).
 */
async function pipelineRetry(req, res, next) {
  try {
    const { matchIds: providedMatchIds, jobId: retryJobId } = req.body || {};
    let matchIdsToRetry = Array.isArray(providedMatchIds) ? providedMatchIds : [];

    if (matchIdsToRetry.length === 0 && retryJobId) {
      const job = getJob(retryJobId);
      if (job?.result?.failed?.length) {
        matchIdsToRetry = job.result.failed;
      }
    }

    if (matchIdsToRetry.length === 0) {
      return res.status(400).json({ error: 'No matchIds to retry. Provide matchIds[] or jobId with failed matches.' });
    }

    const failed = [];
    let ingested = 0;

    for (const matchId of matchIdsToRetry) {
      const result = await ingestMatchFn(matchId);
      if (result.error) {
        failed.push(matchId);
      } else if (!result.cached) {
        ingested += 1;
      }
    }

    res.json({ ingested, failed, retried: matchIdsToRetry.length });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/v1/dna/sync-genes
 * Body: { playerId: string }, Query: seasonId (optional)
 * Recomputes genes from test DB (bd_dna_test), saves to main DB, returns profile v2.
 */
async function syncGenes(req, res, next) {
  try {
    const playerId = req.body?.playerId || req.params?.playerId;
    const seasonId = req.query?.seasonId || req.body?.seasonId || DnaService.DEFAULT_SEASON;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId required' });
    }
    const profile = await DnaService.syncGenesFromDnaTestDb(playerId, seasonId);
    if (!profile) {
      return res.status(404).json({ error: 'No matches in test DB for this player' });
    }
    let poolStatsData = null;
    try {
      poolStatsData = await poolStats.loadPoolStats(seasonId);
    } catch (_e) {
      /* optional */
    }
    const v2 = DnaService.mapProfileToV2(profile, poolStatsData);
    return res.json(v2);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/pipeline/:jobId
 * Returns pipeline job status: { status, progress?, result?, error? }
 */
async function getPipelineStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/dna-test/last-match
 * Returns the most recent match from bd_dna_test (for DNA Map default).
 */
async function getDnaTestLastMatch(req, res, next) {
  try {
    const match = await dbDnaTest('matches')
      .orderBy('played_at', 'desc')
      .first('match_id', 'map_name', 'played_at');
    if (!match) {
      return res.json({ matchId: null, mapName: null, played_at: null });
    }
    res.json({
      matchId: match.match_id,
      mapName: match.map_name,
      played_at: match.played_at,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/dna-map/tournaments?useDnaTest=true
 * Returns list of tournaments that have matches in selected DB.
 */
async function getDnaMapTournaments(req, res, next) {
  try {
    const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';
    const knex = useDnaTest ? dbDnaTest : db;
    const { filterTournaments } = require('../../shared/testDataFilters');
    const { tournamentCountsInRating } = require('../../shared/tournamentRatingPolicy');

    // matches.tournament_id -> tournaments.id (только актуальная БД для prod)
    const rows = await knex('matches as m')
      .join('tournaments as t', 't.id', 'm.tournament_id')
      .distinct(
        'm.tournament_id as tournamentId',
        't.name as tournamentName',
        't.date as tournamentDate',
        't.type as tournamentType',
        't.state as tournamentState',
        't.extra as tournamentExtra'
      )
      .orderBy('tournamentDate', 'desc');

    let mapped = Array.isArray(rows)
      ? rows.map((r) => ({
          id: r.tournamentId,
          name: r.tournamentName,
          date: r.tournamentDate,
          type: r.tournamentType,
          state: r.tournamentState,
        }))
      : [];

    if (!useDnaTest) {
      mapped = filterTournaments(
        rows
          .filter((r) => tournamentCountsInRating({ extra: r.tournamentExtra }))
          .map((r) => ({
            id: r.tournamentId,
            name: r.tournamentName,
            date: r.tournamentDate,
            type: r.tournamentType,
            state: r.tournamentState,
          }))
      );
    }

    res.json(mapped);
  } catch (e) {
    // Fallback: return distinct tournament ids if join fails for any reason
    try {
      const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';
      const knex = useDnaTest ? dbDnaTest : db;
      const rows = await knex('matches').distinct('tournament_id').orderBy('tournament_id', 'asc');
      res.json(
        Array.isArray(rows)
          ? rows.map((r) => ({ id: r.tournament_id, name: String(r.tournament_id) }))
          : []
      );
    } catch (_e) {
      next(e);
    }
  }
}

/**
 * GET /api/v1/dna/dna-map/tournaments/:tournamentId/matches?useDnaTest=true
 * Returns match list (matchId + map + played_at) for selected tournament.
 */
async function getDnaMapTournamentMatches(req, res, next) {
  try {
    const { tournamentId } = req.params;
    const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';

    if (!useDnaTest) {
      const TournamentService = require('../services/TournamentService');
      const { tournamentCountsInRating } = require('../../shared/tournamentRatingPolicy');
      const t = await TournamentService.getTournamentById(tournamentId);
      if (!t || !tournamentCountsInRating(t)) {
        return res.json([]);
      }
    }

    const knex = useDnaTest ? dbDnaTest : db;

    const rows = await knex('matches')
      .where({ tournament_id: tournamentId })
      .orderBy('played_at', 'desc')
      .select('match_id as matchId', 'map_name as mapName', 'played_at as startedAt');

    res.json(Array.isArray(rows) ? rows.map((r) => ({ ...r })) : []);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/match/:matchId/export?useDnaTest=true
 * Returns ZIP with match.json, telemetry.json, participants.json.
 */
async function exportMatchZip(req, res, next) {
  try {
    const { matchId } = req.params;
    const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';
    const knex = useDnaTest ? dbDnaTest : db;

    const match = await knex('matches').where({ match_id: matchId }).first();
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const participants = await knex('participants').where({ match_ref: match.id }).select('*');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="match-${matchId}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    const matchPayload = {
      match_id: match.match_id,
      tournament_id: match.tournament_id,
      shard: match.shard,
      map_name: match.map_name,
      played_at: match.played_at,
      processed: match.processed,
    };
    archive.append(JSON.stringify(matchPayload, null, 2), { name: 'match.json' });

    const participantsPayload = participants.map((p) => ({
      player_id: p.player_id,
      player_name: p.player_name,
      api_name: p.api_name,
      team_id: p.team_id,
      kills: p.kills,
      damage: p.damage,
      placement: p.placement,
      stats: typeof p.stats === 'string' ? (p.stats ? JSON.parse(p.stats) : null) : p.stats,
    }));
    archive.append(JSON.stringify(participantsPayload, null, 2), { name: 'participants.json' });

    if (match.telemetry) {
      const telemetry = typeof match.telemetry === 'string' ? match.telemetry : JSON.stringify(match.telemetry);
      archive.append(telemetry, { name: 'telemetry.json' });
    }

    await archive.finalize();
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/dna/match/:matchId/map-data?playerId=IVANCHK&useDnaTest=true
 * Returns { mapName, landing: { x, y }, path: [{ x, y }, ...], death: { x, y } | null }.
 */
async function getMatchMapData(req, res, next) {
  try {
    const { matchId } = req.params;
    const playerId = req.query.playerId || 'IVANCHK';
    const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';
    const knex = useDnaTest ? dbDnaTest : db;

    const match = await knex('matches').where({ match_id: matchId }).first();
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    let telemetry = match.telemetry;
    if (typeof telemetry === 'string') {
      try {
        telemetry = JSON.parse(telemetry);
      } catch (_e) {
        return res.status(500).json({ error: 'Invalid telemetry in match' });
      }
    }
    const emptyMapData = () => ({
      mapName: match.map_name || '',
      landings: [],
      deaths: [],
      pathSegments: [],
      zoneSnapshots: [],
    });

    if (!telemetry) {
      return res.json(emptyMapData());
    }

    // Resolve player: try account id from participants so telemetry character.accountId matches
    let participant = null;
    try {
      participant = await knex('participants')
        .where({ match_ref: match.id })
        .whereRaw('LOWER(player_name) = ? OR player_id = ?', [String(playerId).toLowerCase(), playerId])
        .first();
    } catch (dbErr) {
      console.error('getMatchMapData participants query:', dbErr.message);
    }
    const identifier = participant ? participant.player_id : playerId;

    let data;
    try {
      data = extractMapData(telemetry, identifier, { pathIntervalSec: 5 }) ||
        extractMapData(telemetry, playerId, { pathIntervalSec: 5 }) ||
        emptyMapData();
    } catch (extractErr) {
      console.error('getMatchMapData extractMapData:', extractErr);
      return res.status(500).json({
        error: 'Failed to extract map data from telemetry',
        detail: extractErr.message,
      });
    }
    if (!data.mapName && match.map_name) data.mapName = match.map_name;
    if (!Array.isArray(data.pathSegments)) data.pathSegments = [];
    if (!Array.isArray(data.landings)) data.landings = [];
    if (!Array.isArray(data.deaths)) data.deaths = [];
    let zoneSnapshots = [];
    try {
      zoneSnapshots = extractZoneSnapshots(telemetry);
    } catch (_e) {
      zoneSnapshots = [];
    }
    data.zoneSnapshots = zoneSnapshots;
    res.json(data);
  } catch (e) {
    next(e);
  }
}

/**
 * Build DNA Map session from file store (matches/<matchId>/match.json, players/*.track.json, *.events.json).
 * @param {string} matchId
 * @param {string} primary - playerId or accountId
 * @param {string} secondary
 * @returns {Promise<Object|null>} session or null if match not found
 */
async function buildDnaMapSessionFromFileStore(matchId, primary, secondary) {
  let meta;
  try {
    const raw = await fs.readFile(getPubgMatchMetaPath(matchId), 'utf8');
    meta = JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  const primaryAccountId = resolvePubgAccountId(meta, primary) || primary;
  const secondaryAccountId = secondary ? (resolvePubgAccountId(meta, secondary) || secondary) : null;
  const mapName = meta.mapName || '';
  const durationSec = meta.durationSec || 1200;
  const mapSize = getMapWorldSize(mapName);
  const imageUrl = getMapImageUrl(mapName);
  const participantLabel = (accountId) => {
    const p = (meta.participants || []).find((x) => String(x.accountId) === String(accountId));
    return (p && p.name) ? p.name : accountId;
  };

  const session = {
    match: {
      matchId: meta.matchId || matchId,
      mapName,
      startedAt: meta.startedAt || new Date().toISOString(),
      durationSec,
      map: { imageUrl, worldSize: mapSize },
    },
    entities: {
      primary: { id: primaryAccountId, label: participantLabel(primaryAccountId), color: '#3b82f6' },
      ...(secondaryAccountId ? { secondary: { id: secondaryAccountId, label: participantLabel(secondaryAccountId), color: '#0ea5e9' } } : {}),
    },
    tracks: { primary: [], ...(secondaryAccountId ? { secondary: [] } : {}) },
    events: [],
    fights: [],
    zoneSnapshots: [],
    coverage: { tracks: false, events: false, damage: false, zone: false },
  };

  const idNameMap = {};
  const idTeamMap = {};
  for (const p of meta.participants || []) {
    const aid = p.accountId != null ? String(p.accountId).trim() : '';
    const nm = (p.name || '').toString().trim();
    if (aid && nm) idNameMap[aid] = nm;
    if (aid && p.teamId != null && String(p.teamId).trim() !== '') idTeamMap[aid] = String(p.teamId).trim();
  }
  session.idNameMap = idNameMap;
  session.idTeamMap = idTeamMap;
  session.roster = Object.keys(idNameMap).map((id) => ({ id, label: idNameMap[id], teamId: idTeamMap[id] || null }));

  const loadTrack = async (accountId) => {
    try {
      const raw = await fs.readFile(getPubgPlayerTrackPath(matchId, accountId), 'utf8');
      const data = JSON.parse(raw);
      return (data.points || []).map((p) => ({ t: p.t, x: p.x, y: p.y, meta: {} }));
    } catch (_e) {
      return [];
    }
  };
  const loadEvents = async (accountId) => {
    try {
      const raw = await fs.readFile(getPubgPlayerEventsPath(matchId, accountId), 'utf8');
      const data = JSON.parse(raw);
      return data.events || [];
    } catch (_e) {
      return [];
    }
  };

  session.tracks.primary = await loadTrack(primaryAccountId);
  session.coverage.tracks = session.tracks.primary.length > 0;
  const primaryEvents = await loadEvents(primaryAccountId);
  primaryEvents.forEach((ev) => {
    session.events.push({
      id: ev.id,
      t: ev.t,
      type: ev.type,
      x: ev.x,
      y: ev.y,
      actor: ev.actorId ? { id: ev.actorId, label: participantLabel(ev.actorId), teamId: idTeamMap[ev.actorId] || undefined } : undefined,
      target: ev.targetId ? { id: ev.targetId, label: participantLabel(ev.targetId), teamId: idTeamMap[ev.targetId] || undefined } : undefined,
    });
  });
  session.coverage.events = session.events.length > 0;

  if (secondaryAccountId) {
    session.tracks.secondary = await loadTrack(secondaryAccountId);
  }
  return session;
}

/**
 * GET /api/v1/dna/dna-map/session?matchId=...&primary=...&secondary=...&mode=player&useDnaTest=true
 * Returns session contract: match, entities, tracks (with t), events, fights, coverage.
 * Query source=file: load session from file store (matches/<matchId>/).
 */
async function getDnaMapSession(req, res, next) {
  try {
    const matchId = req.query.matchId;
    const primary = req.query.primary || 'IVANCHK';
    const secondary = req.query.secondary || '';
    const useDnaTest = req.query.useDnaTest === 'true' || req.query.useDnaTest === '1';
    const sourceFile = req.query.source === 'file';

    if (!matchId) {
      return res.status(400).json({ error: 'matchId required' });
    }

    if (sourceFile) {
      const session = await buildDnaMapSessionFromFileStore(matchId, primary, secondary);
      if (!session) return res.status(404).json({ error: 'Match not found in file store' });
      return res.json(session);
    }

    const knex = useDnaTest ? dbDnaTest : db;
    const match = await knex('matches').where({ match_id: matchId }).first();
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    let idNameMap = {};
    let idTeamMap = {};
    let participantRows = [];
    try {
      participantRows = await knex('participants').where({ match_ref: match.id }).select('player_id', 'player_name', 'api_name', 'team_id');
      idNameMap = buildIdNameMapFromParticipantRows(participantRows);
      idTeamMap = buildIdTeamMapFromParticipantRows(participantRows);
    } catch (_e) {
      /* missing table / column */
    }

    let telemetry = match.telemetry;
    if (typeof telemetry === 'string') {
      try {
        telemetry = JSON.parse(telemetry);
      } catch (_e) {
        return res.status(500).json({ error: 'Invalid telemetry in match' });
      }
    }

    const mapName = match.map_name || '';
    const durationSec = 1200;
    const mapSize = getMapWorldSize(mapName);
    const imageUrl = getMapImageUrl(mapName);

    const emptySession = (primaryId, secondaryId) => {
      const pid = primaryId || primary;
      const sid = secondary ? secondaryId || secondary : null;
      const participantLabelEarly = (id) => {
        if (id == null) return '';
        const s = String(id);
        if (idNameMap[s]) return idNameMap[s];
        return s;
      };
      return {
        match: {
          matchId,
          mapName,
          startedAt: match.played_at || new Date().toISOString(),
          durationSec,
          map: { imageUrl, worldSize: mapSize },
        },
        idNameMap,
        idTeamMap,
        roster: Object.keys(idNameMap).map((id) => ({
          id,
          label: idNameMap[id] || id,
          teamId: idTeamMap[id] || null,
        })),
        entities: {
          primary: {
            id: pid,
            label: participantLabelEarly(pid),
            teamId: (pid != null && idTeamMap[String(pid)]) ? idTeamMap[String(pid)] : undefined,
            color: '#3b82f6',
          },
          ...(secondary && sid != null
            ? {
                secondary: {
                  id: sid,
                  label: participantLabelEarly(sid),
                  teamId: idTeamMap[String(sid)] || undefined,
                  color: '#0ea5e9',
                },
              }
            : {}),
        },
        tracks: { primary: [], ...(secondary ? { secondary: [] } : {}), byPlayer: {} },
        events: [],
        fights: [],
        zoneSnapshots: [],
        coverage: { tracks: false, events: false, damage: false, zone: false },
      };
    };

    if (!telemetry) {
      return res.json(emptySession(primary, secondary || null));
    }

    mergeTelemetryCharacterNamesIntoIdNameMap(telemetry, idNameMap);

    const { primaryAccountId, secondaryAccountId } = resolveAccountIdsFromTelemetry(telemetry, primary, secondary);

    const participantLabel = (id) => {
      if (id == null) return '';
      const sid = String(id);
      if (idNameMap[sid]) return idNameMap[sid];
      return sid;
    };
    const participantTeam = (id) => {
      if (id == null) return null;
      const sid = String(id);
      return idTeamMap[sid] || null;
    };

    let dataPrimary;
    try {
      dataPrimary = extractMapData(telemetry, primary, { pathIntervalSec: 5 }) || {
        pathSegments: [],
        landings: [],
        deaths: [],
      };
    } catch (_e) {
      return res.json(emptySession(primaryAccountId || primary, secondaryAccountId || secondary || null));
    }

    const pathSegments = dataPrimary.pathSegments || [];
    const landings = dataPrimary.landings || [];
    const deaths = dataPrimary.deaths || [];
    const groundSegments = pathSegments.filter((seg) => seg && !seg.isParachute);
    const allPoints = groundSegments.flatMap((seg) => seg?.points || seg || []);
    const pointCount = allPoints.length;

    const session = {
      match: {
        matchId,
        mapName,
        startedAt: match.played_at || new Date().toISOString(),
        durationSec,
        map: { imageUrl, worldSize: mapSize },
      },
      idNameMap,
      idTeamMap,
      roster: Object.keys(idNameMap).map((id) => ({
        id,
        label: idNameMap[id] || id,
        teamId: idTeamMap[id] || null,
      })),
      entities: {
        primary: {
          id: primaryAccountId || primary,
          label: participantLabel(primaryAccountId || primary),
          teamId: participantTeam(primaryAccountId || primary) || undefined,
          color: '#3b82f6',
        },
        ...(secondary
          ? {
              secondary: {
                id: secondaryAccountId || secondary,
                label: participantLabel(secondaryAccountId || secondary),
                teamId: participantTeam(secondaryAccountId || secondary) || undefined,
                color: '#0ea5e9',
              },
            }
          : {}),
      },
      tracks: { primary: [], ...(secondary ? { secondary: [] } : {}), byPlayer: {} },
      events: [],
      fights: [],
      zoneSnapshots: [],
      coverage: { tracks: false, events: false, damage: false, zone: false },
    };

    let zoneSnapshots = [];
    try {
      zoneSnapshots = extractZoneSnapshots(telemetry);
    } catch (_z) {
      zoneSnapshots = [];
    }
    session.zoneSnapshots = zoneSnapshots;
    session.coverage.zone = zoneSnapshots.length > 0;

    const accountIdsFromParticipants = Object.keys(idNameMap).filter(Boolean);
    const accountIdsForTracks = Array.from(
      new Set([primaryAccountId, secondaryAccountId, ...accountIdsFromParticipants].filter(Boolean).map((x) => String(x)))
    );
    let tracksByAccount = new Map();
    if (accountIdsForTracks.length > 0) {
      try {
        tracksByAccount = extractTracks(telemetry, accountIdsForTracks, { intervalSec: 2.5, maxPoints: 2500 });
      } catch (_tr) {
        tracksByAccount = new Map();
      }
    }

    function trackFromExtractor(accountId) {
      if (!accountId) return [];
      const tr = tracksByAccount.get(accountId);
      const pts = tr?.points;
      if (!Array.isArray(pts) || pts.length === 0) return [];
      return pts.map((p) => ({ t: p.t, x: p.x, y: p.y, meta: {} }));
    }

    const zoneEndT = zoneSnapshots.length ? zoneSnapshots[zoneSnapshots.length - 1].t : 0;
    const floorDurationForFallback = Math.max(durationSec, zoneEndT + 180, 600);

    let trackPrimary = trackFromExtractor(primaryAccountId);
    if (!trackPrimary.length && pointCount > 0) {
      trackPrimary = allPoints.map((p, i) => ({
        t: pointCount > 1 ? (i / (pointCount - 1)) * floorDurationForFallback * 0.85 : 0,
        x: p.x,
        y: p.y,
        meta: {},
      }));
    }
    const byPlayer = {};
    accountIdsForTracks.forEach((aid) => {
      const pts = trackFromExtractor(aid);
      if (pts.length) byPlayer[aid] = pts;
    });
    session.tracks.byPlayer = byPlayer;
    session.tracks.primary = trackPrimary;
    session.coverage.tracks = trackPrimary.length > 0;

    const landingTime =
      trackPrimary.length && trackPrimary[0].t != null
        ? Math.max(0, trackPrimary[0].t - 1)
        : 30;

    // Все ключевые моменты из телеметрии (KILL, DEATH, REVIVE, DAMAGE, HEAL, BOOST, VEHICLE_ENTER/EXIT, ZONE_DAMAGE)
    const accountIds = accountIdsForTracks;
    if (accountIds.length > 0) {
      const eventsMap = extractMapEvents(telemetry, accountIds, matchId);
      let eventId = 1;
      for (const aid of accountIds) {
        const list = eventsMap.get(aid)?.events || [];
        list.forEach((ev) => {
          session.events.push({
            id: ev.id || `evt-${eventId++}`,
            t: ev.t,
            type: ev.type,
            x: ev.x,
            y: ev.y,
            actor:
              ev.actorId != null
                ? {
                    id: ev.actorId,
                    label: participantLabel(ev.actorId),
                    teamId: participantTeam(ev.actorId) || undefined,
                  }
                : undefined,
            target:
              ev.targetId != null
                ? {
                    id: ev.targetId,
                    label: participantLabel(ev.targetId),
                    teamId: participantTeam(ev.targetId) || undefined,
                  }
                : undefined,
          });
        });
      }
      const seen = new Set();
      session.events = session.events.filter((e) => {
        const key = `${e.id || ''}|${e.t}|${e.type}|${e.x}|${e.y}|${e.actor?.id || ''}|${e.target?.id || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Приземления (в телеметрии нет в extractMapEvents — добавляем отдельно)
      landings.forEach((loc) => {
        session.events.push({
          id: `evt-landing-${eventId++}`,
          t: landingTime,
          type: 'LANDING',
          x: loc.x,
          y: loc.y,
          actor: {
            id: primaryAccountId || primary,
            label: participantLabel(primaryAccountId || primary),
          },
        });
      });
      session.events.sort((a, b) => (a.t || 0) - (b.t || 0));
    } else {
      // Fallback: только приземления и смерть, если не удалось разрешить accountIds
      let eventId = 1;
      landings.forEach((loc) => {
        session.events.push({
          id: `evt-${eventId++}`,
          t: 30,
          type: 'LANDING',
          x: loc.x,
          y: loc.y,
          actor: {
            id: primaryAccountId || primary,
            label: participantLabel(primaryAccountId || primary),
          },
        });
      });
      deaths.forEach((loc) => {
        session.events.push({
          id: `evt-${eventId++}`,
          t: floorDurationForFallback * 0.75,
          type: 'DEATH',
          x: loc.x,
          y: loc.y,
          target: {
            id: primaryAccountId || primary,
            label: participantLabel(primaryAccountId || primary),
          },
        });
      });
    }
    session.coverage.events = session.events.length > 0;

    if (secondary) {
      let dataSecondary;
      try {
        dataSecondary = extractMapData(telemetry, secondary, { pathIntervalSec: 5 }) || { pathSegments: [] };
      } catch (_e) {
        dataSecondary = { pathSegments: [] };
      }
      const segs = (dataSecondary.pathSegments || []).filter((seg) => seg && !seg.isParachute);
      const pts = segs.flatMap((seg) => seg?.points || seg || []);
      let trackSecondary = trackFromExtractor(secondaryAccountId);
      if (!trackSecondary.length && pts.length > 0) {
        const n = pts.length;
        trackSecondary = pts.map((p, i) => ({
          t: n > 1 ? (i / (n - 1)) * floorDurationForFallback * 0.85 : 0,
          x: p.x,
          y: p.y,
          meta: {},
        }));
      }
      session.tracks.secondary = trackSecondary;
    }

    const timeCandidates = [];
    session.events.forEach((e) => timeCandidates.push(e.t || 0));
    session.tracks.primary.forEach((p) => timeCandidates.push(p.t || 0));
    if (session.tracks.secondary?.length) {
      session.tracks.secondary.forEach((p) => timeCandidates.push(p.t || 0));
    }
    Object.values(session.tracks.byPlayer || {}).forEach((pts) => {
      (pts || []).forEach((p) => timeCandidates.push(p.t || 0));
    });
    if (zoneSnapshots.length) timeCandidates.push(zoneSnapshots[zoneSnapshots.length - 1].t);
    const maxT = timeCandidates.length ? Math.max(...timeCandidates) : 0;
    session.match.durationSec = Math.max(120, Math.ceil(maxT) + 90);

    res.json(session);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getProfile,
  getSeasons,
  getDictionary,
  getLeaderboard,
  getDnaTestLastMatch,
  getDnaMapTournaments,
  getDnaMapTournamentMatches,
  ingestMatch,
  extractFeatures,
  recompute,
  pipeline,
  pipelineRetry,
  getPipelineStatus,
  syncGenes,
  exportMatchZip,
  getMatchMapData,
  getDnaMapSession,
};
