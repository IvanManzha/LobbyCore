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
 * Mini chart: gene value per match for activeGeneKey. Clickable bars; "Selected match: #N — GeneName 32 → 38 (+6)" below.
 * Uses matches or matchHistory; needs geneLabel for the summary line.
 */
export default function GeneHistoryChart({
  matches = [],
  matchHistory = [],
  activeGeneKey,
  geneLabel = "",
  selectedMatchId,
  onSelectMatch,
}) {
  const source = matchHistory.length ? matchHistory : matches;

  const data = useMemo(() => {
    if (!activeGeneKey || !source.length) return [];
    return source.slice(0, 20).map((m, index) => {
      const geneValues = m.geneValues || {};
      const value = geneValues[activeGeneKey];
      const numValue = value != null ? Math.max(0, Math.min(100, Number(value))) : null;
      const prev = index > 0 ? (source[index - 1].geneValues || {})[activeGeneKey] : numValue;
      const prevNum = prev != null ? Math.max(0, Math.min(100, Number(prev))) : null;
      const delta = numValue != null && prevNum != null ? numValue - prevNum : null;
      return {
        index,
        matchId: m.matchId || m.id,
        label: m.label,
        dateShort: m.dateShort || (m.startedAt ? new Date(m.startedAt).toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : `#${index + 1}`),
        value: numValue ?? 0,
        prevValue: prevNum,
        delta,
      };
    });
  }, [source, activeGeneKey]);

  const selectedPoint = useMemo(() => {
    if (!selectedMatchId || !data.length) return null;
    const idx = data.findIndex((d) => d.matchId === selectedMatchId);
    if (idx < 0) return null;
    const d = data[idx];
    const prevVal = d.prevValue ?? d.value;
    const deltaStr = d.delta != null && d.delta !== 0 ? (d.delta > 0 ? `+${d.delta}` : `${d.delta}`) : "0";
    return { index: idx + 1, from: prevVal, to: d.value, deltaStr };
  }, [data, selectedMatchId]);

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

  if (!activeGeneKey) {
    return (
      <div className="dnaGeneHistoryStrip">
        <div className="dnaEmpty">Select a gene to see history by match.</div>
      </div>
    );
  }

  if (source.length < 2) {
    return (
      <div className="dnaGeneHistoryStrip">
        <div className="dnaGeneHistoryStripTitle">History by match</div>
        <div className="dnaEmpty">Нужно минимум 2 матча для истории.</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="dnaGeneHistoryStrip">
        <div className="dnaGeneHistoryStripTitle">History by match</div>
        <div className="dnaEmpty">No match data for this gene.</div>
      </div>
    );
  }

  const label = geneLabel || activeGeneKey;

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
          <YAxis domain={[0, 100]} hide />
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
                  fill={isSelected ? "var(--color-accent, rgba(140, 120, 255, 0.85))" : "rgba(255,255,255,0.2)"}
                  stroke={isSelected ? "var(--color-accent2, rgba(140, 120, 255, 0.9))" : "transparent"}
                  strokeWidth={isSelected ? 1.5 : 0}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {selectedPoint && (
        <div className="dnaGeneHistorySelected">
          Selected match: #{selectedPoint.index} — {label} {selectedPoint.from ?? "—"} → {selectedPoint.to ?? "—"} ({selectedPoint.deltaStr})
        </div>
      )}
    </div>
  );
}
