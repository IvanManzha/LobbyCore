/**
 * Линейная интерполяция между снимками LogGameStatePeriodic (~каждые 10 с):
 * плавное «сужение» белой зоны и движение заявленного синего круга к цели.
 */

/**
 * @param {Array<{ t: number, safe: { x: number, y: number, r: number }, next: { x: number, y: number, r: number } | null }>} snapshots
 * @param {number} tSec
 * @returns {{ safe: { x: number, y: number, r: number }, next: { x: number, y: number, r: number } | null } | null}
 */
export function interpolateZoneAtTime(snapshots, tSec) {
  if (!snapshots?.length) return null;
  const t = Number(tSec);
  if (!Number.isFinite(t)) return null;

  if (t <= snapshots[0].t) {
    return { safe: snapshots[0].safe, next: snapshots[0].next };
  }
  const last = snapshots[snapshots.length - 1];
  if (t >= last.t) {
    return { safe: last.safe, next: last.next };
  }

  let lo = 0;
  let hi = snapshots.length - 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (snapshots[mid + 1].t <= t) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const a = snapshots[i];
  const b = snapshots[i + 1];
  const span = b.t - a.t;
  const u = span > 0 ? (t - a.t) / span : 0;
  const lerp = (v0, v1) => v0 + (v1 - v0) * u;

  const safe = {
    x: lerp(a.safe.x, b.safe.x),
    y: lerp(a.safe.y, b.safe.y),
    r: lerp(a.safe.r, b.safe.r),
  };

  let next = null;
  if (a.next && b.next && a.next.r > 0 && b.next.r > 0) {
    next = {
      x: lerp(a.next.x, b.next.x),
      y: lerp(a.next.y, b.next.y),
      r: lerp(a.next.r, b.next.r),
    };
  } else if (u < 0.5) {
    next = a.next && a.next.r > 0 ? a.next : null;
  } else {
    next = b.next && b.next.r > 0 ? b.next : null;
  }

  return { safe, next };
}
