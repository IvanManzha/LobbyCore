/**
 * Build telemetry.index.json from events: timeStart, timeEnd, players, eventCountsByType, mapBounds.
 */
const { parseEvents, eventType, parseTime, getAccountId } = require('./telemetryHelpers');

/**
 * @param {Object|Array} telemetry
 * @param {{ extractorVersion?: string }} [opts]
 * @returns {import('./pubgContracts').TelemetryIndex}
 */
function buildTelemetryIndex(telemetry, opts = {}) {
  const events = parseEvents(telemetry);
  const players = new Set();
  const eventCountsByType = {};
  let timeStart = Infinity;
  let timeEnd = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const evt of events) {
    if (!evt || typeof evt !== 'object') continue;
    const type = eventType(evt);
    if (!type) continue;
    const t = parseTime(evt);
    if (Number.isFinite(t)) {
      if (t < timeStart) timeStart = t;
      if (t > timeEnd) timeEnd = t;
    }
    eventCountsByType[type] = (eventCountsByType[type] || 0) + 1;

    const char = evt.character ?? evt.Character ?? evt.victim ?? evt.Victim ?? evt.killer ?? evt.Killer ?? evt.attacker ?? evt.Attacker ?? evt.reviver ?? evt.Reviver;
    if (char) {
      const aid = getAccountId(char);
      if (aid) players.add(aid);
    }
    if (evt.assistant) {
      const aid = getAccountId(evt.assistant);
      if (aid) players.add(aid);
    }

    const loc = evt.character?.location ?? evt.character?.Location ?? evt.victim?.location ?? evt.Victim?.Location ?? evt.killer?.location ?? evt.Killer?.Location;
    if (loc) {
      const x = loc.x ?? loc.X;
      const y = loc.y ?? loc.Y;
      if (typeof x === 'number' && Number.isFinite(x)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (typeof y === 'number' && Number.isFinite(y)) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const index = {
    timeStart: Number.isFinite(timeStart) ? timeStart : 0,
    timeEnd: Number.isFinite(timeEnd) ? timeEnd : 0,
    players: [...players],
    eventCountsByType,
  };
  if (Number.isFinite(minX) && Number.isFinite(maxX)) index.mapBounds = { minX, maxX, minY: Number.isFinite(minY) ? minY : 0, maxY: Number.isFinite(maxY) ? maxY : 0 };
  if (opts.extractorVersion) index.extractorVersion = opts.extractorVersion;
  return index;
}

module.exports = {
  buildTelemetryIndex,
};
