import React, { useMemo } from "react";
import { aggregateByWeek } from "./utils/periodUtils";

/**
 * Find peak (top-1 rise) and drop (top-1 fall) indices.
 */
function findPeakAndDrop(points) {
  let peakIdx = -1;
  let dropIdx = -1;
  let bestGain = -Infinity;
  let worstDrop = Infinity;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]?.value;
    const curr = points[i]?.value;
    if (prev == null || curr == null) continue;
    const delta = curr - prev;
    if (delta > bestGain) {
      bestGain = delta;
      peakIdx = i;
    }
    if (delta < worstDrop) {
      worstDrop = delta;
      dropIdx = i;
    }
  }

  return { peakIdx, dropIdx };
}

/**
 * Gene Theater: horizontal ribbon, points per match or week, Peak/Drop marks.
 */
export default function GeneTheater({
  profile = {},
  activeGeneKey,
  selectedMatchId,
  selectedWeekKey,
  onSelectMatch,
  onSelectWeek,
  periodMode = "match",
}) {
  const matches = profile?.matchHistory?.length ? profile.matchHistory : profile?.matches ?? [];
  const profileGenes = profile?.genes ?? [];

  const pg = profileGenes.find((g) => g.key === activeGeneKey);
  const geneLabel = pg?.label ?? pg?.shortLabel ?? activeGeneKey ?? "Gene";

  const matchPoints = useMemo(() => {
    return matches.map((m, i) => {
      const id = m.matchId || m.id;
      const geneValues = m.geneValues ?? {};
      const v = geneValues[activeGeneKey];
      const value = v != null ? Math.max(0, Math.min(100, Number(v))) : null;
      return {
        id,
        value,
        index: i,
        order: m.order ?? i + 1,
        type: "match",
      };
    });
  }, [matches, activeGeneKey]);

  const weekPoints = useMemo(() => {
    return aggregateByWeek(matches, activeGeneKey);
  }, [matches, activeGeneKey]);

  const { peakIdx, dropIdx } = useMemo(
    () => findPeakAndDrop(matchPoints),
    [matchPoints]
  );

  const isWeekMode = periodMode === "week";
  const points = isWeekMode
    ? weekPoints.map((w, i) => ({
        id: w.weekKey,
        value: w.median,
        min: w.min,
        max: w.max,
        index: i,
        order: w.label,
        type: "week",
        matchIds: w.matchIds,
      }))
    : matchPoints;

  const selectedId = isWeekMode ? selectedWeekKey : selectedMatchId;
  const onSelect = isWeekMode ? onSelectWeek : onSelectMatch;

  return (
    <div className="geneTheater">
      <div className="geneTheaterHeader">
        <h3 className="geneTheaterTitle">{geneLabel}</h3>
      </div>
      <div className="geneTheaterTrack">
        {points.length === 0 ? (
          <div className="geneTheaterEmpty">No matches</div>
        ) : (
          <div className="geneTheaterRibbon">
            {points.map((p, i) => {
              const isSelected = p.id === selectedId;
              const hasValue = p.value != null;
              const isPeak = !isWeekMode && i === peakIdx;
              const isDrop = !isWeekMode && i === dropIdx;
              const xPct = points.length > 1 ? (p.index / (points.length - 1)) * 100 : 50;
              const yPct = hasValue ? 100 - p.value : 50;

              return (
                <button
                  key={p.id}
                  type="button"
                  className={`geneTheaterPoint ${isSelected ? "isActive" : ""} ${!hasValue ? "noValue" : ""} ${isPeak ? "isPeak" : ""} ${isDrop ? "isDrop" : ""}`}
                  style={{
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                  }}
                  onClick={() => onSelect?.(p.id)}
                  title={
                    isWeekMode
                      ? `${p.order} · median ${hasValue ? Math.round(p.value) : "—"}${p.min != null ? ` (${Math.round(p.min)}–${Math.round(p.max)})` : ""}`
                      : `Match #${p.order}${hasValue ? ` · ${Math.round(p.value)}` : ""}`
                  }
                >
                  {(isPeak || isDrop) && (
                    <span className={`geneTheaterMark ${isPeak ? "peak" : "drop"}`}>
                      {isPeak ? "▲" : "▼"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
