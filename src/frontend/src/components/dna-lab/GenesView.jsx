import React, { useMemo, useState, useEffect } from "react";
import GeneGarden from "./GeneGarden";
import GeneTheater from "./GeneTheater";
import MatchScrubber from "./MatchScrubber";
import DnaInsightCarousel from "./DnaInsightCarousel";
import DnaMomentsStrip from "./DnaMomentsStrip";
import { aggregateByWeek } from "./utils/periodUtils";
import { GENES } from "./mock/dnaMock";

/**
 * Sprint 2: Gene Garden + Gene Theater + Match Scrubber + Inspector (hidden by default).
 */
export default function GenesView({
  profile = {},
  dictionary = [],
  activeGeneKey,
  onSelectGene,
  selectedMatchId,
  onSelectMatch,
  inspectorOpen: inspectorOpenProp,
  onToggleInspector,
}) {
  const [inspectorOpenLocal, setInspectorOpenLocal] = useState(false);
  const inspectorOpen = inspectorOpenProp ?? inspectorOpenLocal;
  const handleToggleInspector = onToggleInspector ?? (() => setInspectorOpenLocal((o) => !o));
  const [periodMode, setPeriodMode] = useState("match");
  const [selectedWeekKey, setSelectedWeekKey] = useState(null);

  const profileGenes = profile.genes ?? [];
  const matches = profile.matches ?? [];
  const matchHistory = profile.matchHistory ?? [];

  const weekData = useMemo(
    () => aggregateByWeek(matchHistory.length ? matchHistory : matches, activeGeneKey),
    [matchHistory, matches, activeGeneKey]
  );

  useEffect(() => {
    if (periodMode === "week" && weekData.length > 0 && !selectedWeekKey) {
      setSelectedWeekKey(weekData[0].weekKey);
    }
  }, [periodMode, weekData, selectedWeekKey]);

  const genes = useMemo(() => {
    return GENES.map((g) => {
      const dict = dictionary.find((d) => (d.id || d.key) === g.key);
      const pg = profileGenes.find((x) => x.key === g.key);
      return {
        ...g,
        label: pg?.label ?? dict?.label ?? dict?.name ?? g.label,
        shortLabel: pg?.shortLabel ?? dict?.shortLabel ?? g.label?.slice(0, 4) ?? g.key?.slice(0, 4),
      };
    });
  }, [dictionary, profileGenes]);

  const geneInProfile = profileGenes.find((g) => g.key === activeGeneKey);
  const geneValue = geneInProfile?.value ?? null;
  const geneTrend = geneInProfile?.trend ?? null;
  const confidence = profile.confidence ?? geneInProfile?.confidence;
  const activeGene = genes.find((g) => g.key === activeGeneKey);
  const geneLabel = activeGene?.label ?? geneInProfile?.label ?? activeGeneKey;
  const dictionaryEntry = useMemo(
    () => dictionary.find((d) => (d.id || d.key) === activeGeneKey),
    [dictionary, activeGeneKey]
  );

  const { topGeneKey, bottomGeneKey } = useMemo(() => {
    const withValues = profileGenes.filter((g) => g.value != null && !Number.isNaN(g.value));
    if (withValues.length < 2) return { topGeneKey: null, bottomGeneKey: null };
    const sorted = [...withValues].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return {
      topGeneKey: sorted[0]?.key ?? null,
      bottomGeneKey: sorted[sorted.length - 1]?.key ?? null,
    };
  }, [profileGenes]);

  return (
    <div className={`genesView ${inspectorOpen ? "hasInspector" : ""}`}>
      <div className="genesViewMain">
        <div className="genesViewLeft">
          <GeneGarden
            genes={genes}
            profileGenes={profileGenes}
            activeKey={activeGeneKey}
            onSelectGene={onSelectGene}
            topGeneKey={topGeneKey}
            bottomGeneKey={bottomGeneKey}
          />
        </div>
        <div className="genesViewCenter">
          <div className="genesViewTheaterHeader">
            <h3 className="genesViewTheaterTitle">{geneLabel}</h3>
            {profile?.coverage && (
              <span
                className={`genesViewCoverageBadge ${
                  (profile.coverage.telemetryMatches ?? 0) >= (profile.coverage.matchesTotal ?? 0)
                    ? "ok"
                    : "partial"
                }`}
                title={
                  (profile.coverage.telemetryMatches ?? 0) >= (profile.coverage.matchesTotal ?? 0)
                    ? "Telemetry OK"
                    : "Partial coverage"
                }
              >
                {(profile.coverage.telemetryMatches ?? 0) >= (profile.coverage.matchesTotal ?? 0)
                  ? "OK"
                  : "Partial"}
              </span>
            )}
            <div className="genesViewTheaterActions">
              <div className="genesViewPeriodToggle">
                <button
                  type="button"
                  className={`genesViewPeriodBtn ${periodMode === "match" ? "isActive" : ""}`}
                  onClick={() => setPeriodMode("match")}
                >
                  Match
                </button>
                <button
                  type="button"
                  className={`genesViewPeriodBtn ${periodMode === "week" ? "isActive" : ""}`}
                  onClick={() => setPeriodMode("week")}
                >
                  Week
                </button>
              </div>
              <button
                type="button"
                className="genesViewDetailsBtn"
                onClick={handleToggleInspector}
              >
                Details
              </button>
            </div>
          </div>
          <GeneTheater
            profile={profile}
            activeGeneKey={activeGeneKey}
            selectedMatchId={selectedMatchId}
            selectedWeekKey={selectedWeekKey}
            onSelectMatch={onSelectMatch}
            onSelectWeek={setSelectedWeekKey}
            periodMode={periodMode}
          />
          <MatchScrubber
            matches={matches}
            matchHistory={matchHistory}
            selectedMatchId={selectedMatchId}
            onSelectMatch={onSelectMatch}
            selectedWeekKey={selectedWeekKey}
            onSelectWeek={setSelectedWeekKey}
            periodMode={periodMode}
            activeGeneKey={activeGeneKey}
            profileGenes={profileGenes}
          />
          <DnaMomentsStrip
            profile={profile}
            activeGeneKey={activeGeneKey}
            onJumpToMatch={(matchId) => onSelectMatch?.(matchId)}
          />
        </div>
        {inspectorOpen && (
          <div className="genesViewInspector">
            <DnaInsightCarousel
              mode="gene"
              geneKey={activeGeneKey}
              genePayload={{
                geneValue,
                geneTrend,
                geneLabel,
                dictionaryEntry,
                confidence,
                reasons: profile.reasons ?? {},
                coverage: profile.coverage ?? {},
                profile,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
