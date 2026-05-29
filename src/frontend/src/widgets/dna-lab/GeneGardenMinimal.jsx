import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/contexts/LanguageContext";
import { GENES } from "./mock/dnaMock";

/** Все аббревиатуры ровно 3 буквы для компактного блока генов */
const SHORT_LABELS = {
  accuracy: "AIM",
  tactics: "TAC",
  aggression: "AGR",
  survival: "SUR",
  positioning: "POS",
  teamwork: "TMW",
  resource: "RES",
  composure: "COM",
};

function stdDev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function stabilityKey(std) {
  if (std < 6) return "stable";
  return "volatile";
}

function statusKey(v) {
  if (v == null) return null;
  if (v < 33) return "low";
  if (v < 66) return "mid";
  return "high";
}

/**
 * Gene Garden Minimal: 8 lines with baseline rails, nodes, always-visible quiet numbers, tooltip on hover/focus.
 * Full row clickable (min 44px), no translate on hover.
 */
export default function GeneGardenMinimal({
  genes = [],
  profileGenes = [],
  matchHistory = [],
  selectedMatchId = null,
  activeKey,
  focusMode = null,
  onSelectGene,
  onNodeDoubleClick,
  playerId = "",
  seasonId = "",
}) {
  const { t, lang } = useTranslation();
  const [hoveredKey, setHoveredKey] = useState(null);
  const [focusedKey, setFocusedKey] = useState(null);
  const [tooltipAnchor, setTooltipAnchor] = useState(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const svgRef = useRef(null);

  const geneList = genes.length ? genes : GENES.map((g) => ({
    ...g,
    shortLabel: SHORT_LABELS[g.key] || g.label?.slice(0, 4) || g.key,
  }));

  const viewBox = { w: 400, h: 560 };
  const labelWidth = 56;
  const padding = { left: labelWidth, right: 48, top: 24, bottom: 24 };
  const xStart = padding.left;
  const xEnd = viewBox.w - padding.right;
  const stemWidth = xEnd - xStart;
  const rowGap = Math.max((viewBox.h - padding.top - padding.bottom) / 7, 44);
  const yTop = padding.top + rowGap * 0.5;
  const nodeInset = stemWidth * 0.04;
  const nodeRadius = 8;
  const nodeRadiusActive = 9;
  const rowHalf = rowGap / 2;
  const labelCenterX = labelWidth / 2;

  const selectedMatchIndex = useMemo(() => {
    if (!selectedMatchId || !matchHistory?.length) return -1;
    return matchHistory.findIndex((m) => (m.matchId || m.id) === selectedMatchId);
  }, [selectedMatchId, matchHistory]);

  const stems = useMemo(() => {
    return geneList.map((g, i) => {
      const y = yTop + i * rowGap;
      const pg = profileGenes.find((x) => x.key === g.key);
      const value = pg?.value;
      const hasValue = value != null && !Number.isNaN(value);
      const numValue = hasValue ? value : null;
      const norm = hasValue ? Math.max(0, Math.min(1, value / 100)) : 0.5;
      const xNode = xStart + nodeInset + (stemWidth - nodeInset * 2) * norm;
      const drawStem = numValue != null && numValue !== 0;

      const values = (matchHistory || [])
        .map((m) => m.geneValues?.[g.key])
        .filter((v) => v != null)
        .map((v) => Math.max(0, Math.min(100, Number(v))));
      const std = stdDev(values);
      const stability = values.length >= 2 ? stabilityKey(std) : null;
      const status = statusKey(numValue ?? (values.length ? values[values.length - 1] : null));

      let delta = null;
      if (selectedMatchIndex >= 0 && values.length >= 2) {
        const idx = Math.min(selectedMatchIndex, values.length - 1);
        const curr = values[idx];
        const prev = values[idx - 1];
        if (prev != null && curr != null) delta = Math.round(curr - prev);
      } else if (values.length >= 2) {
        const last = values[values.length - 1];
        const prev = values[values.length - 2];
        delta = Math.round(last - prev);
      }

      const statusRu = status === "low" ? t("dnaMinimal.statusLow") : status === "mid" ? t("dnaMinimal.statusMid") : status === "high" ? t("dnaMinimal.statusHigh") : "";
      const stabilityRu = stability === "stable" ? t("dnaMinimal.stabilityStable") : stability === "volatile" ? t("dnaMinimal.stabilityVolatile") : "";

      const shortLabelEn = SHORT_LABELS[g.key] || g.shortLabel || g.key;
      return {
        key: g.key,
        y,
        xNode,
        // Короткий ключ всегда на английском, без локализации
        label: shortLabelEn,
        // Полное название берём локализованное (для тултипа/модалки)
        fullLabel: t(`dnaMinimal.gene_${g.key}_label`) || g.label || g.key,
        value: hasValue ? Math.round(value) : null,
        drawStem,
        status,
        statusRu,
        stabilityRu,
        delta,
      };
    });
  }, [geneList, profileGenes, matchHistory, selectedMatchIndex, xStart, yTop, rowGap, stemWidth, nodeInset, t]);

  const handleRowEnter = (key) => setHoveredKey(key);
  const handleRowLeave = () => { setHoveredKey(null); setTooltipAnchor(null); };
  const handleRowFocus = (key, e) => {
    setFocusedKey(key);
    const el = e?.currentTarget;
    if (el) {
      const rect = el.getBoundingClientRect();
      setTooltipAnchor({ key, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
  };
  const handleRowBlur = () => { setFocusedKey(null); setTooltipAnchor(null); };
  const handleMouseMove = (e, key) => {
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e, key) => {
    e.stopPropagation();
    onSelectGene?.(key);
  };
  const handleDoubleClick = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectGene?.(key);
    onNodeDoubleClick?.(key);
  };

  const tooltipKey = hoveredKey || focusedKey;
  const tooltipStem = tooltipKey ? stems.find((s) => s.key === tooltipKey) : null;
  const showTooltip = !!tooltipStem;
  const tooltipPos = showTooltip
    ? (hoveredKey ? lastMouseRef.current : tooltipAnchor)
    : null;

  return (
    <div className="geneGardenMinimal">
      <svg
        ref={svgRef}
        className="geneGardenMinimalSvg"
        viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nodeGlowActive" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {stems.map(({ key, y, xNode, label, fullLabel, value, drawStem, statusRu, stabilityRu, delta }, stemIdx) => {
          const isActive = focusMode === "gene" && key === activeKey;
          const isHovered = key === hoveredKey;
          const isFocused = key === focusedKey;
          const r = isActive ? nodeRadiusActive : nodeRadius;
          const staggerMs = stemIdx * 45;
          const rowY1 = y - rowHalf;
          const rowY2 = y + rowHalf;

          const ariaParts = [label, value != null ? String(value) : "—"];
          if (statusRu) ariaParts.push(statusRu);
          if (stabilityRu) ariaParts.push(stabilityRu);
          const ariaLabel = ariaParts.join(", ");

          const isDimmed = (focusMode === "gene" && !isActive) || focusMode === "core";
          return (
            <g key={key} className={`geneGardenMinimalRow ${isActive ? "isActive" : ""} ${isHovered || isFocused ? "isHovered" : ""}`}>
              {/* Label: статично, по центру зоны названий */}
              <g className="geneGardenMinimalRowLabel" aria-hidden="true">
                <text
                  className="geneGardenMinimalLabel"
                  x={labelCenterX}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {label}
                </text>
              </g>
              {/* Стебель: скрываем при ховере/фокусе на неактивных, но оставляем для активного гена */}
              {drawStem && (!isHovered && !isFocused || isActive) && (
                <path
                  className={`geneGardenMinimalStem ${isActive ? "isActive" : ""}`}
                  d={`M ${xStart} ${y} L ${xNode} ${y}`}
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1}
                  style={{ animation: `geneGardenStemGrow 600ms ease-out ${staggerMs}ms forwards` }}
                  pointerEvents="none"
                />
              )}
              {/* Только бабл + число уезжают влево при isDimmed */}
              <g className={`geneGardenMinimalRowBubble ${isDimmed ? "isDimmed" : ""}`}>
              {/* Value always visible, quiet / active / hover */}
              <text
                className={`geneGardenMinimalValue ${!isActive && !isHovered && !isFocused ? "geneGardenMinimalValue--quiet" : ""} ${isActive ? "geneGardenMinimalValue--active" : ""} ${isHovered || isFocused ? "geneGardenMinimalValue--hovered" : ""}`}
                x={xNode + 14}
                y={y}
                textAnchor="start"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {value != null ? value : "—"}
              </text>
              {/* Full row hit area: rect, min 44px height */}
              <rect
                className="geneGardenMinimalHitArea"
                x={0}
                y={rowY1}
                width={viewBox.w}
                height={rowGap}
                fill="transparent"
                cursor="pointer"
                onMouseEnter={() => handleRowEnter(key)}
                onMouseLeave={handleRowLeave}
                onMouseMove={(e) => handleMouseMove(e, key)}
                onClick={(e) => handleClick(e, key)}
                onDoubleClick={(e) => handleDoubleClick(e, key)}
                onFocus={(e) => handleRowFocus(key, e)}
                onBlur={handleRowBlur}
                role="button"
                tabIndex={0}
                aria-label={ariaLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectGene?.(key);
                  }
                }}
              />
              <circle
                className={`geneGardenMinimalNode ${isActive ? "isActive" : ""} ${isHovered || isFocused ? "isHovered" : ""}`}
                cx={xNode}
                cy={y}
                r={r}
                style={{ animation: `geneGardenNodeIn 250ms ease-out ${staggerMs + 50}ms both` }}
                pointerEvents="none"
              />
              </g>
            </g>
          );
        })}
      </svg>
      {showTooltip && tooltipStem && tooltipPos && createPortal(
        <div
          className="geneGardenMinimalTooltip"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y,
            transform: "translateY(-50%)",
          }}
          role="tooltip"
        >
          <div><strong>{tooltipStem.fullLabel ?? tooltipStem.label}</strong></div>
          <div>
            <strong>{tooltipStem.value ?? "—"}</strong>
            {(tooltipStem.statusRu || tooltipStem.stabilityRu) && (
              <> · {[tooltipStem.statusRu, tooltipStem.stabilityRu].filter(Boolean).join(" · ")}</>
            )}
          </div>
          {tooltipStem.delta != null && tooltipStem.delta !== 0 && (
            <div className={tooltipStem.delta >= 0 ? "up" : "down"}>
              Δ {tooltipStem.delta >= 0 ? `+${tooltipStem.delta}` : tooltipStem.delta} {t("dnaMinimal.deltaLastMatch")}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
