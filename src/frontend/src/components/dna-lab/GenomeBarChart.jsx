import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const Y_TICKS = [0, 25, 50, 75, 100];
const MUTED_FILL = "rgba(255,255,255,0.15)";
const ACCENT_FILL = "rgba(140, 120, 255, 0.85)";

/**
 * 2D Skill Genome Chart: 8 genes on OX, values 0–100 on OY.
 * activeGeneKey highlights that bar (accent + glow).
 */
export default function GenomeBarChart({ genes = [], profileGenes = [], activeGeneKey }) {
  const data = genes.map((g) => ({
    key: g.key,
    name: g.label,
    shortName: g.label.slice(0, 4),
    value: profileGenes.find((x) => x.key === g.key)?.value ?? 0,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="dnaGenomeChartTooltip">
        <div className="dnaGenomeChartTooltipName">{p.name}</div>
        <div className="dnaGenomeChartTooltipValue">{p.value}</div>
      </div>
    );
  };

  return (
    <div className="dnaGenomeChartArea">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 8, left: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.08)"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            dataKey="shortName"
            tick={{ fill: "currentColor", fontSize: 11, opacity: 0.8 }}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={Y_TICKS}
            tick={{ fill: "currentColor", fontSize: 11, opacity: 0.7 }}
            axisLine={false}
            tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.2)" }} />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            isAnimationActive={true}
          >
            {data.map((entry, index) => {
              const isActive = entry.key === activeGeneKey;
              return (
                <Cell
                  key={entry.key}
                  fill={isActive ? ACCENT_FILL : MUTED_FILL}
                  stroke={isActive ? "rgba(140, 120, 255, 0.6)" : "transparent"}
                  strokeWidth={isActive ? 1.5 : 0}
                  style={
                    isActive
                      ? { filter: "drop-shadow(0 0 8px rgba(140, 120, 255, 0.4))" }
                      : undefined
                  }
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
