import React, { useMemo } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Compact inspector for selected axis in Duel mode.
 * Shows: gene name, values, who wins, duel bar, hint.
 */
export default function AxisInspector({
  geneKey,
  valueMe,
  valueOpp,
  geneLabel,
  hint,
  lowSample = false,
  seriesMe = null,
  seriesOpp = null,
}) {
  const { t } = useTranslation();
  const vMe = valueMe != null ? Number(valueMe) : null;
  const vOpp = valueOpp != null ? Number(valueOpp) : null;
  const delta = vMe != null && vOpp != null ? vMe - vOpp : null;

  const stabilityLabel = useMemo(() => {
    if (!Array.isArray(seriesMe) || seriesMe.length < 3) return null;
    const vals = seriesMe.map((n) => Number(n ?? 0));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length;
    const std = Math.sqrt(variance);
    if (std <= 4) return "Высокая стабильность";
    if (std <= 8) return "Средняя стабильность";
    return "Переменный показатель";
  }, [seriesMe]);

  const recommendation = useMemo(() => {
    if (vMe == null) return null;
    if (geneKey === "combat") {
      if (vMe >= 70) return "Продолжай давить в бою, но следи за позиционированием и выживаемостью.";
      if (vMe <= 40) return "Фокусируйся на базовой механике и разборе своих дуэлей.";
      return "Укрепляй боевую стабильность через отработку типичных сценариев.";
    }
    if (geneKey === "pressure") {
      if (vMe >= 70) return "Инициируй, но старайся заходить в драки вместе с командой.";
      if (vMe <= 40) return "Добавь инициативы: первые выстрелы и гранаты часто решают исход файта.";
      return "Поддерживай темп, выбирая моменты, когда команда готова подхватить.";
    }
    if (geneKey === "survival") {
      if (vMe >= 70) return "Ты хорошо доживаешь до поздних кругов — усиливай влияние в бою.";
      if (vMe <= 40) return "Работай над позиционированием и таймингом входа в файты.";
      return "Старайся балансировать между агрессией и сохранением позиции.";
    }
    if (geneKey === "teamwork") {
      if (vMe >= 70) return "Продолжай играть вокруг команды — коммуникация и трейды работают.";
      if (vMe <= 40) return "Чаще играй рядом с тиммейтами и фокусируйся на трейдах.";
      return "Фиксируй ключевые моменты раундов и обсуждай их с командой.";
    }
    return null;
  }, [geneKey, vMe]);

  const hasLowSample = lowSample || (Array.isArray(seriesMe) && seriesMe.length < 5);

  return (
    <aside className="axisInspector duelAxisInspector">
      <div className="axisInspectorCard">
        <h3 className="axisInspectorTitle">{geneKey ? (t(`dnaMinimal.gene_${geneKey}_label`) || geneLabel) : (geneLabel ?? geneKey ?? "—")}</h3>

        <div className="axisInspectorValues">
          <div className="axisInspectorRow">
            <span className="axisInspectorLabel axisInspectorLabelMe">{t("dnaLab.you")}</span>
            <span className="axisInspectorValue dnaMono">{vMe != null ? vMe : "—"}</span>
          </div>
          <div className="axisInspectorRow">
            <span className="axisInspectorLabel axisInspectorLabelOpp">{t("dnaLab.opponent")}</span>
            <span className="axisInspectorValue dnaMono">{vOpp != null ? vOpp : "—"}</span>
          </div>
        </div>

        {delta != null && (
          <div
            className={`axisInspectorWinner ${delta >= 0 ? "axisInspectorWinnerMe" : "axisInspectorWinnerOpp"}`}
          >
            {delta > 0
              ? `Побеждает: ты (+${delta})`
              : delta < 0
                ? `Побеждает: соперник (+${Math.abs(delta)})`
                : "Равны"}
          </div>
        )}

        <div className="axisInspectorDuelBar">
          <div className="axisInspectorBarRow">
            <span className="axisInspectorBarLabel">Ты</span>
            <div className="axisInspectorBarTrack">
              <div
                className="axisInspectorBarFill axisInspectorBarFillMe"
                style={{ width: `${vMe ?? 0}%` }}
              />
            </div>
            <span className="axisInspectorBarVal">{vMe ?? "—"}</span>
          </div>
          <div className="axisInspectorBarRow">
            <span className="axisInspectorBarLabel">Соперник</span>
            <div className="axisInspectorBarTrack">
              <div
                className="axisInspectorBarFill axisInspectorBarFillOpp"
                style={{ width: `${vOpp ?? 0}%` }}
              />
            </div>
            <span className="axisInspectorBarVal">{vOpp ?? "—"}</span>
          </div>
        </div>

        {hint && <p className="axisInspectorHint">{hint}</p>}
        {stabilityLabel && <p className="axisInspectorHint axisInspectorHintSecondary">{stabilityLabel}</p>}
        {recommendation && (
          <p className="axisInspectorRecommendation">
            {recommendation}
          </p>
        )}
        {hasLowSample && (
          <span className="axisInspectorBadge axisInspectorBadgeLowSample">
            {t("dnaLab.lowSample")}
          </span>
        )}
        {Array.isArray(seriesMe) && seriesMe.length >= 2 && (
          <div className="axisInspectorSparkline">
            <svg viewBox="0 0 80 24" preserveAspectRatio="none" className="axisInspectorSparklineSvg">
              {(() => {
                const vals = seriesMe.map((n) => Number(n ?? 0));
                const min = Math.min(...vals, 0);
                const max = Math.max(...vals, 100);
                const span = max - min || 1;
                const stepX = 80 / Math.max(vals.length - 1, 1);
                const points = vals
                  .map((v, i) => {
                    const x = i * stepX;
                    const norm = (v - min) / span;
                    const y = 20 - norm * 18;
                    return `${x},${y}`;
                  })
                  .join(" ");
                return <polyline className="axisInspectorSparklineLine" points={points} />;
              })()}
            </svg>
          </div>
        )}
      </div>
    </aside>
  );
}
