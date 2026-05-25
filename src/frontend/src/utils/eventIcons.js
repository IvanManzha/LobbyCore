/**
 * Event type to symbol and color (DNA Map Studio style guide).
 * Zoom tiers: <1 = KILL/DEATH/REVIVE only; 1-2 = + KNOCK/ZONE/VEHICLE; >2 = + DAMAGE
 */

export const EVENT_STYLE = {
  KILL: { symbol: "✖", color: "#dc2626", label: "Kill" },
  KNOCK: { symbol: "◑", color: "#d97706", label: "Knock" },
  DEATH: { symbol: "☠", color: "#dc2626", label: "Death" },
  REVIVE: { symbol: "✚", color: "#16a34a", label: "Revive" },
  DAMAGE: { symbol: "•", color: "#737373", label: "Damage" },
  VEHICLE_ENTER: { symbol: "⟂", color: "#64748b", label: "Vehicle enter" },
  VEHICLE_EXIT: { symbol: "⟂", color: "#64748b", label: "Vehicle exit" },
  HEAL: { symbol: "+", color: "#16a34a", label: "Heal" },
  BOOST: { symbol: "⚡", color: "#ca8a04", label: "Boost" },
  ZONE_DAMAGE: { symbol: "≈", color: "#0369a1", label: "Zone damage" },
  LOOT_PICKUP: { symbol: "▢", color: "#737373", label: "Loot" },
};

/**
 * @param {string} type
 * @returns {{ symbol: string; color: string; label: string }}
 */
export function getEventStyle(type) {
  return EVENT_STYLE[type] || { symbol: "•", color: "#737373", label: type || "Event" };
}

/**
 * @param {number} zoom
 * @param {string} type
 * @returns {boolean}
 */
export function isEventVisibleAtZoom(zoom, type) {
  if (zoom < 1) return ["KILL", "DEATH", "REVIVE"].includes(type);
  if (zoom < 2) return ["KILL", "DEATH", "REVIVE", "KNOCK", "ZONE_DAMAGE", "VEHICLE_ENTER", "VEHICLE_EXIT"].includes(type);
  return true;
}

/**
 * Format tooltip: "12:44 • KILL • IVANCHK → SecRetYT • M416 • 78m"
 */
export function formatEventTooltip(event) {
  const m = Math.floor(event.t / 60);
  const s = Math.floor(event.t % 60);
  const time = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const parts = [time, event.type];
  if (event.actor?.label) parts.push(event.actor.label);
  if (event.target?.label) parts.push("→", event.target.label);
  if (event.weapon) parts.push("•", event.weapon);
  if (event.distanceM != null) parts.push("•", `${event.distanceM}m`);
  return parts.join(" ");
}
