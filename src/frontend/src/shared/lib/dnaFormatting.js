/**
 * DNA Lab formatting helpers: trend, labels, "Updated X ago".
 */

function formatDelta(delta, roundOnly) {
  const d = Number(delta);
  return roundOnly || d % 1 === 0 ? String(Math.round(d)) : d.toFixed(1);
}

/**
 * Format trend for display: "↑ +6 last match" / "↓ -2" / "" for flat.
 * @param {{ delta?: number|null, direction?: string|null, basis?: string|null }} trend
 * @param {string} [suffix] e.g. "last match"
 * @returns {string}
 */
export function formatTrend(trend, suffix = 'last match', roundOnly = false) {
  if (!trend) return '';
  const delta = trend.delta ?? (typeof trend === 'number' ? trend : null);
  if (delta == null || delta === 0) return '';
  const dir = delta > 0 ? '↑' : '↓';
  const value = delta > 0 ? `+${formatDelta(delta, roundOnly)}` : formatDelta(delta, roundOnly);
  return suffix ? `${dir} ${value} ${suffix}` : `${dir} ${value}`;
}

/**
 * Short trend (no suffix): "↑ +6" or "↓ -2".
 * @param {{ delta?: number|null, direction?: string|null }|number} trend
 * @returns {string}
 */
export function formatTrendShort(trend, roundOnly = false) {
  if (trend == null) return '';
  const delta = typeof trend === 'object' ? trend?.delta : trend;
  if (delta == null || delta === 0) return '';
  const dir = delta > 0 ? '↑' : '↓';
  const value = delta > 0 ? `+${formatDelta(delta, roundOnly)}` : formatDelta(delta, roundOnly);
  return `${dir} ${value}`;
}

/**
 * "Updated X minutes ago" / "Updated just now" / "Updated Xh ago".
 * @param {string|null|undefined} isoDate
 * @returns {string|null}
 */
export function formatUpdatedAgo(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Updated just now';
  if (diffMins < 60) return `Updated ${diffMins} min ago`;
  const diffH = Math.floor(diffMins / 60);
  return `Updated ${diffH}h ago`;
}

/**
 * Display value for gene: one decimal (e.g. 46.3) or "—" when null/insufficient data.
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatGeneValue(value, integerOnly = false) {
  if (value == null || Number.isNaN(value)) return '—';
  const n = Math.max(0, Math.min(100, Number(value)));
  return integerOnly || n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

/**
 * Confidence label for pill: Low / Medium / High.
 * @param {string|{ label?: string, level?: number }|null|undefined} confidence
 * @returns {string}
 */
export function formatConfidence(confidence) {
  if (!confidence) return 'Low';
  if (typeof confidence === 'string') return confidence.charAt(0).toUpperCase() + confidence.slice(1).toLowerCase();
  const label = confidence?.label;
  if (label) return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  const level = confidence?.level;
  if (level == null) return 'Low';
  if (level >= 0.7) return 'High';
  if (level >= 0.4) return 'Medium';
  return 'Low';
}
