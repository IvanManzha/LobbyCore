import React, { useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTranslation } from "@/contexts/LanguageContext";

const GENE_KEYS = [
  "combat", "pressure", "conversion", "survival",
  "positioning", "recovery", "teamwork",
];

/**
 * Build radar data: one row per gene with seasonAvg, currentMatch, delta (for tooltip).
 */
function buildRadarData(profileGenes, selectedMatch, matchesList, geneLabels) {
  return GENE_KEYS.map((key) => {
    const pg = profileGenes.find((g) => g.key === key);
    const seasonAvg = pg?.value != null ? Math.max(0, Math.min(100, pg.value)) : 0;
    let currentMatch = 0;
    let delta = null;

    if (selectedMatch?.geneValues && selectedMatch.geneValues[key] != null) {
      currentMatch = Math.max(0, Math.min(100, Number(selectedMatch.geneValues[key])));
    }
    if (selectedMatch && matchesList?.length) {
      const idx = matchesList.findIndex(
        (m) => (m.matchId || m.id) === (selectedMatch.matchId || selectedMatch.id)
      );
      if (idx > 0) {
        const prev = matchesList[idx - 1];
        const prevVal = prev?.geneValues?.[key];
        if (prevVal != null) {
          delta = currentMatch - Math.max(0, Math.min(100, Number(prevVal)));
        }
      }
    }

    return {
      key,
      label: geneLabels[key] || key,
      seasonAvg: Math.round(seasonAvg),
      currentMatch: Math.round(currentMatch),
      delta,
      fullMark: 100,
    };
  });
}

/**
 * Radar as main DNA visualization. Solo: Season avg (thin) + current match slice (bold).
 * Tooltip: value, Δ to previous match. Compare mode: props ready for second contour later.
 */
export default function DnaRadarChart({
  profile = {},
  selectedMatchId,
  highlightedGeneKey = null,
  /** For compare mode later: profileB, selectedMatchIdB */
  profileB,
  selectedMatchIdB,
}) {
  const { t } = useTranslation();
  const profileGenes = profile.genes ?? [];
  const matches = profile.matches ?? [];
  const matchHistory = profile.matchHistory ?? [];
  const matchesList = matchHistory.length ? matchHistory : matches;

  const geneLabels = useMemo(() => {
    const map = {};
    profileGenes.forEach((g) => {
      map[g.key] = g.shortLabel || g.label || g.key;
    });
    GENE_KEYS.forEach((k) => {
      if (!map[k]) map[k] = k;
    });
    return map;
  }, [profileGenes]);

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId || !matchesList.length) return null;
    return matchesList.find((m) => (m.matchId || m.id) === selectedMatchId) || null;
  }, [matchesList, selectedMatchId]);

  const radarData = useMemo(
    () => buildRadarData(profileGenes, selectedMatch, matchesList, geneLabels),
    [profileGenes, selectedMatch, matchesList, geneLabels]
  );

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const deltaStr =
      row.delta != null && row.delta !== 0
        ? row.delta > 0
          ? `+${row.delta}`
          : String(row.delta)
        : "0";
    return (
      <div className="dnaGenomeChartTooltip dnaRadarTooltip">
        <div className="dnaGenomeChartTooltipName">{row.key ? (t(`dnaMinimal.gene_${row.key}_label`) || row.label) : row.label}</div>
        <div className="dnaGenomeChartTooltipValue">
          Season avg: {row.seasonAvg} · Match: {row.currentMatch}
        </div>
        <div className="dnaGenomeChartTooltipValue">Δ vs prev: {deltaStr}</div>
      </div>
    );
  };

  const hasCurrent = selectedMatch != null;

  return (
    <div
      className="dnaRadarWrap"
      data-highlighted-axis={highlightedGeneKey || undefined}
    >
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="70%"
          data={radarData}
          margin={{ top: 24, right: 24, bottom: 24, left: 24 }}
        >
          <PolarGrid
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
            className="dnaRadarGrid"
          />
          <PolarAngleAxis
            dataKey="key"
            tick={(props) => {
              const { payload, x, y, textAnchor } = props;
              const key = typeof payload === "string" ? payload : payload?.key;
              const isHighlighted = key === highlightedGeneKey;
              return (
                <g
                  className={`dnaRadarAxisTick ${isHighlighted ? "dnaRadarAxisTickHighlight" : ""}`}
                  transform={`translate(${x},${y})`}
                >
                  <text
                    x={0}
                    y={0}
                    textAnchor={textAnchor}
                    fill="currentColor"
                    fontSize={isHighlighted ? 11 : 10}
                    fontWeight={isHighlighted ? 700 : 400}
                    opacity={isHighlighted ? 1 : 0.85}
                    style={{ transition: "opacity 180ms ease, font-weight 180ms ease" }}
                  >
                    {key ? (t(`dnaMinimal.gene_${key}_short`) || t(`dnaMinimal.gene_${key}_label`) || key) : (geneLabels[key] || key)}
                  </text>
                </g>
              );
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }}
            tickCount={5}
          />
          <Radar
            name="Season avg"
            dataKey="seasonAvg"
            stroke="rgba(255,255,255,0.35)"
            fill="rgba(255,255,255,0.08)"
            fillOpacity={0.4}
            strokeWidth={1.5}
          />
          {hasCurrent && (
            <Radar
              name="Selected match"
              dataKey="currentMatch"
              stroke="var(--color-accent, rgba(255, 160, 100, 0.9))"
              fill="var(--color-accent, rgba(255, 160, 100, 0.25))"
              fillOpacity={0.5}
              strokeWidth={2.5}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => (value === "Season avg" ? "Season avg" : "Selected match")}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
