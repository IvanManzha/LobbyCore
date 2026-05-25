/**
 * Extract map visualization data from PUBG telemetry: parachute landings (green), deaths (red), path segments, plane exits (blue).
 * Трейлы не объединяются: парашютный сегмент (от выхода из самолёта до приземления) + наземный (от приземления до смерти), затем снова парашют + наземный и т.д.
 * pathSegments: массив { points, isParachute } (парашютные и наземные сегменты).
 * Интервал точек пути ~5 сек (pathIntervalSec). Events: LogParachuteLanding, LogPlayerPosition, LogPlayerKill/LogPlayerKillV2.
 */

function isSameCharacter(obj, playerId) {
  if (!obj) return false;
  const id = (obj.accountId || obj.account_id || obj.AccountId || '').toString().trim();
  const name = (obj.name || obj.Name || '').toString().toLowerCase().trim();
  const pid = String(playerId).toLowerCase().trim();
  const pidNorm = pid.replace(/\s+/g, ' ');
  if (id && (id === pid || id === playerId || id.toLowerCase() === pid)) return true;
  if (name && (name === pid || name === pidNorm || name.includes(pid) || pid.includes(name))) return true;
  return false;
}

function getLocation(obj) {
  if (!obj) return null;
  const x = obj.x ?? obj.X;
  const y = obj.y ?? obj.Y;
  if (x != null && y != null) return { x: Number(x), y: Number(y) };
  return null;
}

function parseEvents(telemetry) {
  if (!telemetry) return [];
  if (Array.isArray(telemetry)) return telemetry;
  if (Array.isArray(telemetry.events)) return telemetry.events;
  if (Array.isArray(telemetry.Telemetry)) return telemetry.Telemetry;
  return [];
}

function eventType(evt) {
  const t = evt._T || evt.eventType || evt.event_type || '';
  return String(t);
}

/**
 * @param {Object|Array} telemetry - Raw telemetry JSON (array of events or { events: [] })
 * @param {string} playerId - Account ID or player name
 * @param {{ pathIntervalSec?: number, pathMaxPoints?: number }} [options] - pathIntervalSec: interval between path points (default 5, under telemetry ~5s)
 * @returns {{ mapName: string, landings: Array<{ x, y }>, deaths: Array<{ x, y }>, pathSegments: Array<{ points: Array<{ x, y }>, isParachute: boolean }> }}
 */
function extractMapData(telemetry, playerId, options = {}) {
  const pathIntervalSec = options.pathIntervalSec ?? 5;
  const pathMaxPoints = options.pathMaxPoints ?? 2000;

  const events = parseEvents(telemetry);
  if (!Array.isArray(events)) return null;
  let mapName = (telemetry && (telemetry.mapName || telemetry.MapName)) || '';
  const landings = [];
  const deaths = [];
  const pathSegments = [];
  /** @type {'parachute'|'ground'} */
  let phase = 'parachute';
  let currentSegment = null;
  let lastPositionTime = 0;
  const landingBufferSec = 6;

  function capSegmentPoints(points) {
    if (points.length <= pathMaxPoints) return points;
    return points.filter((_, i) => i % Math.ceil(points.length / pathMaxPoints) === 0);
  }

  for (const evt of events) {
    if (!evt || typeof evt !== 'object') continue;
    const type = eventType(evt);
    const typeLower = type.toLowerCase();
    let t = 0;
    if (typeof evt._D === 'number' && Number.isFinite(evt._D)) t = evt._D;
    else if (evt._D) {
      const ms = new Date(evt._D).getTime();
      if (Number.isFinite(ms)) t = ms / 1000;
    } else if (evt.eventTime) {
      const ms = new Date(evt.eventTime).getTime();
      if (Number.isFinite(ms)) t = ms / 1000;
    }

    if (typeLower === 'logmatchstart' && (evt.mapName || evt.MapName)) {
      mapName = evt.mapName || evt.MapName || mapName;
    }

    const char = evt.character || evt.Character;

    if (typeLower === 'logparachutelanding') {
      if (char && isSameCharacter(char, playerId)) {
        const loc = getLocation(char.location || char.Location);
        if (loc) {
          landings.push({ x: loc.x, y: loc.y });
          // Парашютный сегмент не добавляем — только путь после приземления
          // Новый наземный сегмент от приземления
          currentSegment = { start: t + landingBufferSec, end: null, points: [{ x: loc.x, y: loc.y }], isParachute: false };
          pathSegments.push(currentSegment);
          lastPositionTime = t;
          phase = 'ground';
        }
      }
    }

    if (typeLower === 'logplayerkill' || typeLower === 'logplayerkillv2') {
      const victim = evt.victim || evt.Victim;
      if (victim && isSameCharacter(victim, playerId)) {
        const loc = getLocation(victim.location || victim.Location);
        if (loc) deaths.push(loc);
        currentSegment = null;
        phase = 'parachute';
      }
    }

    if (typeLower === 'logplayerposition') {
      if (!char || !isSameCharacter(char, playerId)) continue;
      const loc = getLocation(char.location || char.Location);
      if (!loc) continue;

      if (phase === 'parachute') {
        if (!currentSegment) currentSegment = { points: [], isParachute: true };
        if (currentSegment.points.length === 0 || t - lastPositionTime >= pathIntervalSec) {
          currentSegment.points.push({ x: loc.x, y: loc.y });
          lastPositionTime = t;
        }
        continue;
      }

      if (phase === 'ground' && currentSegment && currentSegment.end == null && t >= currentSegment.start) {
        if (currentSegment.points.length === 0 || t - lastPositionTime >= pathIntervalSec) {
          currentSegment.points.push({ x: loc.x, y: loc.y });
          lastPositionTime = t;
        }
      }
    }
  }

  // Не добавляем незакрытый парашютный сегмент — показываем только путь после приземления

  // Пересобрать pathSegments: уже лежащие там сегменты — объекты { points, isParachute }; наземные уже с points, их только ограничить
  const cappedSegments = pathSegments.map((seg) => ({
    points: capSegmentPoints(seg.points),
    isParachute: seg.isParachute === true,
  }));

  return { mapName, landings, deaths, pathSegments: cappedSegments };
}

module.exports = { extractMapData, parseEvents, isSameCharacter };
