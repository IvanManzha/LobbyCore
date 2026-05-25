import React, { useMemo } from "react";
import { aggregateByWeek } from "./utils/periodUtils";

/**
 * Dual Gene Theater: two lines (A orange, B cold).
 */
export default function DualGeneTheater({
  profileA = {},
  profileB = {},
  activeGeneKey,
  selectedMatchId,
  selectedWeekKey,
  onSelectMatch,
  onSelectWeek,
  periodMode = "match",
}) {
  const matchesA = profileA?.matchHistory?.length ? profileA.matchHistory : profileA?.matches ?? [];
  const matchesB = profileB?.matchHistory?.length ? profileB.matchHistory : profileB?.matches ?? [];

  const pointsA = useMemo(() => {
    return matchesA.map((m, i) => {
      const id = m.matchId || m.id;
      const v = m.geneValues?.[activeGeneKey];
      const value = v != null ? Math.max(0, Math.min(100, Number(v))) : null;
      return { id, value, index: i };
    });
  }, [matchesA, activeGeneKey]);

  const pointsB = useMemo(() => {
    return matchesB.map((m, i) => {
      const id = m.matchId || m.id;
      const v = m.geneValues?.[activeGeneKey];
      const value = v != null ? Math.max(0, Math.min(100, Number(v))) : null;
      return { id, value, index: i };
    });
  }, [matchesB, activeGeneKey]);

  const weekDataA = useMemo(() => aggregateByWeek(matchesA, activeGeneKey), [matchesA, activeGeneKey]);
  const weekDataB = useMemo(() => aggregateByWeek(matchesB, activeGeneKey), [matchesB, activeGeneKey]);

  const isWeekMode = periodMode === "week";

  if (isWeekMode) {
    const weeksA = weekDataA;
    const weeksB = weekDataB;
    const allWeeks = [...new Set([...weeksA.map((w) => w.weekKey), ...weeksB.map((w) => w.weekKey)])].sort();

    return (
      <div className="geneTheater geneTheaterDual">
        <div className="geneTheaterTrack">
          <div className="geneTheaterRibbon">
            {allWeeks.map((wk, i) => {
              const wA = weeksA.find((w) => w.weekKey === wk);
              const wB = weeksB.find((w) => w.weekKey === wk);
              const medianA = wA?.median ?? null;
              const medianB = wB?.median ?? null;
              const xPct = allWeeks.length > 1 ? (i / (allWeeks.length - 1)) * 100 : 50;
              const isSelected = wk === selectedWeekKey;

              return (
                <button
                  key={wk}
                  type="button"
                  className={`geneTheaterPointDual ${isSelected ? "isActive" : ""}`}
                  style={{ left: `${xPct}%` }}
                  onClick={() => onSelectWeek?.(wk)}
                >
                  {medianA != null && (
                    <span
                      className="geneTheaterPointA"
                      style={{ bottom: `${medianA}%` }}
                    />
                  )}
                  {medianB != null && (
                    <span
                      className="geneTheaterPointB"
                      style={{ bottom: `${medianB}%` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const maxLen = Math.max(pointsA.length, pointsB.length, 1);
  const matchIds = matchesA.map((m) => m.matchId || m.id);

  return (
    <div className="geneTheater geneTheaterDual">
      <div className="geneTheaterTrack">
        <div className="geneTheaterRibbon geneTheaterRibbonDual">
          {pointsA.map((p, i) => {
            const pB = pointsB.find((pb) => pb.id === p.id) ?? pointsB[i];
            const valA = p.value;
            const valB = pB?.value;
            const xPct = pointsA.length > 1 ? (i / (pointsA.length - 1)) * 100 : 50;
            const isSelected = p.id === selectedMatchId;
            const yA = valA != null ? 100 - valA : 50;
            const yB = valB != null ? 100 - valB : 50;

            return (
              <div
                key={p.id}
                className={`geneTheaterDualPointWrap ${isSelected ? "isActive" : ""}`}
                style={{ left: `${xPct}%` }}
              >
                {valA != null && (
                  <button
                    type="button"
                    className="geneTheaterPoint geneTheaterPointA"
                    style={{ top: `${yA}%` }}
                    onClick={() => onSelectMatch?.(p.id)}
                    title={`A: ${Math.round(valA)}`}
                  />
                )}
                {valB != null && (
                  <button
                    type="button"
                    className="geneTheaterPoint geneTheaterPointB"
                    style={{ top: `${yB}%` }}
                    onClick={() => onSelectMatch?.(p.id)}
                    title={`B: ${Math.round(valB)}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
