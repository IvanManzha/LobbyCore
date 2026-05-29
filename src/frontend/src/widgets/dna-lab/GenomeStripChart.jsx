import React, { useMemo, useRef, useState } from "react";
import { formatTrendShort } from "@/shared/lib/dnaFormatting";
import { useTranslation } from "@/contexts/LanguageContext";

const WIDTH = 800;
const HEIGHT = 280;
const PAD_TOP = 24;
const PAD_RIGHT = 24;
const PAD_BOTTOM = 44;
const PAD_LEFT = 32;
const CHART_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const CHART_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const Y_TICKS = [0, 25, 50, 75, 100];
const NODE_RADIUS = 6;
const NODE_RADIUS_ACTIVE = 8;
const STEM_WIDTH = 2;

/**
 * Lollipop chart: 8 genes on OX, value 0-100 on OY. Stem + node per gene; selected gene highlighted.
 * Click on stem/node selects gene. Tooltip on hover.
 */
export default function GenomeStripChart({
  genes = [],
  profileGenes = [],
  activeGeneKey,
  onSelectGene,
}) {
  const { t } = useTranslation();
  const [hoverKey, setHoverKey] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef(null);

  const data = useMemo(() => {
    return genes.map((g) => {
      const pg = profileGenes.find((x) => x.key === g.key);
      const value = pg?.value != null ? Math.max(0, Math.min(100, pg.value)) : null;
      const trend = pg?.trend;
      const trendStr = (typeof trend === "object" ? formatTrendShort(trend, false) : trend != null && trend !== 0 ? formatTrendShort(trend, false) : "") || "";
      return {
        key: g.key,
        label: g.label,
        shortLabel: g.shortLabel || g.label?.slice(0, 4) || g.key?.slice(0, 4),
        value,
        trendStr,
      };
    });
  }, [genes, profileGenes]);

  const scaleX = (i) => PAD_LEFT + (i + 0.5) * (CHART_WIDTH / data.length);
  const scaleY = (v) => {
    const y = (v / 100) * CHART_HEIGHT;
    return PAD_TOP + CHART_HEIGHT - y;
  };

  const handleMouseMove = (e, key) => {
    setHoverKey(key);
    const wrap = wrapRef.current;
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseLeave = () => setHoverKey(null);

  return (
    <div ref={wrapRef} className="dnaGenomeStripChartWrap">
      <svg
        className="dnaGenomeStripChart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="dnaStripBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--color-surface2, rgba(0,0,0,0.2))" />
            <stop offset="100%" stopColor="var(--color-bg2, rgba(0,0,0,0.4))" />
          </linearGradient>
          <filter id="dnaNodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={PAD_LEFT} y={PAD_TOP} width={CHART_WIDTH} height={CHART_HEIGHT} fill="url(#dnaStripBg)" className="dnaStripChartBg" />
        {/* Grid lines */}
        {Y_TICKS.filter((t) => t > 0 && t < 100).map((t) => (
          <line
            key={t}
            x1={PAD_LEFT}
            y1={scaleY(t)}
            x2={PAD_LEFT + CHART_WIDTH}
            y2={scaleY(t)}
            className="dnaStripGridLine"
          />
        ))}
        {/* Stems and nodes */}
        {data.map((d, i) => {
          const x = scaleX(i);
          const value = d.value != null ? d.value : 0;
          const yVal = scaleY(value);
          const yBase = scaleY(0);
          const isActive = d.key === activeGeneKey;
          const isHover = d.key === hoverKey;
          const isInteractive = isActive || isHover;

          return (
            <g
              key={d.key}
              className="dnaStripGeneGroup"
              onClick={() => onSelectGene?.(d.key)}
              onMouseMove={(e) => handleMouseMove(e, d.key)}
              style={{ cursor: "pointer" }}
            >
              <line
                x1={x}
                y1={yBase}
                x2={x}
                y2={yVal}
                className={`dnaStripStem ${isActive ? "dnaStripStemActive" : ""} ${isHover ? "dnaStripStemHover" : ""}`}
                strokeWidth={STEM_WIDTH}
              />
              <circle
                cx={x}
                cy={yVal}
                r={isActive ? NODE_RADIUS_ACTIVE : NODE_RADIUS}
                className={`dnaStripNode ${isActive ? "dnaStripNodeActive" : ""} ${isHover ? "dnaStripNodeHover" : ""}`}
                filter={isActive ? "url(#dnaNodeGlow)" : undefined}
              />
            </g>
          );
        })}
        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={d.key}
            x={scaleX(i)}
            y={HEIGHT - 12}
            textAnchor="middle"
            className="dnaStripLabel"
          >
            {t(`dnaMinimal.gene_${d.key}_short`) || t(`dnaMinimal.gene_${d.key}_label`) || d.shortLabel}
          </text>
        ))}
      </svg>
      {hoverKey && (() => {
        const d = data.find((x) => x.key === hoverKey);
        if (!d) return null;
        return (
          <div
            className="dnaGenomeChartTooltip dnaStripTooltip"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y + 8,
            }}
          >
            <div className="dnaGenomeChartTooltipName">{t(`dnaMinimal.gene_${d.key}_label`) || d.label}</div>
            <div className="dnaGenomeChartTooltipValue">
              {d.value != null ? d.value : "—"}
              {d.trendStr ? ` (${d.trendStr} last match)` : ""}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
