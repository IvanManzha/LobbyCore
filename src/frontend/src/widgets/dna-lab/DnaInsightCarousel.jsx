import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "../../contexts/LanguageContext";
import { formatTrend, formatConfidence } from "../../utils/dnaFormatting";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import Accordion from "./Accordion";
import { useGeneInsightData, useCoreInsightData, buildGeneInsightCandidates } from "./useDnaInsightData";

const CARD_COUNT = 4;

/** Small popover near cursor for gene explanation. */
function GeneLabelWithTooltip({ label, tooltip }) {
  const [pos, setPos] = useState(null);
  if (!tooltip) return <span>{label}</span>;
  return (
    <>
      <span
        onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPos(null)}
        className="dnaGeneLabelWithTooltip"
      >
        {label}
      </span>
      {pos && (
        <div className="dnaGeneTooltipPopover" style={{ left: pos.x + 12, top: pos.y + 12 }}>
          {tooltip}
        </div>
      )}
    </>
  );
}
const SLIDE_DURATION_MS = 220;
const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

function getComputedFrom(dictionaryEntry, lang) {
  if (lang === "ru" && dictionaryEntry?.computedFrom_ru?.length) return dictionaryEntry.computedFrom_ru;
  return dictionaryEntry?.computedFrom ?? dictionaryEntry?.howComputed ?? [];
}

function getImproveBy(dictionaryEntry, lang) {
  if (lang === "ru" && dictionaryEntry?.improveBy_ru?.length) return dictionaryEntry.improveBy_ru;
  return dictionaryEntry?.improveBy ?? dictionaryEntry?.howToImprove ?? [];
}

/** Card 1 — Overview: gene (title, value, chips, what it means, 1–2 insights, hint) or core (DNA Score, value, top/weak). */
function CardOverview({ mode, genePayload, corePayload, t, lang }) {
  if (mode === "gene" && genePayload) {
    const key = genePayload.activeGeneKey;
    const name = genePayload.dictionaryEntry?.label ?? genePayload.dictionaryEntry?.name ?? genePayload.geneLabel ?? key ?? "—";
    const valueNum = genePayload.geneValue != null ? Math.max(0, Math.min(100, Number(genePayload.geneValue))) : null;
    const valueDisplay = valueNum != null ? valueNum.toFixed(1) : "—";
    const deltaLast = genePayload.geneDeltaLast;
    const deltaLastStr =
      deltaLast == null
        ? ""
        : Math.abs(deltaLast) < 0.5
          ? t("dnaMinimal.deltaLastMatchUnchanged")
          : t("dnaMinimal.deltaLastMatchFormat", { delta: deltaLast >= 0 ? `+${deltaLast.toFixed(1)}` : deltaLast.toFixed(1) });
    const level = genePayload.geneLevel;
    const levelPill = level === "low" ? t("dnaMinimal.levelLow") : level === "high" ? t("dnaMinimal.levelHigh") : level === "mid" ? t("dnaMinimal.levelMid") : null;
    const stabilityLabel = genePayload.stability === "stable" ? t("dnaMinimal.stabilityStable") : genePayload.stability === "swingy" ? t("dnaMinimal.swingy") : genePayload.stability === "volatile" ? t("dnaMinimal.stabilityVolatile") : null;
    const showStability = (genePayload.matchesTotal ?? 0) >= 4 && stabilityLabel;
    const coverageLow = (genePayload.coveragePct ?? 100) < 70;
    const whatItMeans = key ? (t(`dnaMinimal.gene_${key}_whatItMeans`) || t(`dnaMinimal.gene_${key}_tooltip`)) : (genePayload.dictionaryEntry?.descriptionShort ?? "");
    const matchCount = Math.round(Number(genePayload.matchesTotal) || 0);
    const trendSym = genePayload.trendLabel === "up" ? "↑" : genePayload.trendLabel === "down" ? "↓" : "→";
    const microDelta = genePayload.microDelta5 != null ? t("dnaMinimal.microDeltaOverN", { n: 5, delta: genePayload.microDelta5 >= 0 ? `+${Math.round(genePayload.microDelta5)}` : Math.round(genePayload.microDelta5) }) : null;

    const tldr = key ? t(`dnaMinimal.tldrGeneOverview`, { gene: name }) : "";
    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <h2 className="dnaInsightCardTitle">{name}</h2>
        </div>
        <div className="dnaInsightCardHero">
          <div className="dnaInsightCardValueRow">
            <span className="dnaInsightCardValue dnaMono">{valueDisplay}</span>
            {deltaLastStr && (
              <span className={`dnaInsightCardTrend ${(deltaLast ?? 0) >= 0 ? "up" : "down"}`}>{deltaLastStr}</span>
            )}
          </div>
          {valueNum != null && (
            <div className="dnaInsightMiniBar" role="img" aria-label={valueDisplay}>
              <div className="dnaInsightMiniBarFill" style={{ width: `${valueNum}%` }} />
            </div>
          )}
          <div className="dnaInsightCardPills">
            {levelPill && <span className="dnaInsightPill" data-level={level}>{levelPill}</span>}
            {showStability && <span className="dnaInsightPill" data-stability={genePayload.stability}>{stabilityLabel}</span>}
            {coverageLow && <span className="dnaInsightPill dnaInsightPill--data">{t("dnaMinimal.dataPartial")}</span>}
          </div>
          <div className="dnaInsightQuickFacts">
            <div className="dnaInsightQuickFact"><span className="dnaInsightQuickFactLabel">{t("dnaMinimal.quickFactTrend")}</span><span>{trendSym}</span></div>
            <div className="dnaInsightQuickFact"><span className="dnaInsightQuickFactLabel">{t("dnaMinimal.quickFactVolatility")}</span><span>{stabilityLabel || "—"}</span></div>
          </div>
          {microDelta && <p className="dnaInsightCardMicroDelta">{microDelta}</p>}
        </div>
        <div className="dnaInsightCardBody">
          {whatItMeans && <p className="dnaInsightCardWhatItMeans">{whatItMeans}</p>}
          {matchCount > 0 && <p className="dnaInsightCardMeta">{t("dnaMinimal.basedOnMatches", { n: matchCount })}</p>}
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardHint">{t("dnaMinimal.carouselCardHint")}</p>
          {tldr && <p className="dnaInsightCardTldr">{tldr}</p>}
        </div>
      </div>
    );
  }

  if (mode === "core" && corePayload) {
    const topKey = corePayload.topGeneKey;
    const weakKey = corePayload.weakGeneKey;
    const topShort = topKey ? (t(`dnaMinimal.gene_${topKey}_short`) || t(`dnaMinimal.gene_${topKey}_label`) || corePayload.topLabel) : "—";
    const weakShort = weakKey ? (t(`dnaMinimal.gene_${weakKey}_short`) || t(`dnaMinimal.gene_${weakKey}_label`) || corePayload.weakLabel) : "—";
    const topLabel = topKey ? (t(`dnaMinimal.gene_${topKey}_label`) || corePayload.topLabel) : "—";
    const weakLabel = weakKey ? (t(`dnaMinimal.gene_${weakKey}_label`) || corePayload.weakLabel) : "—";
    const topTooltip = topKey ? t(`dnaMinimal.gene_${topKey}_tooltip`) : "";
    const weakTooltip = weakKey ? t(`dnaMinimal.gene_${weakKey}_tooltip`) : "";
    const matchCount = Math.round(Number(corePayload.matchesTotal) || 0);
    const tldr = t("dnaMinimal.tldrCoreOverview", { top: topShort, weak: weakShort });
    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <h2 className="dnaInsightCardTitle">{t("dnaMinimal.coreScoreTitle")}</h2>
          <p className="dnaInsightCardSubtitle">{t("dnaMinimal.coreScoreSubtitle")}</p>
        </div>
        <div className="dnaInsightCardHero">
          <div className="dnaInsightCardValueRow">
            <span className="dnaInsightCardValue dnaMono">{corePayload.coreDisplay}</span>
            {corePayload.trendIndicator && (
              <span className={`dnaInsightCardTrend ${corePayload.trendIndicator === "up" ? "up" : corePayload.trendIndicator === "down" ? "down" : ""}`}>
                {corePayload.trendIndicator === "up" ? "↑ " + t("dnaMinimal.trendUp") : corePayload.trendIndicator === "down" ? "↓ " + t("dnaMinimal.trendDown") : "→ " + t("dnaMinimal.trendStable")}
              </span>
            )}
          </div>
          {matchCount > 0 && <p className="dnaInsightCardMeta">{t("dnaMinimal.basedOnMatches", { n: matchCount })}</p>}
          <div className="dnaInsightCardSummary">
            <span><strong>{t("dnaMinimal.topGene")}:</strong> <GeneLabelWithTooltip label={topLabel} tooltip={topTooltip} /></span>
            <span><strong>{t("dnaMinimal.weakGene")}:</strong> <GeneLabelWithTooltip label={weakLabel} tooltip={weakTooltip} /></span>
          </div>
          <div className="dnaInsightQuickFacts">
            <div className="dnaInsightQuickFact"><span className="dnaInsightQuickFactLabel">{t("dnaMinimal.quickFactTrend")}</span><span>{corePayload.trendIndicator === "up" ? "↑" : corePayload.trendIndicator === "down" ? "↓" : "→"}</span></div>
            <div className="dnaInsightQuickFact"><span className="dnaInsightQuickFactLabel">{t("dnaMinimal.insights")}</span><span>{topShort}</span></div>
            <div className="dnaInsightQuickFact"><span className="dnaInsightQuickFactLabel">{t("dnaMinimal.weakGene")}</span><span>{weakShort}</span></div>
            <div className="dnaInsightQuickFact"><span className="dnaInsightQuickFactLabel">{t("dnaMinimal.telemetryCoverage")}</span><span>{corePayload.telemetryMatches ?? 0}/8</span></div>
          </div>
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardHint">{t("dnaMinimal.carouselCardHint")}</p>
          <p className="dnaInsightCardTldr">{tldr}</p>
        </div>
      </div>
    );
  }

  return null;
}

/** Card 2 — Trend: chart by match + one line. */
function CardTrend({ mode, genePayload, corePayload, t }) {
  const chartHeight = 172;

  if (mode === "gene" && genePayload) {
    const rawData = genePayload.sparklineData ?? [];
    const peakMatchIndex = genePayload.peakMatchIndex ?? null;
    const dropMatchIndex = genePayload.dropMatchIndex ?? null;
    const peakDelta = genePayload.peakDelta ?? null;
    const dropDelta = genePayload.dropDelta ?? null;
    const showPeak = peakDelta != null && peakDelta >= 4;
    const showDrop = dropDelta != null && dropDelta <= -4;
    const data = (rawData || []).map((d, i) => ({
      ...d,
      value: Math.round(Number(d.value) || 0),
      isPeak: showPeak && peakMatchIndex != null && i + 1 === peakMatchIndex,
      isDrop: showDrop && dropMatchIndex != null && i + 1 === dropMatchIndex,
    }));
    const matchCount = (genePayload.sparklineData ?? []).length || (genePayload.matchesTotal ?? 0);
    const trendKey = genePayload.trendLabel === "up" ? "trendUp" : genePayload.trendLabel === "down" ? "trendDown" : "trendStable";
    const stabilityKey = genePayload.stability === "stable" ? "stabilityStable" : genePayload.stability === "volatile" ? "stabilityVolatile" : "swingy";
    const trendN = genePayload.trendN ?? 0;
    const summaryParts = [t("dnaMinimal.trendSummaryLastN", { trend: t(`dnaMinimal.${trendKey}`), n: trendN || matchCount || 0 })];
    if (genePayload.stability === "volatile") summaryParts.push("· " + t("dnaMinimal.insightVolatile"));
    if (genePayload.belowSeasonAvg && genePayload.diffFromAvg != null) summaryParts.push("· " + t("dnaMinimal.insightBelowAvgText", { diff: genePayload.diffFromAvg }));
    const tldr = genePayload.tldrTrend != null ? genePayload.tldrTrend : t("dnaMinimal.tldrGeneTrend", { peak: "—", trend: t(`dnaMinimal.${trendKey}`), stability: t(`dnaMinimal.${stabilityKey}`) });
    const chartMax = genePayload.chartMaxValue;
    const chartMin = genePayload.chartMinValue;
    const chartRangeVal = genePayload.chartRange;

    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.seasonTrend")}</div>
          {matchCount > 0 && <p className="dnaInsightCardMeta">{t("dnaMinimal.lastNMatches", { n: Math.round(Number(matchCount)) })}</p>}
        </div>
        <div className="dnaInsightCardBody">
          {data.length > 1 ? (
            <>
              <div className="dnaInsightChartSubSurface">
                <div className="dnaInsightChartWrap">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <LineChart data={data} margin={{ top: 8, right: 8, bottom: 24, left: 28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} tickLine={{ stroke: "rgba(255,255,255,0.15)" }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} tickLine={{ stroke: "rgba(255,255,255,0.15)" }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} width={28} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-accent, rgba(255, 160, 100, 0.8))"
                        strokeWidth={1.5}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (!payload.isPeak && !payload.isDrop) return null;
                          const label = payload.isPeak ? t("dnaMinimal.chartPeak") : t("dnaMinimal.chartDrop");
                          return (
                            <g>
                              <circle cx={cx} cy={cy} r={4} fill="var(--color-accent, rgba(255, 160, 100, 0.9))" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                              <text x={cx} y={cy - 10} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={9}>{label}</text>
                            </g>
                          );
                        }}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {chartMax != null && chartMin != null && chartRangeVal != null && (
                  <div className="dnaInsightChartLegend">
                    <div>{t("dnaMinimal.chartLegendMaxShort", { value: chartMax.value })}</div>
                    <div>{t("dnaMinimal.chartLegendMinShort", { value: chartMin.value })}</div>
                    <div>{t("dnaMinimal.chartLegendRange", { range: chartRangeVal })}</div>
                  </div>
                )}
              </div>
              <p className="dnaInsightTrendLine">{summaryParts.join(" ")}</p>
            </>
          ) : (
            <div className="dnaInsightCardEmpty">{t("dnaMinimal.notEnoughMatchesForTrend")}</div>
          )}
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardTldr">{tldr}</p>
        </div>
      </div>
    );
  }

  if (mode === "core" && corePayload) {
    const rawData = corePayload.sparklineData ?? [];
    const peakMatchIndex = corePayload.peakMatchIndex ?? null;
    const dropMatchIndex = corePayload.dropMatchIndex ?? null;
    const peakDelta = corePayload.peakDelta ?? null;
    const dropDelta = corePayload.dropDelta ?? null;
    const showPeak = peakDelta != null && peakDelta >= 40;
    const showDrop = dropDelta != null && dropDelta <= -40;
    const data = rawData.map((d, i) => ({
      ...d,
      value: Math.round(Number(d.value) || 0),
      isPeak: showPeak && peakMatchIndex != null && i + 1 === peakMatchIndex,
      isDrop: showDrop && dropMatchIndex != null && i + 1 === dropMatchIndex,
    }));
    const domain = corePayload.sparklineYDomain ?? [0, 100];
    const matchCount = Math.round(Number(corePayload.matchesTotal) || 0);
    const trendKey = corePayload.trendIndicator === "up" ? "trendUp" : corePayload.trendIndicator === "down" ? "trendDown" : "trendStable";
    const tldr = corePayload.tldrTrend != null ? corePayload.tldrTrend : t("dnaMinimal.tldrCoreTrend", { n: corePayload.trendN ?? 2, trend: t(`dnaMinimal.${trendKey}`) });
    const chartMax = corePayload.chartMaxValue;
    const chartMin = corePayload.chartMinValue;
    const chartRangeVal = corePayload.chartRange;

    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.coreTrendTitle")}</div>
          {matchCount > 0 && <p className="dnaInsightCardMeta">{t("dnaMinimal.lastNMatches", { n: matchCount })}</p>}
        </div>
        <div className="dnaInsightCardBody">
          {data.length > 1 ? (
            <>
              <div className="dnaInsightChartSubSurface">
                <div className="dnaInsightChartWrap">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <LineChart data={data} margin={{ top: 8, right: 8, bottom: 24, left: 28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} tickLine={{ stroke: "rgba(255,255,255,0.15)" }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                      <YAxis domain={domain} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} tickLine={{ stroke: "rgba(255,255,255,0.15)" }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} width={28} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-accent, rgba(255, 160, 100, 0.8))"
                        strokeWidth={1.5}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (!payload.isPeak && !payload.isDrop) return null;
                          const label = payload.isPeak ? t("dnaMinimal.chartPeak") : t("dnaMinimal.chartDrop");
                          return (
                            <g>
                              <circle cx={cx} cy={cy} r={4} fill="var(--color-accent, rgba(255, 160, 100, 0.9))" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                              <text x={cx} y={cy - 10} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={9}>{label}</text>
                            </g>
                          );
                        }}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {chartMax != null && chartMin != null && chartRangeVal != null && (
                  <div className="dnaInsightChartLegend">
                    <div>{t("dnaMinimal.chartLegendMaxShort", { value: chartMax.value })}</div>
                    <div>{t("dnaMinimal.chartLegendMinShort", { value: chartMin.value })}</div>
                    <div>{t("dnaMinimal.chartLegendRange", { range: chartRangeVal })}</div>
                  </div>
                )}
              </div>
              {corePayload.trendN > 0 && (
                <p className="dnaInsightTrendLine">
                  {t("dnaMinimal.trendSummaryLastN", {
                    trend: t(`dnaMinimal.${trendKey}`),
                    n: corePayload.trendN ?? 0,
                  })}
                </p>
              )}
            </>
          ) : (
            <div className="dnaInsightCardEmpty">{t("dnaMinimal.notEnoughMatchesForTrend")}</div>
          )}
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardTldr">{tldr}</p>
        </div>
      </div>
    );
  }

  return null;
}

const INSIGHT_TITLE_KEYS = { consistency: "insightConsistent", momentum: "insightBestGrowth", signature: "insightTrendingUp", weak_spot: "insightTrendingDown" };
const INSIGHT_TEXT_KEYS = {
  consistency: "insightStableAcross",
  momentum: "insightSpikeAfter",
  signature: "insightStrongFinish",
  weak_spot: "insightBelowAverage",
};
function insightTextParam(ins) {
  if (ins.type === "momentum" && ins.matchIndex != null) return { n: ins.matchIndex + 1 };
  return {};
}

/** Card 3 — Insights (max 3, prioritized) + How to improve (max 3). */
function CardInsightsImprove({ mode, genePayload, corePayload, t, lang }) {
  if (mode === "gene" && genePayload) {
    const candidates = buildGeneInsightCandidates(genePayload);
    const improveBy = getImproveBy(genePayload.dictionaryEntry, lang);
    const geneKey = genePayload.activeGeneKey;
    const improveFromI18n = geneKey
      ? [t(`dnaMinimal.gene_${geneKey}_improve1`), t(`dnaMinimal.gene_${geneKey}_improve2`), t(`dnaMinimal.gene_${geneKey}_improve3`)].filter(Boolean)
      : [];
    const improveList = (improveFromI18n.length >= 2 ? improveFromI18n : improveBy || []).slice(0, 3);
    const fallbackImprove = [t("dnaMinimal.improveTipGeneric1"), t("dnaMinimal.improveTipGeneric2")];

    const tldr = genePayload.tldrInsights || t("dnaMinimal.tldrGeneInsights");
    const nextFocus = geneKey ? t(`dnaMinimal.nextFocus_${geneKey}`) : null;
    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.insights")}</div>
        </div>
        <div className="dnaInsightCardBody">
          {candidates.length === 0 ? (
            <p className="dnaInsightCardEmpty">{t("dnaMinimal.noInsightsYet")}</p>
          ) : (
            <div className="dnaInsightCardsRow">
              {candidates.map((item, i) => {
                const title = t(`dnaMinimal.${item.titleKey}`);
                const text = t(`dnaMinimal.${item.textKey}`, item.params);
                return (
                  <div key={i} className="dnaInsightCardItem">
                    <span className="dnaInsightCardItemTitle">{title}</span>
                    <span className="dnaInsightCardItemText">{text}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.howToImprove")}</div>
          <ul className="dnaInsightCardList">
            {(improveList.length > 0 ? improveList : fallbackImprove).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          {nextFocus && (
            <p className="dnaInsightCardNextFocus">{t("dnaMinimal.nextFocusLabel")}: {nextFocus}</p>
          )}
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardTldr">{tldr}</p>
        </div>
      </div>
    );
  }

  if (mode === "core" && corePayload) {
    const contributionList = (corePayload.contributionList ?? []).slice(0, 4);
    const topShort = corePayload.topGeneKey ? (t(`dnaMinimal.gene_${corePayload.topGeneKey}_short`) || t(`dnaMinimal.gene_${corePayload.topGeneKey}_label`)) : "—";
    const weakShort = corePayload.weakGeneKey ? (t(`dnaMinimal.gene_${corePayload.weakGeneKey}_short`) || t(`dnaMinimal.gene_${corePayload.weakGeneKey}_label`)) : "—";
    const tldr = t("dnaMinimal.tldrCoreInsights", { top: topShort, weak: weakShort });
    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.insights")}</div>
        </div>
        <div className="dnaInsightCardBody">
          {contributionList.length > 0 && (
            <>
              <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.geneContribution")}</div>
              <div className="dnaInsightContributionBars">
                {contributionList.map((c) => (
                  <div key={c.key} className="dnaInsightContributionRow">
                    <span className="dnaInsightContributionLabel">{t(`dnaMinimal.gene_${c.key}_label`) || c.key}</span>
                    <span className="dnaInsightContributionPct dnaMono">{Math.round(Number(c.sharePct) || 0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardTldr">{tldr}</p>
        </div>
      </div>
    );
  }

  if (mode === "core") {
    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.insights")}</div>
        </div>
        <div className="dnaInsightCardBody">
          <p className="dnaInsightCardHint">{t("dnaMinimal.panelTip")}</p>
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardTldr">{t("dnaMinimal.tldrCoreInsights", { top: "—", weak: "—" })}</p>
        </div>
      </div>
    );
  }

  return null;
}

/** Card 4 — Method (accordion) + Data quality. */
function CardMethodData({ mode, genePayload, corePayload, t }) {
  if (mode === "gene" && genePayload) {
    const reasons = genePayload.reasons ?? {};
    const coreSignals = reasons.coreSignals ?? genePayload.dictionaryEntry?.coreSignals ?? [];
    const proxySignals = reasons.proxySignals ?? genePayload.dictionaryEntry?.proxySignals ?? [];
    const computedFrom = getComputedFrom(genePayload.dictionaryEntry, genePayload.lang);
    const hasSignals = (Array.isArray(coreSignals) && coreSignals.length > 0) || (Array.isArray(proxySignals) && proxySignals.length > 0);
    const hasMethod = hasSignals || (Array.isArray(computedFrom) && computedFrom.length > 0);
    const contextLabelLast = reasons.contextLabelLast ?? genePayload.contextLabelLast ?? null;
    const proxyOnlyLast = reasons.proxyOnlyLast ?? genePayload.proxyOnlyLast ?? false;
    const proxyOnlyX = genePayload.proxyOnlyCount ?? reasons.proxyOnlyCount ?? null;
    const proxyOnlyY = genePayload.matchesTotal ?? genePayload.coverage?.matchesTotal ?? null;
    const tldr = genePayload.tldrMethod || t("dnaMinimal.tldrGeneMethod");

    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          {!hasMethod && <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.method")}</div>}
        </div>
        <div className="dnaInsightCardBody">
          {hasMethod ? (
            <Accordion title={t("dnaMinimal.method")}>
              {hasSignals ? (
                <>
                  {Array.isArray(coreSignals) && coreSignals.length > 0 && (
                    <div className="dnaInsightSignalBlock">
                      <span className="dnaInsightSignalBlockLabel">{t("dnaMinimal.coreSignalsLabel")}</span>
                      <div className="dnaInsightSignalChips">
                        {coreSignals.slice(0, 6).map((label, i) => (
                          <span key={i} className="dnaInsightSignalChip">{typeof label === "string" ? label : label?.label ?? String(label)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(proxySignals) && proxySignals.length > 0 && (
                    <div className="dnaInsightSignalBlock">
                      <span className="dnaInsightSignalBlockLabel">{t("dnaMinimal.proxySignalsLabel")}</span>
                      <div className="dnaInsightSignalChips">
                        {proxySignals.slice(0, 4).map((label, i) => (
                          <span key={i} className="dnaInsightSignalChip">{typeof label === "string" ? label : label?.label ?? String(label)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="dnaInsightCardMethodShort">{t("dnaMinimal.contextMatchLabel")}</p>
                </>
              ) : (
                <>
                  <div className="dnaInsightSignalChips">
                    {(computedFrom || []).map((item, i) => (
                      <span key={i} className="dnaInsightSignalChip">{item}</span>
                    ))}
                  </div>
                  <p className="dnaInsightCardMethodShort">{t("dnaMinimal.contextMatchLabel")}</p>
                </>
              )}
            </Accordion>
          ) : (
            <>
              <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.method")}</div>
              <p className="dnaInsightCardMethodShort">{t("dnaMinimal.methodShort")}</p>
            </>
          )}
          {(contextLabelLast != null || proxyOnlyLast) && (
            <div className="dnaInsightReasonBlock">
              {contextLabelLast != null && <p>{t("dnaMinimal.reasonContext", { context: contextLabelLast })}</p>}
              {proxyOnlyLast && <p>{t("dnaMinimal.reasonProxyOnly")}</p>}
            </div>
          )}
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.dataQuality")}</div>
          <div className="dnaInsightDataQuality">
            <div className="dnaInsightQualityBarWrap">
              <div className="dnaInsightQualityBar">
                <div className="dnaInsightQualityBarFill" style={{ width: `${Math.round(Number(genePayload.coveragePct) || 0)}%` }} />
              </div>
              <span className="dnaInsightQualityBarLabel">{t("dnaMinimal.coveragePct", { pct: Math.round(Number(genePayload.coveragePct) || 0) })}</span>
            </div>
            <div className="dnaInsightQualityRow">
              <span>{t("dnaMinimal.matchesInSlice")}:</span>
              <span className="dnaMono">{genePayload.matchesTotal ?? 0}</span>
            </div>
            <div className="dnaInsightQualityRow">
              <span>{t("dnaMinimal.telemetryCoverage")}:</span>
              <span className="dnaMono">{genePayload.telemetryMatches ?? 0}/8</span>
            </div>
            {proxyOnlyX != null && proxyOnlyY != null && (
              <div className="dnaInsightQualityRow">
                <span>{t("dnaMinimal.proxyOnlyMatches", { x: proxyOnlyX, y: proxyOnlyY })}</span>
              </div>
            )}
            {genePayload.hasLowData && <p className="dnaInsightQualityWarn">{t("dnaMinimal.lowDataWarn")}</p>}
          </div>
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardTldr">{tldr}</p>
        </div>
      </div>
    );
  }

  if (mode === "core" && corePayload) {
    const telemetry = corePayload.telemetryMatches ?? 0;
    const tldr = t("dnaMinimal.tldrCoreMethod", { telemetry, n: 8 });
    return (
      <div className="dnaInsightCardContent">
        <div className="dnaInsightCardHeader">
          <div className="dnaInsightCardSectionTitle">{t("dnaMinimal.dataQuality")}</div>
        </div>
        <div className="dnaInsightCardBody">
          <div className="dnaInsightDataQuality">
            <div className="dnaInsightQualityRow">
              <span>{t("dnaMinimal.matchesInSlice")}:</span>
              <span className="dnaMono">{corePayload.matchesTotal ?? 0}</span>
            </div>
            <div className="dnaInsightQualityRow">
              <span>{t("dnaMinimal.telemetryCoverage")}:</span>
              <span className="dnaMono">{corePayload.telemetryMatches ?? 0}/8</span>
            </div>
            {corePayload.isPartialCoverage && <p className="dnaInsightQualityWarn">{t("dnaMinimal.partialProxy")}</p>}
          </div>
        </div>
        <div className="dnaInsightCardFooter">
          <p className="dnaInsightCardTldr">{tldr}</p>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * DnaInsightCarousel — 4 cards, one visible; arrows, keyboard, swipe; reset on gene/core change.
 * Reusable for gene, core; later squad/compare.
 */
export default function DnaInsightCarousel({
  mode = "gene",
  geneKey,
  genePayload,
  coreData,
}) {
  const { t, lang } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef(null);

  const isGene = mode === "gene";
  const isCore = mode === "core";

  const geneData = useGeneInsightData(
    isGene && genePayload
      ? {
          activeGeneKey: geneKey,
          profile: genePayload.profile ?? {},
          coverage: genePayload.coverage ?? {},
          reasons: genePayload.reasons ?? {},
        }
      : { activeGeneKey: null, profile: {}, coverage: {}, reasons: {} }
  );

  const coreDataComputed = useCoreInsightData(
    isCore && coreData ? { profile: coreData.profile ?? {}, genes: coreData.genes ?? [], profileGenes: coreData.profileGenes ?? [] } : { profile: {}, genes: [], profileGenes: [] }
  );

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_MEDIA);
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
  }, [geneKey, mode]);

  const go = useCallback((delta) => {
    setCurrentIndex((prev) => Math.max(0, Math.min(CARD_COUNT - 1, prev + delta)));
  }, []);

  const goPrev = useCallback(() => go(-1), [go]);
  const goNext = useCallback(() => go(1), [go]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const start = touchStartX.current;
    if (start == null) return;
    touchStartX.current = null;
    const end = e.changedTouches?.[0]?.clientX;
    if (end == null) return;
    const diff = start - end;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  }, [goPrev, goNext]);

  const hasContent = (isGene && (geneKey || genePayload?.geneLabel)) || (isCore && coreData);
  if (!hasContent) {
    return (
      <aside className="dnaInsightCarousel" aria-label={t("dnaMinimal.selectGene")}>
        <div className="dnaInsightCarouselEmpty">{t("dnaMinimal.selectGene")}</div>
      </aside>
    );
  }

  const genePayloadMerged = isGene && genePayload ? { ...genePayload, ...geneData, activeGeneKey: geneKey, highlights: genePayload.reasons?.perGene?.[geneKey]?.highlights ?? [], dictionaryEntry: genePayload.dictionaryEntry, lang } : null;
  const corePayloadMerged = isCore ? { ...coreDataComputed } : null;

  const ariaLabel = isGene ? t("dnaMinimal.geneDetailsAria") : t("dnaMinimal.coreDetailsAria");

  const isChartCardActive = currentIndex === 1;

  return (
    <aside
      className={`dnaInsightCarousel${isChartCardActive ? " dnaInsightCarousel--chartActive" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="dnaInsightCarouselInner">
        <button type="button" className="dnaInsightCarouselArrowZone" onClick={goPrev} aria-label={t("dnaMinimal.carouselPrev")} disabled={currentIndex === 0}>
          <span className="dnaInsightCarouselArrow dnaInsightCarouselArrow--prev" aria-hidden>←</span>
        </button>
        <div className="dnaInsightCarouselTrackWrapper">
          <div className={`dnaInsightCarouselTrack ${reducedMotion ? "dnaInsightCarouselTrack--reduced" : ""}`} style={{ "--slide-duration": `${SLIDE_DURATION_MS}ms` }}>
            <div className="dnaInsightCarouselStrip" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`dnaInsightCardSlot${i === currentIndex ? " isActive" : ""}`} aria-hidden={i !== currentIndex}>
                  <div className="dnaInsightCardSlotInner">
                    <div className="dnaInsightCard">
                      {i === 0 && <CardOverview mode={mode} genePayload={genePayloadMerged} corePayload={corePayloadMerged} t={t} lang={lang} />}
                      {i === 1 && <CardTrend mode={mode} genePayload={genePayloadMerged} corePayload={corePayloadMerged} t={t} />}
                      {i === 2 && <CardInsightsImprove mode={mode} genePayload={genePayloadMerged} corePayload={corePayloadMerged} t={t} lang={lang} />}
                      {i === 3 && <CardMethodData mode={mode} genePayload={genePayloadMerged} corePayload={corePayloadMerged} t={t} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button type="button" className="dnaInsightCarouselArrowZone" onClick={goNext} aria-label={t("dnaMinimal.carouselNext")} disabled={currentIndex === CARD_COUNT - 1}>
          <span className="dnaInsightCarouselArrow dnaInsightCarouselArrow--next" aria-hidden>→</span>
        </button>
      </div>
    </aside>
  );
}
