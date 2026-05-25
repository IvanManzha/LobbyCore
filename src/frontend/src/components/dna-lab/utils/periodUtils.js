/**
 * Period aggregation: Match vs Week, Month, Year.
 * Week = group by ISO week, compute median + min/max.
 */

export const TIME_SLICE_YEAR = "YEAR";
export const TIME_SLICE_MONTH = "MONTH";
export const TIME_SLICE_WEEK = "WEEK";

const GENE_KEYS = [
  "combat", "pressure", "conversion", "survival",
  "positioning", "recovery", "teamwork",
];

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Get YYYY from date string or Date.
 */
export function getYearKey(dateStr) {
  if (!dateStr) return null;
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return String(d.getFullYear());
}

/**
 * Get YYYY-MM from date string or Date.
 */
export function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get ISO week number from date string or Date.
 */
export function getWeekKey(dateStr) {
  if (!dateStr) return null;
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - start) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Group matches by week, compute median/min/max for each gene.
 * @param {Array} matches - matchHistory or matches
 * @param {string} geneKey
 * @returns {Array<{ weekKey, label, median, min, max, matches, matchIds }>}
 */
export function aggregateByWeek(matches, geneKey) {
  const byWeek = new Map();

  for (const m of matches || []) {
    const dateStr = m.startedAt ?? m.dateISO ?? m.date;
    const weekKey = getWeekKey(dateStr) ?? `unknown-${m.matchId || m.id}`;

    if (!byWeek.has(weekKey)) {
      byWeek.set(weekKey, { weekKey, matches: [], values: [] });
    }
    const group = byWeek.get(weekKey);
    const v = m.geneValues?.[geneKey];
    if (v != null) {
      const num = Math.max(0, Math.min(100, Number(v)));
      group.values.push(num);
    }
    group.matches.push(m);
  }

  const result = [];
  for (const [weekKey, group] of byWeek) {
    const values = group.values;
    const m = group.matches;
    result.push({
      weekKey,
      label: `Week ${weekKey.split("-W")[1] || weekKey}`,
      median: values.length ? median(values) : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      matches: m,
      matchIds: m.map((x) => x.matchId || x.id),
    });
  }

  result.sort((a, b) => String(a.weekKey).localeCompare(b.weekKey));
  return result;
}

/**
 * Group matches by month, compute median for each gene.
 * @param {Array} matches - matchHistory or matches
 * @param {string} geneKey
 * @returns {Array<{ monthKey, median, matches }>}
 */
export function aggregateByMonth(matches, geneKey) {
  const byMonth = new Map();

  for (const m of matches || []) {
    const dateStr = m.startedAt ?? m.dateISO ?? m.date;
    const monthKey = getMonthKey(dateStr) ?? `unknown-${m.matchId || m.id}`;

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { monthKey, matches: [], values: [] });
    }
    const group = byMonth.get(monthKey);
    const v = m.geneValues?.[geneKey];
    if (v != null) {
      const num = Math.max(0, Math.min(100, Number(v)));
      group.values.push(num);
    }
    group.matches.push(m);
  }

  const result = [];
  for (const [monthKey, group] of byMonth) {
    const values = group.values;
    result.push({
      monthKey,
      median: values.length ? median(values) : null,
      matches: group.matches,
    });
  }

  result.sort((a, b) => String(a.monthKey).localeCompare(b.monthKey));
  return result;
}

/**
 * Group matches by year, compute median for each gene.
 * @param {Array} matches - matchHistory or matches
 * @param {string} geneKey
 * @returns {Array<{ yearKey, median, matches }>}
 */
export function aggregateByYear(matches, geneKey) {
  const byYear = new Map();

  for (const m of matches || []) {
    const dateStr = m.startedAt ?? m.dateISO ?? m.date;
    const yearKey = getYearKey(dateStr) ?? `unknown-${m.matchId || m.id}`;

    if (!byYear.has(yearKey)) {
      byYear.set(yearKey, { yearKey, matches: [], values: [] });
    }
    const group = byYear.get(yearKey);
    const v = m.geneValues?.[geneKey];
    if (v != null) {
      const num = Math.max(0, Math.min(100, Number(v)));
      group.values.push(num);
    }
    group.matches.push(m);
  }

  const result = [];
  for (const [yearKey, group] of byYear) {
    const values = group.values;
    result.push({
      yearKey,
      median: values.length ? median(values) : null,
      matches: group.matches,
    });
  }

  result.sort((a, b) => String(a.yearKey).localeCompare(b.yearKey));
  return result;
}

/**
 * Get matches in the most recent period for the given time slice.
 * @param {Array} matches
 * @param {string} timeSlice
 * @returns {Array} Filtered matches
 */
function filterToRecentPeriod(matches, timeSlice) {
  const list = (matches || []).slice();
  if (list.length === 0) return [];

  const withDate = list
    .map((m) => {
      const d = m.startedAt ?? m.dateISO ?? m.date;
      return { m, date: d ? new Date(d) : null };
    })
    .filter((x) => x.date && !isNaN(x.date.getTime()));

  if (withDate.length === 0) return list;

  const latest = new Date(Math.max(...withDate.map((x) => x.date.getTime())));

  let keyFn;
  if (timeSlice === TIME_SLICE_YEAR) {
    keyFn = (d) => getYearKey(d);
  } else if (timeSlice === TIME_SLICE_MONTH) {
    keyFn = (d) => getMonthKey(d);
  } else {
    keyFn = (d) => getWeekKey(d);
  }

  const targetKey = keyFn(latest);
  return withDate.filter((x) => keyFn(x.date) === targetKey).map((x) => x.m);
}

/**
 * Aggregate genes by time slice (YEAR | MONTH | WEEK). Returns 8 values as object { geneKey: value }.
 * Uses median per gene over matches in the period.
 * @param {Array} matches - matchHistory or matches
 * @param {string} timeSlice - TIME_SLICE_YEAR | TIME_SLICE_MONTH | TIME_SLICE_WEEK
 * @returns {{ values: Object, matchCount: number, lowSample: boolean }}
 */
export function aggregateByTimeSlice(matches, timeSlice) {
  const matchList = matches || [];
  const filtered =
    timeSlice === TIME_SLICE_YEAR ? matchList : filterToRecentPeriod(matchList, timeSlice);

  const result = {};
  const LOW_SAMPLE_THRESHOLD = 3;

  for (const geneKey of GENE_KEYS) {
    const values = (filtered || [])
      .map((m) => m.geneValues?.[geneKey])
      .filter((v) => v != null)
      .map((v) => Math.max(0, Math.min(100, Number(v))));

    result[geneKey] = values.length > 0 ? Math.round(median(values)) : null;
  }

  const matchCount = filtered.length;
  const lowSample = matchCount < LOW_SAMPLE_THRESHOLD;

  return {
    values: result,
    matchCount,
    lowSample,
  };
}

/**
 * Compute stability (variance) from values. Returns "stable" | "swingy" | "volatile".
 */
export function getStabilityLabel(values) {
  if (!values || values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std < 6) return "stable";
  if (std < 14) return "swingy";
  return "volatile";
}
