import React, { useMemo, useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * Gene Map: scatter plot X gene vs Y gene, one point per player.
 */
export default function DnaGeneMapScatter({ entries = [], genes = [] }) {
  const { t } = useTranslation();
  const geneKeys = genes.map((g) => g.key).filter(Boolean);
  const [xKey, setXKey] = useState(geneKeys[0] || "accuracy");
  const [yKey, setYKey] = useState(geneKeys[1] || "aggression");

  const data = useMemo(() => {
    return entries.map((e) => ({
      name: e.playerName || e.playerId,
      playerId: e.playerId,
      x: Number(e.genes?.[xKey]) || 0,
      y: Number(e.genes?.[yKey]) || 0,
      z: e.coreScore || 0,
    }));
  }, [entries, xKey, yKey]);

  const xLabel = xKey ? (t(`dnaMinimal.gene_${xKey}_label`) || genes.find((g) => g.key === xKey)?.label) || xKey : xKey;
  const yLabel = yKey ? (t(`dnaMinimal.gene_${yKey}_label`) || genes.find((g) => g.key === yKey)?.label) || yKey : yKey;

  return (
    <div className="dnaGeneMapInner">
      <div className="dnaGeneMapSelectors">
        <label>
          <span className="dnaGeneMapLabel">X</span>
          <select
            value={xKey}
            onChange={(e) => setXKey(e.target.value)}
            className="dnaGeneMapSelect"
          >
            {geneKeys.map((k) => (
              <option key={k} value={k}>
                {t(`dnaMinimal.gene_${k}_label`) || genes.find((g) => g.key === k)?.label || k}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="dnaGeneMapLabel">Y</span>
          <select
            value={yKey}
            onChange={(e) => setYKey(e.target.value)}
            className="dnaGeneMapSelect"
          >
            {geneKeys.map((k) => (
              <option key={k} value={k}>
                {t(`dnaMinimal.gene_${k}_label`) || genes.find((g) => g.key === k)?.label || k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="dnaGeneMapChartWrap">
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
              tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
              tickLine={{ stroke: "rgba(255,255,255,0.2)" }}
            />
            <ZAxis type="number" dataKey="z" range={[80, 400]} name="Core" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.3)" }}
              contentStyle={{
                background: "rgba(0,0,0,0.85)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
              }}
              formatter={(value, name) => [name === "name" ? value : Number(value).toFixed(0), name === "name" ? "Player" : name]}
              labelFormatter={(label) => `Player: ${label}`}
            />
            <Scatter
              name="Players"
              data={data}
              fill="rgba(140, 120, 255, 0.75)"
              fillOpacity={0.9}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
