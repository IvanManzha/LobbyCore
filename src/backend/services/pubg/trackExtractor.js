/**
 * Extract downsampled track (positions over time) per player from LogPlayerPosition.
 * Only points after first parachute landing (no plane/parachute trail). Target ~1-3k points.
 */
const { parseEvents, eventType, parseTime, getAccountId } = require('./telemetryHelpers');

const DEFAULT_INTERVAL_SEC = 1.5;
const MAX_POINTS = 3000;

/**
 * @param {Object|Array} telemetry
 * @param {string[]} accountIds
 * @param {{ intervalSec?: number, maxPoints?: number }} [opts]
 * @returns {Map<string, import('./pubgContracts').Track>}
 */
function extractTracks(telemetry, accountIds, opts = {}) {
  const events = parseEvents(telemetry);
  const intervalSec = opts.intervalSec ?? DEFAULT_INTERVAL_SEC;
  const maxPoints = opts.maxPoints ?? MAX_POINTS;
  const accountIdSet = new Set(accountIds);

  const pointsByAccount = new Map(accountIds.map((id) => [id, []]));
  const lastTimeByAccount = new Map(accountIds.map((id) => [id, -Infinity]));
  /** First parachute landing time per accountId (relative sec). Points before this are skipped. */
  const firstLandingTimeByAccount = new Map();

  let matchStartTs = null;

  for (const evt of events) {
    const type = eventType(evt);
    const typeLower = type.toLowerCase();
    const t = parseTime(evt);
    if (matchStartTs == null && (typeLower === 'logmatchstart' || typeLower === 'logmatchdefinition')) matchStartTs = t;
    const tRel = matchStartTs != null ? t - matchStartTs : t;

    if (typeLower === 'logparachutelanding') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIdSet.has(accountId) && !firstLandingTimeByAccount.has(accountId)) {
        firstLandingTimeByAccount.set(accountId, tRel);
      }
      continue;
    }

    if (typeLower !== 'logplayerposition') continue;
    const accountId = getAccountId(evt.character ?? evt.Character);
    if (!accountId || !accountIdSet.has(accountId)) continue;
    const firstLanding = firstLandingTimeByAccount.get(accountId);
    if (firstLanding != null && tRel < firstLanding) continue;

    const loc = evt.character?.location ?? evt.Character?.Location;
    if (!loc) continue;
    const x = loc.x ?? loc.X;
    const y = loc.y ?? loc.Y;
    if (x == null || y == null) continue;

    const lastT = lastTimeByAccount.get(accountId);
    if (tRel - lastT >= intervalSec) {
      const arr = pointsByAccount.get(accountId);
      arr.push({
        t: tRel,
        x: Number(x),
        y: Number(y),
        alive: true,
        hp: evt.character?.health ?? evt.character?.Health,
        isInBlueZone: evt.character?.isInBlueZone ?? evt.character?.isInBlueZone,
        numAlivePlayers: evt.numAlivePlayers,
      });
      lastTimeByAccount.set(accountId, tRel);
    }
  }

  const result = new Map();
  for (const accountId of accountIds) {
    let pts = pointsByAccount.get(accountId) || [];
    if (pts.length > maxPoints) {
      const step = Math.ceil(pts.length / maxPoints);
      pts = pts.filter((_, i) => i % step === 0);
    }
    result.set(accountId, {
      matchId: '',
      accountId,
      points: pts,
    });
  }
  return result;
}

module.exports = {
  extractTracks,
};
