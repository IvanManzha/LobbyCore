import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/**
 * Mini chart: gene value per match for activeGeneKey.
 * Data: { index, matchId, label, dateShort, value, prevValue, delta }.
 * onSelectMatch(index) on bar click.
 */
export default function GeneHistoryMiniChart({
  matches = [],
  activeGeneKey,
  selectedMatchId,
  onSelectMatch,
}) {
  const data = useMemo(() => {
    if (!activeGeneKey || !matches.length) return [];
    return matches.map((m, index) => {
      const value = m.geneValues?.[activeGeneKey] ?? 0;
      const prev = index > 0 ? matches[index - 1].geneValues?.[activeGeneKey] : value;
      const delta = value - prev;
      return {
        index,
        matchId: m.id,
        label: m.label,
        dateShort: m.dateShort,
        value: Math.max(0, Math.min(100, value)),
        prevValue: prev,
        delta,
      };
    });
  }, [matches, activeGeneKey]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const deltaStr = p.delta != null && p.delta !== 0 ? (p.delta >= 0 ? `+${p.delta}` : `${p.delta}`) : "0";
    return (
      <div className="dnaGenomeChartTooltip">
        <div className="dnaGenomeChartTooltipName">Match {p.index + 1}: {p.dateShort}</div>
        <div className="dnaGenomeChartTooltipValue">
          {deltaStr} (from {p.prevValue ?? "—"} → {p.value})
        </div>
      </div>
    );
  };

  if (!activeGeneKey || data.length === 0) {
    return (
      <div className="dnaGeneHistoryStrip">
        <div className="dnaEmpty">Select a gene to see history by match.</div>
      </div>
    );
  }

  return (
    <div className="dnaGeneHistoryStrip">
      <div className="dnaGeneHistoryStripTitle">History by match</div>
      <ResponsiveContainer width="100%" height={88}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <XAxis
            dataKey="index"
            tickFormatter={(i) => i + 1}
            tick={{ fill: "currentColor", fontSize: 10, opacity: 0.7 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            hide
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.15)" }} />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={true}
            onClick={(entry) => {
              if (entry?.matchId) onSelectMatch?.(entry.matchId);
            }}
          >
            {data.map((entry) => {
              const isSelected = entry.matchId === selectedMatchId;
              return (
                <Cell
                  key={entry.matchId}
                  fill={isSelected ? "rgba(140, 120, 255, 0.85)" : "rgba(255,255,255,0.2)"}
                  stroke={isSelected ? "rgba(140, 120, 255, 0.9)" : "transparent"}
                  strokeWidth={isSelected ? 1.5 : 0}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
