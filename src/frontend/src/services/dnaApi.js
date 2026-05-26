/**
 * DNA Lab API client.
 * All endpoints relative to API_BASE_URL (e.g. /api/v1).
 */
import api from './api';

/**
 * @returns {Promise<{ seasons: string[] }>} Available year slices (e.g. ["2025", "2026"]).
 */
export async function getSeasons() {
  const { data } = await api.get('/dna/seasons');
  return data;
}

/**
 * @param {string} playerId
 * @param {string} [seasonId] Year slice, e.g. "2025", "2026".
 * @param {{ useDnaTest?: boolean }} [options]
 * @returns {Promise<import('@/widgets/dna-lab/types').DNAProfile>}
 */
export async function getProfile(playerId, seasonId = '2025', options = {}) {
  const params = { ...(seasonId ? { seasonId } : {}) };
  if (options.useDnaTest) params.useDnaTest = 'true';
  const { data } = await api.get(`/dna/${encodeURIComponent(playerId)}`, { params });
  return data;
}

/**
 * @returns {Promise<import('@/widgets/dna-lab/types').DictionaryEntry[]>}
 */
export async function getDictionary() {
  const { data } = await api.get('/dna/dictionary');
  return data;
}

/**
 * @param {string} [seasonId] Year slice, e.g. "2025", "2026".
 * @param {{ useDnaTest?: boolean }} [options]
 * @returns {Promise<import('@/widgets/dna-lab/types').LeaderboardEntry[]>}
 */
export async function getLeaderboard(seasonId = '2025', options = {}) {
  const params = { ...(seasonId ? { seasonId } : {}) };
  if (options.useDnaTest) params.useDnaTest = 'true';
  const { data } = await api.get('/dna/leaderboard', { params });
  return data;
}

/** Paramo map size in cm (PUBG telemetry). */
const PARAMO_MAP_SIZE_CM = 306000;

/**
 * @returns {Promise<{ matchId: string | null, mapName: string | null, played_at: string | null }>}
 */
export async function getDnaTestLastMatch() {
  const { data } = await api.get('/dna/dna-test/last-match');
  return data;
}

/**
 * @param {string} matchId
 * @param {string} [playerId]
 * @param {{ useDnaTest?: boolean }} [options]
 * @returns {Promise<{ mapName: string, landing: { x, y } | null, path: Array<{ x, y }>, death: { x, y } | null }>}
 */
export async function getMatchMapData(matchId, playerId = 'IVANCHK', options = {}) {
  const params = { playerId };
  if (options.useDnaTest) params.useDnaTest = 'true';
  const { data } = await api.get(`/dna/match/${encodeURIComponent(matchId)}/map-data`, { params });
  return data;
}

/**
 * List matches from PUBG feature store (file store).
 * @returns {Promise<Array<{ matchId: string, mapName?: string, startedAt?: string }>>}
 */
export async function getPubgMatches() {
  const { data } = await api.get('/pubg/matches');
  return data;
}

/**
 * DNA Map selection: tournaments list (from DB matches table).
 * @param {{ useDnaTest?: boolean }} [options]
 * @returns {Promise<Array<{ id: string, name: string, date?: string, type?: string, state?: string }>>}
 */
export async function getDnaMapTournaments(options = {}) {
  const params = {};
  if (options.useDnaTest) params.useDnaTest = 'true';
  const { data } = await api.get('/dna/dna-map/tournaments', { params });
  return data;
}

/**
 * DNA Map selection: matches for given tournament.
 * @param {string} tournamentId
 * @param {{ useDnaTest?: boolean }} [options]
 * @returns {Promise<Array<{ matchId: string, mapName?: string, startedAt?: string }>>}
 */
export async function getDnaMapTournamentMatches(tournamentId, options = {}) {
  const params = {};
  if (options.useDnaTest) params.useDnaTest = 'true';
  const { data } = await api.get(`/dna/dna-map/tournaments/${encodeURIComponent(tournamentId)}/matches`, { params });
  return data;
}

/**
 * POST /api/v1/dna/pipeline — start async pipeline. Returns { jobId } immediately.
 * @param {{ matchIds: string[], playerIds: string[], seasonId?: string }}
 * @returns {Promise<{ jobId: string }>}
 */
export async function postPipeline(body) {
  const { data } = await api.post('/dna/pipeline', body);
  return data;
}

/**
 * GET /api/v1/dna/pipeline/:jobId — get pipeline job status.
 * @param {string} jobId
 * @returns {Promise<{ jobId: string, status: string, progress?: object, result?: object, error?: string }>}
 */
export async function getPipelineStatus(jobId) {
  const { data } = await api.get(`/dna/pipeline/${encodeURIComponent(jobId)}`);
  return data;
}

/**
 * POST /api/v1/dna/sync-genes — recompute genes from test DB, save to main DB, return profile v2.
 * @param {string} playerId
 * @param {string} [seasonId]
 * @returns {Promise<import('@/widgets/dna-lab/types').DNAProfile>}
 */
export async function syncGenesFromTestDb(playerId, seasonId = '2025') {
  const { data } = await api.post('/dna/sync-genes', { playerId, seasonId });
  return data;
}

/**
 * POST /api/v1/dna/pipeline/retry — retry ingest for failed matchIds.
 * @param {{ matchIds?: string[], jobId?: string }}
 * @returns {Promise<{ ingested: number, failed: string[], retried: number }>}
 */
export async function postPipelineRetry(body) {
  const { data } = await api.post('/dna/pipeline/retry', body);
  return data;
}

/**
 * DNA Map Studio session: match meta, tracks with time, events, fights.
 * @param {string} matchId
 * @param {string} [primary] Player or team id
 * @param {string} [secondary] For compare mode
 * @param {'player'|'team'} [mode]
 * @param {{ useDnaTest?: boolean, source?: 'file' }} [options] source=file loads from file store
 * @returns {Promise<import('./dnaMapSessionContract').DnaMapSession>}
 */
export async function getDnaMapSession(matchId, primary, secondary, mode = 'player', options = {}) {
  const params = { primary: primary || '', secondary: secondary || '', mode };
  if (options.useDnaTest) params.useDnaTest = 'true';
  if (options.source === 'file') params.source = 'file';
  try {
    const { data } = await api.get('/dna/dna-map/session', {
      params: { matchId, ...params },
    });
    return data;
  } catch (err) {
    const useMock = err?.response?.status === 404 || err?.code === 'ERR_NETWORK';
    if (useMock && matchId) {
      return getDnaMapSessionMock(matchId, primary, secondary);
    }
    throw err;
  }
}

/**
 * Mock session for UI development when backend session not yet available.
 * @param {string} matchId
 * @param {string} [primary]
 * @param {string} [secondary]
 * @returns {import('./dnaMapSessionContract').DnaMapSession}
 */
export function getDnaMapSessionMock(matchId, primary = 'IVANCHK', secondary) {
  const mapSize = 306000;
  const durationSec = 1200;

  const makeTrack = (offsetX, offsetY, phase, scale = 1) => {
    const pts = [];
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * durationSec * 0.62;
      pts.push({
        t,
        x: 78000 + offsetX + Math.sin((t / 200) * Math.PI + phase) * 52000 * scale,
        y: 118000 + offsetY + Math.cos((t / 185) * Math.PI + phase * 0.5) * 48000 * scale,
      });
    }
    return pts;
  };

  /** Несколько команд и игроков — для реплея с полным матчем (~30 игроков в проде; в моке 6). */
  const byPlayer = {
    p1: makeTrack(0, 0, 0, 1),
    p4: makeTrack(12000, 6000, 0.4, 0.92),
    p2: makeTrack(38000, 22000, 1.1, 1),
    p5: makeTrack(40000, 20000, 1.25, 0.88),
    p3: makeTrack(22000, -8000, 2.0, 1.05),
    p6: makeTrack(-24000, 16000, 0.75, 0.95),
  };

  const primaryTrack = byPlayer.p1;

  const events = [
    {
      id: 'evt-1',
      t: 120,
      type: 'KILL',
      x: 95000,
      y: 140000,
      actor: { id: 'p1', label: primary || 'Player1', teamId: 't1' },
      target: { id: 'p2', label: 'SecRetYT', teamId: 't2' },
      weapon: 'M416',
      damage: 100,
      distanceM: 78,
      tags: ['headshot'],
      fightId: 'fight-1',
    },
    {
      id: 'evt-1b',
      t: 200,
      type: 'KNOCK',
      x: 98000,
      y: 138000,
      actor: { id: 'p6', label: 'LoneWolf', teamId: 't3' },
      target: { id: 'p5', label: 'BravoTwo', teamId: 't2' },
      weapon: 'AKM',
      fightId: 'fight-1',
    },
    {
      id: 'evt-2',
      t: 420,
      type: 'DEATH',
      x: 110000,
      y: 135000,
      target: { id: 'p1', label: primary || 'Player1', teamId: 't1' },
      actor: { id: 'p3', label: 'SniperX', teamId: 't2' },
      weapon: 'Kar98k',
      damage: 100,
      distanceM: 150,
      fightId: 'fight-1',
    },
    {
      id: 'evt-3',
      t: 90,
      type: 'REVIVE',
      x: 88000,
      y: 125000,
      actor: { id: 'p1', label: primary || 'Player1', teamId: 't1' },
      target: { id: 'p4', label: 'Teammate', teamId: 't1' },
    },
  ];
  const fights = [
    {
      id: 'fight-1',
      startT: 100,
      endT: 450,
      centroid: { x: 102500, y: 137500 },
      participants: { sideA: [primary || 'p1'], sideB: ['p2', 'p3'] },
      outcome: 'loss',
      stats: { damageA: 120, damageB: 180, killsA: 1, killsB: 1 },
    },
  ];
  const cx = 153000;
  const cy = 153000;
  const zoneSnapshots = [];
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * durationSec * 0.55;
    const shrink = i / 14;
    const rWhite = 200000 - shrink * 150000;
    zoneSnapshots.push({
      t,
      safe: { x: cx + shrink * 12000, y: cy - shrink * 8000, r: Math.max(28000, rWhite) },
      next:
        i < 14
          ? {
              x: cx + shrink * 18000 + 8000 * Math.sin(i * 0.4),
              y: cy - shrink * 10000 + 6000 * Math.cos(i * 0.35),
              r: Math.max(22000, rWhite * 0.68),
            }
          : null,
    });
  }
  const session = {
    match: {
      matchId,
      mapName: 'Chimera_Main',
      startedAt: new Date(Date.now() - durationSec * 1000).toISOString(),
      durationSec,
      map: { imageUrl: '/maps/paramo.png', worldSize: mapSize },
    },
    idNameMap: {
      p1: primary || 'IVANCHK',
      p2: 'SecRetYT',
      p3: 'SniperX',
      p4: 'Teammate',
      p5: 'BravoTwo',
      p6: 'LoneWolf',
    },
    idTeamMap: {
      p1: 't1',
      p4: 't1',
      p2: 't2',
      p5: 't2',
      p3: 't2',
      p6: 't3',
    },
    roster: [
      { id: 'p1', label: primary || 'IVANCHK', teamId: 't1' },
      { id: 'p4', label: 'Teammate', teamId: 't1' },
      { id: 'p2', label: 'SecRetYT', teamId: 't2' },
      { id: 'p5', label: 'BravoTwo', teamId: 't2' },
      { id: 'p3', label: 'SniperX', teamId: 't2' },
      { id: 'p6', label: 'LoneWolf', teamId: 't3' },
    ],
    entities: {
      primary: { id: 'p1', label: primary || 'IVANCHK', teamId: 't1', color: '#3b82f6' },
      ...(secondary ? { secondary: { id: secondary, label: secondary, color: '#0ea5e9' } } : {}),
    },
    tracks: {
      primary: primaryTrack,
      ...(secondary ? { secondary: primaryTrack.map((p) => ({ ...p, x: p.x + 15000, y: p.y - 10000 })) } : {}),
      byPlayer,
    },
    events,
    fights,
    zoneSnapshots,
    coverage: { tracks: true, events: true, damage: true, zone: true },
  };
  return session;
}

export { PARAMO_MAP_SIZE_CM };
