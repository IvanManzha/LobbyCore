import React, { useMemo } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
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

const GENE_KEYS = [
  "combat", "pressure", "conversion", "survival",
  "positioning", "recovery", "teamwork",
];

/**
 * Build radar data for Compare: one row per gene with valueA, valueB, delta.
 */
function buildCompareRadarData(profileGenesA, profileGenesB, geneLabels) {
  return GENE_KEYS.map((key) => {
    const pgA = profileGenesA.find((g) => g.key === key);
    const pgB = profileGenesB.find((g) => g.key === key);
    const valA = pgA?.value != null ? Math.max(0, Math.min(100, pgA.value)) : 0;
    const valB = pgB?.value != null ? Math.max(0, Math.min(100, pgB.value)) : 0;
    const delta = Math.round(valA - valB);

    return {
      key,
      label: geneLabels[key] || key,
      valueA: Math.round(valA),
      valueB: Math.round(valB),
      delta,
      fullMark: 100,
    };
  });
}

/**
 * Sprint 5: Radar/8-gon for Compare mode — two contours (A orange, B cold).
 */
export default function DnaRadarCompare({
  profileA = {},
  profileB = {},
  highlightedGeneKey = null,
}) {
  const { t } = useTranslation();
  const profileGenesA = profileA?.genes ?? [];
  const profileGenesB = profileB?.genes ?? [];

  const geneLabels = useMemo(() => {
    const map = {};
    [...profileGenesA, ...profileGenesB].forEach((g) => {
      map[g.key] = g.shortLabel || g.label || g.key;
    });
    GENE_KEYS.forEach((k) => {
      if (!map[k]) map[k] = k;
    });
    return map;
  }, [profileGenesA, profileGenesB]);

  const radarData = useMemo(
    () => buildCompareRadarData(profileGenesA, profileGenesB, geneLabels),
    [profileGenesA, profileGenesB, geneLabels]
  );

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const deltaStr = row.delta > 0 ? `+${row.delta}` : String(row.delta);
    return (
      <div className="dnaGenomeChartTooltip dnaRadarTooltip dnaRadarCompareTooltip">
        <div className="dnaGenomeChartTooltipName">{row.key ? (t(`dnaMinimal.gene_${row.key}_label`) || row.label) : row.label}</div>
        <div className="dnaRadarCompareTooltipRow">
          <span className="dnaRadarCompareTooltipA">A: {row.valueA}</span>
          <span className="dnaRadarCompareTooltipB">B: {row.valueB}</span>
        </div>
        <div className="dnaRadarCompareTooltipDelta">Δ {deltaStr}</div>
      </div>
    );
  };

  return (
    <div
      className="dnaRadarWrap dnaRadarCompareWrap"
      data-highlighted-axis={highlightedGeneKey || undefined}
    >
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="68%"
          data={radarData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
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
                    fontSize={isHighlighted ? 10 : 9}
                    fontWeight={isHighlighted ? 700 : 400}
                    opacity={isHighlighted ? 1 : 0.8}
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
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 8 }}
            tickCount={5}
          />
          <Radar
            name="Player A"
            dataKey="valueA"
            stroke="rgba(245, 158, 11, 0.95)"
            fill="rgba(245, 158, 11, 0.2)"
            fillOpacity={0.5}
            strokeWidth={2}
          />
          <Radar
            name="Player B"
            dataKey="valueB"
            stroke="rgba(100, 180, 255, 0.95)"
            fill="rgba(100, 180, 255, 0.2)"
            fillOpacity={0.5}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
