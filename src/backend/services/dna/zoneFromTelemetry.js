/**
 * Снимки белой зоны и «следующего» круга (poison gas warning) из LogGameStatePeriodic.
 * Координаты и радиусы в тех же единицах, что и Location в телеметрии (см).
 */
const { parseEvents, eventType, parseTime } = require('../pubg/telemetryHelpers');

function getMatchStartTs(events) {
  let matchStartTs = null;
  for (const evt of events) {
    const type = eventType(evt).toLowerCase();
    const t = parseTime(evt);
    if (matchStartTs == null && (type === 'logmatchstart' || type === 'logmatchdefinition')) {
      matchStartTs = t;
      break;
    }
  }
  return matchStartTs;
}

function readGameState(evt) {
  return evt.gameState ?? evt.GameState ?? null;
}

/**
 * @param {Object|Array} telemetry
 * @returns {Array<{ t: number, safe: { x: number, y: number, r: number }, next: { x: number, y: number, r: number } | null }>}
 */
function extractZoneSnapshots(telemetry) {
  const events = parseEvents(telemetry);
  if (!Array.isArray(events) || events.length === 0) return [];

  const matchStartTs = getMatchStartTs(events);
  const snapshots = [];

  for (const evt of events) {
    if (eventType(evt) !== 'LogGameStatePeriodic') continue;
    const gs = readGameState(evt);
    if (!gs) continue;

    const tWall = parseTime(evt);
    let t = matchStartTs != null ? tWall - matchStartTs : NaN;
    if (!Number.isFinite(t)) {
      const elapsed = gs.elapsedTime ?? gs.ElapsedTime;
      t = elapsed != null && Number.isFinite(Number(elapsed)) ? Number(elapsed) : 0;
    }

    const sp = gs.safetyZonePosition ?? gs.SafetyZonePosition;
    const sr = gs.safetyZoneRadius ?? gs.SafetyZoneRadius;
    const pp = gs.poisonGasWarningPosition ?? gs.PoisonGasWarningPosition;
    const pr = gs.poisonGasWarningRadius ?? gs.PoisonGasWarningRadius;

    const sx = sp?.x ?? sp?.X;
    const sy = sp?.y ?? sp?.Y;
    const safeR = sr != null ? Number(sr) : NaN;
    if (sx == null || sy == null || !Number.isFinite(safeR) || safeR <= 0) continue;

    const safe = { x: Number(sx), y: Number(sy), r: safeR };

    let next = null;
    const px = pp?.x ?? pp?.X;
    const py = pp?.y ?? pp?.Y;
    const nextR = pr != null ? Number(pr) : NaN;
    if (px != null && py != null && Number.isFinite(nextR) && nextR > 500) {
      next = { x: Number(px), y: Number(py), r: nextR };
    }

    snapshots.push({ t, safe, next });
  }

  snapshots.sort((a, b) => a.t - b.t);
  return snapshots;
}

module.exports = {
  extractZoneSnapshots,
  getMatchStartTs,
};
