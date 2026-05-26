import React, { useCallback, useMemo, useState } from "react";

const GENE_KEYS = [
  "combat", "pressure", "conversion", "survival",
  "positioning", "recovery", "teamwork",
];

const SHORT_LABELS = {
  combat: "COMB",
  pressure: "PRES",
  conversion: "CONV",
  survival: "SUR",
  positioning: "POS",
  recovery: "REC",
  teamwork: "TMW",
};

const ANGLE_STEP = 360 / GENE_KEYS.length;

/**
 * Convert value (0-100) and axis index to polar point.
 * Axis 0 = top (-90°), clockwise.
 */
function polarToXY(cx, cy, radius, value, axisIndex) {
  const angle = (-90 + axisIndex * ANGLE_STEP) * (Math.PI / 180);
  const r = (radius * (value ?? 0)) / 100;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/**
 * Build polygon path from values object.
 */
function valuesToPath(cx, cy, radius, values) {
  const points = GENE_KEYS.map((key, i) => {
    const v = values?.[key] ?? 0;
    return polarToXY(cx, cy, radius, Math.max(0, Math.min(100, Number(v))), i);
  });
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ") + " Z";
}

/**
 * Get axis line endpoints (center to outer edge).
 */
function getAxisEndpoints(cx, cy, radius, axisIndex) {
  const inner = polarToXY(cx, cy, 0, 0, axisIndex);
  const outer = polarToXY(cx, cy, radius, 100, axisIndex);
  return { x1: cx, y1: cy, x2: outer.x, y2: outer.y };
}

/**
 * Duel 7-gon: me (gray-blue) + opponent (red), clickable axes.
 */
export default function OctagonDuelRadar({
  genesMe = {},
  genesOpp = null,
  selectedAxis = null,
  onSelectAxis,
  hasOpponent = false,
}) {
  const [hoveredAxis, setHoveredAxis] = useState(null);
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const labelRadius = size * 0.44;

  const pathMe = useMemo(
    () => valuesToPath(cx, cy, radius, genesMe),
    [cx, cy, radius, genesMe]
  );

  const pathOpp = useMemo(() => {
    if (!hasOpponent || !genesOpp) return null;
    return valuesToPath(cx, cy, radius, genesOpp);
  }, [cx, cy, radius, genesOpp, hasOpponent]);

  const handleAxisClick = useCallback(
    (key) => {
      onSelectAxis?.(selectedAxis === key ? null : key);
    },
    [onSelectAxis, selectedAxis]
  );

  const rings = [0.33, 0.66, 1].map((scale) => radius * scale);

  return (
    <div className="octagonDuelRadar">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="octagonDuelRadarSvg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="octagonGradMe" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(180, 210, 255, 0.35)" />
            <stop offset="100%" stopColor="rgba(120, 160, 255, 0.12)" />
          </linearGradient>
          <linearGradient id="octagonGradOpp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 120, 100, 0.3)" />
            <stop offset="100%" stopColor="rgba(220, 60, 60, 0.12)" />
          </linearGradient>
        </defs>
        {/* Radial grid rings */}
        <g className="octagonDuelRadarGrid">
          {rings.map((r, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              className="octagonDuelGridRing"
              strokeWidth={i === rings.length - 1 ? "1.5" : "1"}
            />
          ))}
        </g>

        {/* Radial spokes */}
        {GENE_KEYS.map((_, i) => {
          const { x2, y2 } = getAxisEndpoints(cx, cy, radius, i);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              className="octagonDuelSpoke"
              strokeWidth="1"
            />
          );
        })}

        {/* My polygon */}
        <path
          d={pathMe}
          fill="url(#octagonGradMe)"
          stroke="rgba(200, 220, 255, 0.85)"
          strokeWidth="2"
          className="octagonDuelPolygon octagonDuelPolygonMe"
          style={{ transition: "opacity 250ms ease" }}
        />

        {/* Opponent polygon (if selected) */}
        {pathOpp && (
          <path
            d={pathOpp}
            fill="url(#octagonGradOpp)"
            stroke="rgba(255, 100, 90, 0.9)"
            strokeWidth="2"
            className="octagonDuelPolygon octagonDuelPolygonOpp"
            style={{ transition: "opacity 250ms ease" }}
          />
        )}

        {/* Axis labels + hit targets */}
        {GENE_KEYS.map((key, i) => {
          const { x2, y2 } = getAxisEndpoints(cx, cy, radius, i);
          const labelPos = polarToXY(cx, cy, labelRadius, 100, i);
          const isHighlighted = selectedAxis === key || hoveredAxis === key;

          return (
            <g
              key={key}
              className={`octagonDuelAxis ${isHighlighted ? "isHighlighted" : ""}`}
            >
              <line
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                className="octagonDuelAxisLine"
                stroke={isHighlighted ? "rgba(245,158,11,0.4)" : "transparent"}
                strokeWidth="3"
                opacity={isHighlighted ? 1 : 0}
                style={{ transition: "opacity 140ms ease" }}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="octagonDuelAxisLabel"
              >
                {SHORT_LABELS[key] ?? key}
              </text>
              <line
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth="24"
                style={{ cursor: "pointer" }}
                onClick={() => handleAxisClick(key)}
                onMouseEnter={() => setHoveredAxis(key)}
                onMouseLeave={() => setHoveredAxis(null)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
