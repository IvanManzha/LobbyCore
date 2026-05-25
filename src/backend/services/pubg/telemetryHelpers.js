/**
 * Shared helpers for telemetry parsing: event type, time, accountId, location.
 * Handles both _T/_D and eventType/eventTime and character.accountId / AccountId.
 */

function parseEvents(telemetry) {
  if (!telemetry) return [];
  if (Array.isArray(telemetry)) return telemetry;
  if (telemetry.events && Array.isArray(telemetry.events)) return telemetry.events;
  if (telemetry.Telemetry && Array.isArray(telemetry.Telemetry)) return telemetry.Telemetry;
  return [];
}

function eventType(evt) {
  const t = evt._T || evt.eventType || evt.event_type || '';
  return String(t);
}

/**
 * @param {Object} evt
 * @returns {number} time in seconds (from epoch or relative)
 */
function parseTime(evt) {
  const d = evt._D ?? evt.eventTime;
  if (d == null) return 0;
  if (typeof d === 'number' && Number.isFinite(d)) return d < 1e12 ? d : d / 1000;
  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms / 1000 : 0;
}

/**
 * Extract accountId from character/victim/killer/attacker object.
 * @param {Object} obj
 * @returns {string|null}
 */
function getAccountId(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const id = obj.accountId ?? obj.account_id ?? obj.AccountId ?? obj.playerId ?? obj.actor;
  if (id != null) return String(id);
  return null;
}

function getLocation(obj) {
  if (!obj) return null;
  const loc = obj.location || obj.Location || obj;
  const x = loc.x ?? loc.X;
  const y = loc.y ?? loc.Y;
  if (x != null && y != null) return { x: Number(x), y: Number(y) };
  return null;
}

/**
 * Match character object to accountId or name (case-insensitive).
 */
function isSameCharacter(obj, accountIdOrName) {
  if (!obj) return false;
  const id = getAccountId(obj);
  const name = (obj.name ?? obj.Name ?? '').toString().toLowerCase().trim();
  const key = String(accountIdOrName).toLowerCase().trim();
  if (id && (id === accountIdOrName || id.toLowerCase() === key)) return true;
  if (name && (name === key || name.includes(key) || key.includes(name))) return true;
  return false;
}

module.exports = {
  parseEvents,
  eventType,
  parseTime,
  getAccountId,
  getLocation,
  isSameCharacter,
};
