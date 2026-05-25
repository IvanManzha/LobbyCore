/**
 * Визуальная иерархия replay viewer: важность событий, время, зум.
 */
import { getStableTeamColor } from "./replayTeamColors";
import { getTeamIdForPlayer } from "./replaySessionModel";

/** @typedef {'low' | 'medium' | 'high'} EventImportance */

const HIGH = new Set(["KILL", "DEATH"]);
const MEDIUM = new Set(["KNOCK", "REVIVE", "DAMAGE", "ZONE_DAMAGE", "VEHICLE_ENTER", "VEHICLE_EXIT", "LANDING"]);
const LOW = new Set(["HEAL", "BOOST", "LOOT_PICKUP", "LOOT"]);

/**
 * @param {string} type
 * @returns {EventImportance}
 */
export function getEventImportance(type) {
  if (HIGH.has(type)) return "high";
  if (MEDIUM.has(type)) return "medium";
  return "low";
}

/**
 * Базовый радиус маркера события (world units), масштабируется с зумом отдельно.
 * @param {EventImportance} imp
 */
export function getEventBaseRadius(imp) {
  if (imp === "high") return 2200;
  if (imp === "medium") return 1600;
  return 1100;
}

/**
 * Нормализованный зум реплея (minZoom … ZOOM_MAX) → слой видимости.
 * @param {number} zoom
 * @param {number} minZ
 * @param {number} maxZ
 * @returns {'far' | 'mid' | 'near'}
 */
export function getReplayZoomTier(zoom, minZ = 1, maxZ = 5) {
  const n = (zoom - minZ) / Math.max(0.001, maxZ - minZ);
  if (n < 0.28) return "far";
  if (n < 0.62) return "mid";
  return "near";
}

/**
 * Показывать ли тип события при данном зуме.
 * @param {'far' | 'mid' | 'near'} tier
 * @param {string} type
 * @param {EventImportance} imp
 */
export function isEventVisibleInReplayTier(tier, type, imp) {
  if (tier === "far") {
    return imp === "high" || type === "KNOCK";
  }
  if (tier === "mid") {
    return imp !== "low";
  }
  return true;
}

/**
 * Opacity по времени относительно playhead.
 * @param {number} evT
 * @param {number} currentT
 * @param {string | null} selectedEventId
 * @param {string} evId
 */
export function getEventTemporalOpacity(evT, currentT, selectedEventId, evId) {
  if (selectedEventId && evId === selectedEventId) return 1;

  const dt = evT - currentT;
  // будущее — почти скрыто
  if (dt > 2) return 0.06;
  if (dt > 0.2) return 0.18;

  const past = currentT - evT;
  if (past < 0) return 0.12;
  if (past < 25) return 0.92;
  if (past < 90) return 0.55;
  if (past < 240) return 0.32;
  return 0.18;
}

/**
 * Дополнительное затемнение, если событие не относится к выбранному игроку/фокусу.
 * @param {{ teamGameMode?: boolean, session?: import('../services/dnaMapSessionContract').DnaMapSession | null }} [opts]
 */
export function getFocusDimMultiplier(ev, focusPlayerId, focusTeamId, opts) {
  const teamGameMode = opts?.teamGameMode === true;
  const session = opts?.session ?? null;
  if (!focusPlayerId && !focusTeamId) return 1;

  const actorId = ev.actor?.id;
  const targetId = ev.target?.id;
  const actorTeam = ev.actor?.teamId != null ? String(ev.actor.teamId) : null;
  const targetTeam = ev.target?.teamId != null ? String(ev.target.teamId) : null;

  if (focusPlayerId && teamGameMode && session) {
    const ft = getTeamIdForPlayer(session, focusPlayerId);
    if (ft != null) {
      const fs = String(ft);
      const teamHit = actorTeam === fs || targetTeam === fs;
      if (!teamHit) return 0.35;
      const primaryHit = actorId === focusPlayerId || targetId === focusPlayerId;
      return primaryHit ? 1 : 0.55;
    }
  }

  if (focusPlayerId) {
    const hit = actorId === focusPlayerId || targetId === focusPlayerId;
    return hit ? 1 : 0.35;
  }

  if (focusTeamId) {
    const fs = String(focusTeamId);
    const hit = actorTeam === fs || targetTeam === fs;
    return hit ? 1 : 0.4;
  }

  return 1;
}

/**
 * Цвет команды: премиум-палитра при передаче sortedTeamIds, иначе стабильный HSL (legacy).
 * @param {string | null | undefined} teamId
 * @param {string[] | null} [sortedTeamIds]
 */
export function getTeamColor(teamId, sortedTeamIds = null) {
  if (teamId == null || teamId === "") return "#94a3b8";
  if (sortedTeamIds?.length) return getStableTeamColor(teamId, sortedTeamIds);
  let h = 0;
  const s = String(teamId);
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i) * (i + 7)) % 360;
  }
  return `hsl(${h} 72% 58%)`;
}

/**
 * Последняя точка трека на момент времени t.
 * @param {{ t: number, x: number, y: number }[]} track
 * @param {number} tSec
 */
export function getTrackPositionAtTime(track, tSec) {
  if (!Array.isArray(track) || track.length === 0) return null;
  const t = Number(tSec);
  if (!Number.isFinite(t)) return null;

  // Быстрый поиск последней точки с p.t <= tSec (трек отсортирован по t).
  let lo = 0;
  let hi = track.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const mt = Number(track[mid]?.t) || 0;
    if (mt <= t) {
      best = track[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
