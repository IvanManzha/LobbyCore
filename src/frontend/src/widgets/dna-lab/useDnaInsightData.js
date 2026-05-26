import { useMemo } from "react";
import { aggregateByWeek } from "./utils/periodUtils";

/** Gene weights for DNA rating (7 genes, aligned with backend dnaEngine). */
export const GENE_WEIGHTS = {
  combat: 1.1,
  pressure: 1,
  conversion: 1.1,
  survival: 1.05,
  positioning: 1.05,
  recovery: 1,
  teamwork: 1.05,
};

/** Short labels for DNA Lab (7 genes). */
export const SHORT_LABELS = {
  combat: "COMB",
  pressure: "PRES",
  conversion: "CONV",
  survival: "SUR",
  positioning: "POS",
  recovery: "REC",
  teamwork: "TMW",
};

function stdDev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Spec: volatile ≥6, stable ≤3, else neutral (swingy). */
function stabilityLabel(std) {
  if (std <= 3) return "stable";
  if (std >= 6) return "volatile";
  return "swingy";
}

/** Gene level by value: LOW <35, MID 35-65, HIGH ≥65. */
export function geneLevelFromValue(value) {
  if (value == null || Number.isNaN(value)) return null;
  const v = Number(value);
  if (v < 35) return "low";
  if (v < 65) return "mid";
  return "high";
}

/**
 * Build prioritized insight candidates for Card 3 (gene). Max 3.
 * Order: (1) trend, (2) volatility, (3) peak or drop (stronger |delta|), (4) avg, (5) data quality.
 */
export function buildGeneInsightCandidates(payload) {
  const out = [];
  const add = (type, titleKey, textKey, params = {}) => out.push({ type, titleKey, textKey, params });

  if (payload.trendLabel) {
    if (payload.trendLabel === "up") add("trend", "insightTrendUp", "insightTrendUpText", { n: payload.trendN ?? 0 });
    else if (payload.trendLabel === "down") add("trend", "insightTrendDown", "insightTrendDownText", { n: payload.trendN ?? 0 });
    else add("trend", "insightStable", "insightStableText");
  }

  if (payload.stability === "volatile") add("volatility", "insightVolatile", "insightVolatileText");
  else if (payload.stability === "stable") add("volatility", "insightRovno", "insightRovnoText");

  const peakStrong = payload.peakDelta != null && payload.peakDelta >= 4;
  const dropStrong = payload.dropDelta != null && payload.dropDelta <= -4;
  if (peakStrong || dropStrong) {
    const peakAbs = Math.abs(payload.peakDelta ?? 0);
    const dropAbs = Math.abs(payload.dropDelta ?? 0);
    if (peakStrong && (peakAbs >= dropAbs || !dropStrong))
      add("peak", "insightBestGrowth", "insightPeakShort", { delta: payload.peakDelta });
    else if (dropStrong)
      add("drop", "insightDrop", "insightDropShort", { delta: payload.dropDelta });
  }

  if (payload.aboveSeasonAvg && payload.diffFromAvg != null)
    add("avg", "insightAboveAvg", "insightAboveAvgText", { diff: payload.diffFromAvg });
  else if (payload.belowSeasonAvg && payload.diffFromAvg != null)
    add("avg", "insightBelowAvg", "insightBelowAvgText", { diff: payload.diffFromAvg });

  if (payload.coveragePct != null && payload.coveragePct < 70)
    add("data", "insightDataPartial", "insightDataPartialText");

  return out.slice(0, 3);
}

/**
 * Computed insight data for gene mode: insights, sparkline, stability, coverage, trend line text.
 * @param {{ activeGeneKey: string|null, profile: object, coverage: object, reasons: object }} params
 */
export function useGeneInsightData({ activeGeneKey, profile = {}, coverage = {}, reasons = {} }) {
  const matchesList = profile?.matchHistory?.length ? profile.matchHistory : profile?.matches ?? [];
  const matchesTotal = coverage?.matchesTotal ?? 0;
  const telemetryMatches = coverage?.telemetryMatches ?? 0;

  const insights = useMemo(() => {
    const list = [];
    if (!activeGeneKey || !matchesList.length) return list;
    const values = matchesList
      .map((m) => m.geneValues?.[activeGeneKey])
      .filter((v) => v != null)
      .map((v) => Math.max(0, Math.min(100, Number(v))));
    if (values.length < 2) return list;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);

    if (std < 6) list.push({ type: "consistency", title: "Consistent", text: "Values are stable across matches." });
    else if (std >= 14) list.push({ type: "consistency", title: "Inconsistent", text: "Big swings between matches." });

    let maxDelta = -Infinity;
    let maxDeltaIdx = -1;
    for (let i = 1; i < values.length; i++) {
      const d = values[i] - values[i - 1];
      if (d > maxDelta) {
        maxDelta = d;
        maxDeltaIdx = i;
      }
    }
    if (maxDelta > 10 && maxDeltaIdx >= 0) {
      list.push({
        type: "momentum",
        title: "Best growth",
        text: "Notable growth",
        matchIndex: maxDeltaIdx,
      });
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const lastVal = values[values.length - 1] ?? 0;
    if (lastVal > avg + 5) list.push({ type: "signature", title: "Trending up", text: "Strong finish this season." });
    else if (lastVal < avg - 5) list.push({ type: "weak_spot", title: "Trending down", text: "Finishing below season average." });

    return list.slice(0, 3);
  }, [activeGeneKey, matchesList]);

  const aggregateGeneValue = useMemo(() => {
    const g = profile?.genes?.find((x) => x.key === activeGeneKey);
    const v = g?.value;
    return v != null && !Number.isNaN(v) ? Math.max(0, Math.min(100, Number(v))) : null;
  }, [profile?.genes, activeGeneKey]);

  const sparklineData = useMemo(() => {
    if (!activeGeneKey || !matchesList.length) return [];
    const fallback = aggregateGeneValue ?? 50;
    return matchesList.map((m, i) => {
      const v = m.geneValues?.[activeGeneKey];
      const num = v != null ? Math.max(0, Math.min(100, Number(v))) : null;
      return { index: i, value: num ?? fallback, name: `#${i + 1}` };
    });
  }, [activeGeneKey, matchesList, aggregateGeneValue]);

  /** Peak/Drop by deltas (spec): argmax/argmin of history[i]-history[i-1]. */
  const { peakMatchIndex, dropMatchIndex, peakDelta, dropDelta } = useMemo(() => {
    if (!sparklineData.length || sparklineData.length < 2) {
      return { peakMatchIndex: null, dropMatchIndex: null, peakDelta: null, dropDelta: null };
    }
    const vals = sparklineData.map((d) => Number(d.value));
    let maxDelta = -Infinity;
    let minDelta = Infinity;
    let peakIdx = 0;
    let dropIdx = 0;
    for (let i = 1; i < vals.length; i++) {
      const d = vals[i] - vals[i - 1];
      if (d > maxDelta) {
        maxDelta = d;
        peakIdx = i;
      }
      if (d < minDelta) {
        minDelta = d;
        dropIdx = i;
      }
    }
    return {
      peakMatchIndex: peakIdx + 1,
      dropMatchIndex: dropIdx + 1,
      peakDelta: maxDelta,
      dropDelta: minDelta,
    };
  }, [sparklineData]);

  /** Trend: N = min(5, len), slope; gene threshold ±1.0. */
  const { trendLabel, trendN } = useMemo(() => {
    if (!sparklineData.length || sparklineData.length < 2) return { trendLabel: "stable", trendN: 0 };
    const N = Math.min(5, sparklineData.length);
    const slice = sparklineData.slice(-N);
    const first = Number(slice[0]?.value ?? 0);
    const last = Number(slice[slice.length - 1]?.value ?? 0);
    const slope = (last - first) / Math.max(1, slice.length - 1);
    let label = "stable";
    if (slope > 1.0) label = "up";
    else if (slope < -1.0) label = "down";
    return { trendLabel: label, trendN: N };
  }, [sparklineData]);

  const stability = useMemo(() => {
    if (!activeGeneKey || !matchesList.length) return null;
    const values = matchesList
      .map((m) => m.geneValues?.[activeGeneKey])
      .filter((v) => v != null)
      .map((v) => Math.max(0, Math.min(100, Number(v))));
    if (values.length < 2) return null;
    return stabilityLabel(stdDev(values));
  }, [activeGeneKey, matchesList]);

  const coveragePct = useMemo(() => {
    const total = matchesTotal || 0;
    const telemetry = telemetryMatches ?? 0;
    if (total === 0) return 0;
    return Math.min(100, Math.round((telemetry / Math.max(8, total)) * 100));
  }, [matchesTotal, telemetryMatches]);

  const geneLevel = useMemo(
    () => geneLevelFromValue(aggregateGeneValue),
    [aggregateGeneValue]
  );

  /** Below/above season avg: diffFromAvg = current - seasonAvg, ±3. */
  const { diffFromAvg, aboveSeasonAvg, belowSeasonAvg } = useMemo(() => {
    if (!sparklineData.length) return { diffFromAvg: null, aboveSeasonAvg: false, belowSeasonAvg: false };
    const vals = sparklineData.map((d) => Number(d.value));
    const seasonAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const current = vals[vals.length - 1];
    const diff = current - seasonAvg;
    return {
      diffFromAvg: Math.round(diff * 10) / 10,
      aboveSeasonAvg: diff >= 3,
      belowSeasonAvg: diff <= -3,
    };
  }, [sparklineData]);

  /** Micro-Δ: sum of deltas over last 5 matches. */
  const microDelta5 = useMemo(() => {
    if (!sparklineData.length || sparklineData.length < 2) return null;
    const vals = sparklineData.map((d) => Number(d.value));
    const deltas = [];
    for (let i = 1; i < vals.length; i++) deltas.push(vals[i] - vals[i - 1]);
    const last5 = deltas.slice(-5);
    return last5.reduce((a, b) => a + b, 0);
  }, [sparklineData]);

  /** Delta last match (for "без изменений" when |delta| < 0.5). */
  const geneDeltaLast = useMemo(() => {
    if (!sparklineData.length || sparklineData.length < 2) return null;
    const vals = sparklineData.map((d) => Number(d.value));
    return vals[vals.length - 1] - vals[vals.length - 2];
  }, [sparklineData]);

  /** Chart legend: max value, min value, range. */
  const { chartMaxValue, chartMinValue, chartRange } = useMemo(() => {
    if (!sparklineData.length) return { chartMaxValue: null, chartMinValue: null, chartRange: null };
    const vals = sparklineData.map((d) => Number(d.value));
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const maxIdx = vals.indexOf(maxV) + 1;
    const minIdx = vals.indexOf(minV) + 1;
    return {
      chartMaxValue: { value: maxV, matchIndex: maxIdx },
      chartMinValue: { value: minV, matchIndex: minIdx },
      chartRange: maxV - minV,
    };
  }, [sparklineData]);

  /** One-line trend summary for Card 2 (e.g. "Growth last 3 matches", "Peak at match #4", "Below season average"). */
  const trendLineText = useMemo(() => {
    if (!insights.length) return null;
    const momentum = insights.find((i) => i.type === "momentum");
    if (momentum) return momentum.text;
    const sig = insights.find((i) => i.type === "signature");
    if (sig) return "Strong finish this season.";
    const weak = insights.find((i) => i.type === "weak_spot");
    if (weak) return "Below season average.";
    const cons = insights.find((i) => i.type === "consistency");
    if (cons) return cons.text;
    return null;
  }, [insights]);

  const weekData = useMemo(
    () => aggregateByWeek(matchesList.length ? matchesList : [], activeGeneKey),
    [matchesList, activeGeneKey]
  );

  return {
    insights,
    sparklineData,
    stability,
    coveragePct,
    trendLineText,
    weekData,
    matchesList,
    matchesTotal,
    telemetryMatches,
    hasLowData: matchesTotal < 3,
    peakMatchIndex,
    dropMatchIndex,
    peakDelta,
    dropDelta,
    trendLabel,
    trendN,
    geneLevel,
    diffFromAvg,
    aboveSeasonAvg,
    belowSeasonAvg,
    microDelta5,
    geneDeltaLast,
    chartMaxValue,
    chartMinValue,
    chartRange,
  };
}

/**
 * Computed insight data for core mode: contribution list, top/weak gene, trend text, sparkline.
 * @param {{ profile: object, genes: Array, profileGenes: Array }} params
 */
export function useCoreInsightData({ profile = {}, genes = [], profileGenes = [] }) {
  const matchHistory = profile?.matchHistory ?? profile?.matches ?? [];
  const coverage = profile?.coverage ?? {};
  const matchesTotal = coverage?.matchesTotal ?? matchHistory.length ?? 0;
  const telemetryMatches = coverage?.telemetryMatches ?? matchesTotal;
  const isPartialCoverage = matchesTotal > 0 && telemetryMatches < matchesTotal;

  const geneKeys = useMemo(
    () => (genes.length >= 7 ? genes.map((g) => g.key) : Object.keys(GENE_WEIGHTS)),
    [genes]
  );

  const { topGeneKey, weakGeneKey, contributionList } = useMemo(() => {
    const withVal = (profileGenes || []).filter((g) => g.value != null && !Number.isNaN(g.value));
    const sorted = withVal.length ? [...withVal].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)) : [];
    const top = sorted[0]?.key ?? null;
    const weak = sorted[sorted.length - 1]?.key ?? null;
    const list = geneKeys.map((key) => {
      const pg = (profileGenes || []).find((g) => g.key === key);
      const w = GENE_WEIGHTS[key] ?? 1;
      const v = typeof pg?.value === "number" ? Math.max(0, Math.min(100, pg.value)) : 50;
      return { key, value: v, weight: w, contribution: v * w };
    });
    const totalContrib = list.reduce((s, x) => s + x.contribution, 0);
    list.forEach((x) => {
      x.sharePct = totalContrib > 0 ? (x.contribution / totalContrib) * 100 : 100 / list.length;
    });
    return { topGeneKey: top, weakGeneKey: weak, contributionList: list };
  }, [profileGenes, geneKeys]);

  const coreAggregateValue = useMemo(() => {
    let weightedSum = 0;
    geneKeys.forEach((key) => {
      const w = GENE_WEIGHTS[key] ?? 1;
      const pg = (profileGenes || []).find((g) => g.key === key);
      const v = typeof pg?.value === "number" ? pg.value : null;
      if (v != null && !Number.isNaN(v)) {
        weightedSum += Math.max(0, Math.min(100, v)) * w;
      }
    });
    return Math.round(weightedSum);
  }, [profileGenes, geneKeys]);

  const sparklineData = useMemo(() => {
    if (!matchHistory.length) return [];
    const fallback = coreAggregateValue > 0 ? coreAggregateValue : 50 * geneKeys.reduce((s, k) => s + (GENE_WEIGHTS[k] ?? 1), 0);
    const raw = matchHistory.map((m, i) => {
      const gs = m.geneValues || {};
      let weightedSum = 0;
      let hasAny = false;
      geneKeys.forEach((key) => {
        const w = GENE_WEIGHTS[key] ?? 1;
        const v = gs[key];
        if (typeof v === "number" && !Number.isNaN(v)) {
          weightedSum += Math.max(0, Math.min(100, v)) * w;
          hasAny = true;
        }
      });
      const value = hasAny ? Math.round(weightedSum) : fallback;
      return { index: i, value, name: `#${i + 1}` };
    });
    const coreScoreNum = profile?.coreScore != null && !Number.isNaN(profile.coreScore) ? Number(profile.coreScore) : null;
    if (coreScoreNum != null && raw.length > 0) {
      const lastRaw = raw[raw.length - 1].value;
      const scale = lastRaw > 0 ? coreScoreNum / lastRaw : 1;
      return raw.map((d) => ({ ...d, value: Math.round(d.value * scale) }));
    }
    return raw;
  }, [matchHistory, geneKeys, coreAggregateValue, profile?.coreScore]);

  const sparklineYDomain = useMemo(() => {
    if (!sparklineData.length) return [0, 100];
    const coreScoreNum = profile?.coreScore != null && !Number.isNaN(profile.coreScore) ? Number(profile.coreScore) : null;
    const max = Math.max(...sparklineData.map((d) => d.value), 1);
    const cap = coreScoreNum != null ? Math.max(max, Math.ceil(coreScoreNum * 1.1)) : Math.ceil(max * 1.15);
    return [0, cap];
  }, [sparklineData, profile?.coreScore]);

  /** Core peak/drop by deltas; threshold ±40 for showing markers. */
  const { peakMatchIndex, dropMatchIndex, peakDelta, dropDelta } = useMemo(() => {
    if (!sparklineData.length || sparklineData.length < 2) {
      return { peakMatchIndex: null, dropMatchIndex: null, peakDelta: null, dropDelta: null };
    }
    const vals = sparklineData.map((d) => Number(d.value));
    let maxDelta = -Infinity;
    let minDelta = Infinity;
    let peakIdx = 0;
    let dropIdx = 0;
    for (let i = 1; i < vals.length; i++) {
      const d = vals[i] - vals[i - 1];
      if (d > maxDelta) {
        maxDelta = d;
        peakIdx = i;
      }
      if (d < minDelta) {
        minDelta = d;
        dropIdx = i;
      }
    }
    return {
      peakMatchIndex: peakIdx + 1,
      dropMatchIndex: dropIdx + 1,
      peakDelta: maxDelta,
      dropDelta: minDelta,
    };
  }, [sparklineData]);

  /** Core trend: N = min(5, len), slope; threshold ±15. */
  const { trendIndicator, trendN } = useMemo(() => {
    if (!sparklineData.length || sparklineData.length < 2) {
      return { trendIndicator: "stable", trendN: 0 };
    }
    const N = Math.min(5, sparklineData.length);
    const slice = sparklineData.slice(-N);
    const first = Number(slice[0]?.value ?? 0);
    const last = Number(slice[slice.length - 1]?.value ?? 0);
    const slope = (last - first) / Math.max(1, slice.length - 1);
    let indicator = "stable";
    if (slope > 15) indicator = "up";
    else if (slope < -15) indicator = "down";
    return { trendIndicator: indicator, trendN: N };
  }, [sparklineData]);

  /** Core chart legend. */
  const { chartMaxValue, chartMinValue, chartRange } = useMemo(() => {
    if (!sparklineData.length) return { chartMaxValue: null, chartMinValue: null, chartRange: null };
    const vals = sparklineData.map((d) => Number(d.value));
    const maxV = Math.max(...vals);
    const minV = Math.min(...vals);
    const maxIdx = vals.indexOf(maxV) + 1;
    const minIdx = vals.indexOf(minV) + 1;
    return {
      chartMaxValue: { value: maxV, matchIndex: maxIdx },
      chartMinValue: { value: minV, matchIndex: minIdx },
      chartRange: maxV - minV,
    };
  }, [sparklineData]);

  const topLabel = topGeneKey ? (SHORT_LABELS[topGeneKey] || genes.find((g) => g.key === topGeneKey)?.label || topGeneKey) : "—";
  const weakLabel = weakGeneKey ? (SHORT_LABELS[weakGeneKey] || genes.find((g) => g.key === weakGeneKey)?.label || weakGeneKey) : "—";

  const coreScore = profile?.coreScore;
  const coreDisplay = coreScore != null && !Number.isNaN(coreScore) ? Math.round(coreScore) : "—";

  return {
    coreDisplay,
    topLabel,
    weakLabel,
    topGeneKey,
    weakGeneKey,
    contributionList,
    trendIndicator,
    trendN,
    sparklineData,
    sparklineYDomain,
    matchHistory,
    matchesTotal,
    telemetryMatches,
    isPartialCoverage,
    peakMatchIndex,
    dropMatchIndex,
    peakDelta,
    dropDelta,
    chartMaxValue,
    chartMinValue,
    chartRange,
  };
}
