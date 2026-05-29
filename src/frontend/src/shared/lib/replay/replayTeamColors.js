/**
 * Стабильная премиум-палитра для команд (тёмный UI, хорошая дифференциация).
 * Порядок важен: при сортировке teamId одинаковый индекс → один цвет.
 */
export const PREMIUM_TEAM_PALETTE = [
  "#5b8def",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#2dd4bf",
  "#fb923c",
  "#e879f9",
  "#4ade80",
  "#60a5fa",
  "#facc15",
  "#c084fc",
  "#38bdf8",
  "#4d7c0f",
  "#dc2626",
  "#64748b",
  "#06b6d4",
  "#d946ef",
  "#84cc16",
  "#eab308",
  "#0ea5e9",
  "#f43f5e",
  "#8b5cf6",
  "#10b981",
  "#f97316",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#ef4444",
  "#a3e635",
  "#3b82f6",
  "#22c55e",
];

/**
 * @param {string} teamId
 * @param {string[]} sortedTeamIds
 */
export function getStableTeamColor(teamId, sortedTeamIds) {
  if (teamId == null || teamId === "") return "rgba(148, 163, 184, 0.95)";
  const key = String(teamId);
  const idx = sortedTeamIds.indexOf(key);
  const i = idx >= 0 ? idx : Math.abs(hashString(key)) % PREMIUM_TEAM_PALETTE.length;
  return PREMIUM_TEAM_PALETTE[i % PREMIUM_TEAM_PALETTE.length];
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
