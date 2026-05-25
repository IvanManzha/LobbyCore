import React, { useMemo, useState, useRef, useEffect } from "react";
import GeneDock from "./GeneDock";
import DnaRadarChart from "./DnaRadarChart";
import MatchReel from "./MatchReel";
import DnaInsightCarousel from "./DnaInsightCarousel";
import { GENES } from "./mock/dnaMock";

const PLAY_INTERVAL_MS = 2500;

/**
 * Genome mode: Gene Dock, Radar (main), Match list; right: DnaInsightCarousel.
 */
export default function GenomeChartView({
  profile = {},
  dictionary = [],
  activeGeneKey,
  onSelectGene,
  selectedMatchId,
  onSelectMatch,
}) {
  const [hoveredGeneKey, setHoveredGeneKey] = useState(null);
  const [isReelPlaying, setIsReelPlaying] = useState(false);
  const playTimerRef = useRef(null);

  const profileGenes = profile.genes ?? [];
  const matches = profile.matches ?? [];
  const matchHistory = profile.matchHistory ?? [];
  const matchesList = matchHistory.length ? matchHistory : matches;

  useEffect(() => {
    if (!isReelPlaying || matchesList.length < 2) return;
    playTimerRef.current = setInterval(() => {
      const idx = matchesList.findIndex((m) => (m.matchId || m.id) === selectedMatchId);
      const nextIdx = idx < 0 ? 0 : (idx + 1) % matchesList.length;
      const next = matchesList[nextIdx];
      const nextId = next ? (next.matchId || next.id) : selectedMatchId;
      onSelectMatch(nextId);
    }, PLAY_INTERVAL_MS);
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isReelPlaying, matchesList, selectedMatchId, onSelectMatch]);
  const coverage = profile.coverage ?? {};
  const reasons = profile.reasons ?? {};

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

  const dictionaryEntry = useMemo(
    () => dictionary.find((d) => (d.id || d.key) === activeGeneKey),
    [dictionary, activeGeneKey]
  );
  const geneInProfile = profileGenes.find((g) => g.key === activeGeneKey);
  const geneValue = geneInProfile?.value ?? null;
  const geneTrend = geneInProfile?.trend ?? null;
  const confidence = profile.confidence ?? geneInProfile?.confidence;
  const activeGene = genes.find((g) => g.key === activeGeneKey);
  const geneLabel = activeGene?.label ?? geneInProfile?.label ?? activeGeneKey;

  return (
    <div className="dnaGenomeView">
      <div className="dnaGenomeChartRow">
        <div className="dnaGenomeChartBlock">
          <GeneDock
            genes={genes}
            profileGenes={profileGenes}
            activeKey={activeGeneKey}
            onSelect={onSelectGene}
            onGeneHover={setHoveredGeneKey}
          />
          <div className="dnaGenomeChartWrap dnaRadarStage">
            <DnaRadarChart
              profile={profile}
              selectedMatchId={selectedMatchId}
              highlightedGeneKey={hoveredGeneKey}
            />
          </div>
          <MatchReel
            matches={matches}
            matchHistory={matchHistory}
            selectedMatchId={selectedMatchId}
            onSelectMatch={onSelectMatch}
            onPlayPause={() => setIsReelPlaying((p) => !p)}
            isPlaying={isReelPlaying}
          />
        </div>
        <DnaInsightCarousel
          mode="gene"
          geneKey={activeGeneKey}
          genePayload={{
            geneValue,
            geneTrend,
            geneLabel,
            dictionaryEntry,
            confidence,
            reasons,
            coverage,
            profile,
          }}
        />
      </div>
    </div>
  );
}
