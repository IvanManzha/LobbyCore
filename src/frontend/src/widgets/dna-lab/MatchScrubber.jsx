import React, { useRef, useEffect, useMemo } from "react";
import { aggregateByWeek } from "./utils/periodUtils";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Match Scrubber: track with match or week nodes, drag/scroll.
 */
export default function MatchScrubber({
  matches = [],
  matchHistory = [],
  selectedMatchId,
  onSelectMatch,
  selectedWeekKey,
  onSelectWeek,
  periodMode = "match",
  activeGeneKey,
  profileGenes = [],
}) {
  const { t } = useTranslation();
  const source = matchHistory.length ? matchHistory : matches;
  const list = source.slice(0, 30);
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  const weekData = useMemo(
    () => aggregateByWeek(source, activeGeneKey),
    [source, activeGeneKey]
  );

  const isWeekMode = periodMode === "week";
  const selectedId = isWeekMode ? selectedWeekKey : selectedMatchId;

  useEffect(() => {
    if (!selectedId || !activeRef.current || !scrollRef.current) return;
    activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedId]);

  const getDelta = (match, prevMatch) => {
    if (!match?.geneValues || !prevMatch?.geneValues || !activeGeneKey) return null;
    const v = match.geneValues[activeGeneKey];
    const p = prevMatch.geneValues[activeGeneKey];
    if (v == null || p == null) return null;
    const d = Number(v) - Number(p);
    return d !== 0 ? d : null;
  };

  if (isWeekMode) {
    return (
      <div className="matchScrubber">
        <div className="matchScrubberTrack" ref={scrollRef}>
          {weekData.map((w, i) => {
            const isSelected = w.weekKey === selectedWeekKey;
            const lowSample = w.matches.length < 2;

            return (
              <button
                key={w.weekKey}
                ref={isSelected ? activeRef : null}
                type="button"
                className={`matchScrubberNode matchScrubberWeekNode ${isSelected ? "isActive" : ""} ${lowSample ? "lowSample" : ""}`}
                onClick={() => onSelectWeek?.(w.weekKey)}
                title={`${t("dnaLab.weekLabel", { n: w.weekKey.split("-W")[1] || w.weekKey })} · ${w.matches.length} ${t("dnaMinimal.matches")} · median ${w.median != null ? Math.round(w.median) : "—"}`}
              >
                <span className="matchScrubberWeekLabel">{t("dnaLab.weekLabel", { n: w.weekKey.split("-W")[1] || w.weekKey })}</span>
                <span className="matchScrubberWeekCount">{w.matches.length}</span>
                {lowSample && <span className="matchScrubberLowBadge">{t("dnaLab.badgeLowShort")}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="matchScrubber">
      <div className="matchScrubberTrack" ref={scrollRef}>
        {list.map((m, i) => {
          const id = m.matchId || m.id;
          const isSelected = id === selectedMatchId;
          const prev = list[i - 1];
          const delta = getDelta(m, prev);
          const qualityDot = m.hasTelemetry !== false;

          return (
            <button
              key={id}
              ref={isSelected ? activeRef : null}
              type="button"
              className={`matchScrubberNode ${isSelected ? "isActive" : ""}`}
              onClick={() => onSelectMatch?.(id)}
            >
              <span className="matchScrubberNum">#{i + 1}</span>
              <span
                className={`matchScrubberQuality ${qualityDot ? "ok" : "partial"}`}
                title={qualityDot ? "OK" : "Partial"}
              />
              {delta != null && (
                <span className={`matchScrubberDelta ${delta >= 0 ? "up" : "down"}`}>
                  {delta > 0 ? "+" : ""}{delta}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
