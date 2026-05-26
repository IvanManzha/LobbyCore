import React, { useMemo, useState } from "react";
import OctagonDuelRadar from "./OctagonDuelRadar";
import AxisInspector from "./AxisInspector";
import {
  aggregateByTimeSlice,
  TIME_SLICE_YEAR,
  TIME_SLICE_MONTH,
  TIME_SLICE_WEEK,
} from "./utils/periodUtils";
import { pickHint } from "./compareHints";
import { GENES } from "./mock/dnaMock";
import { useTranslation } from "../../contexts/LanguageContext";

/**
 * Duel mode: your 8-gon vs opponent's 8-gon.
 * Time slice (year/month/week), opponent dropdown, axis inspector on click.
 */
export default function DuelView({
  profile = {},
  profileB = null,
  profileBLoading = false,
  leaderboard = [],
  leaderboardLoading = false,
  onSelectOpponent,
  seasonId,
  useDnaTest,
}) {
  const { t } = useTranslation();
  const [timeSlice, setTimeSlice] = useState(TIME_SLICE_YEAR);
  const [selectedAxis, setSelectedAxis] = useState(null);

  const matchesMe = profile?.matchHistory?.length ? profile.matchHistory : profile?.matches ?? [];
  const matchesOpp = profileB?.matchHistory?.length ? profileB.matchHistory : profileB?.matches ?? [];

  const aggMe = useMemo(
    () => aggregateByTimeSlice(matchesMe, timeSlice),
    [matchesMe, timeSlice]
  );

  const aggOpp = useMemo(
    () => (profileB ? aggregateByTimeSlice(matchesOpp, timeSlice) : null),
    [matchesOpp, timeSlice, profileB]
  );

  const genesMe = useMemo(() => {
    const v = aggMe.values;
    if (v && Object.keys(v).length > 0) return v;
    const fallback = {};
    (profile?.genes ?? []).forEach((g) => {
      if (g.value != null) fallback[g.key] = g.value;
    });
    return Object.keys(fallback).length > 0 ? fallback : null;
  }, [aggMe.values, profile?.genes]);

  const genesOpp = useMemo(() => {
    if (!aggOpp) return null;
    const v = aggOpp.values;
    if (v && Object.keys(v).length > 0) return v;
    const fallback = {};
    (profileB?.genes ?? []).forEach((g) => {
      if (g.value != null) fallback[g.key] = g.value;
    });
    return Object.keys(fallback).length > 0 ? fallback : null;
  }, [aggOpp, profileB?.genes]);

  const opponents = useMemo(() => {
    const myId = (profile?.playerId ?? "").toString().toLowerCase();
    const list = (leaderboard || []).filter(
      (e) => (e.playerId || e.playerName || "").toString().toLowerCase() !== myId
    );
    if (profileB?.playerId) {
      const oppId = profileB.playerId.toString().toLowerCase();
      const found = list.some(
        (e) => (e.playerId || e.playerName || "").toString().toLowerCase() === oppId
      );
      if (!found) {
        return [
          { playerId: profileB.playerId, playerName: profileB.playerId },
          ...list,
        ];
      }
    }
    return list;
  }, [leaderboard, profile?.playerId, profileB?.playerId]);

  const activeGene = selectedAxis ? GENES.find((g) => g.key === selectedAxis) : null;
  const geneLabel = activeGene?.label ?? selectedAxis;
  const valueMe = genesMe?.[selectedAxis] ?? null;
  const valueOpp = genesOpp?.[selectedAxis] ?? null;
  const diff = valueMe != null && valueOpp != null ? valueMe - valueOpp : null;
  const lowSampleMe = aggMe.lowSample;
  const lowSampleOpp = aggOpp?.lowSample ?? false;
  const hint = selectedAxis ? pickHint(selectedAxis, diff ?? 0, lowSampleMe || lowSampleOpp) : null;

  if (profileBLoading || leaderboardLoading) {
    return (
      <div className="duelView duelViewLoading">
        <p>{profileBLoading ? "Загрузка соперника…" : "Загрузка списка игроков…"}</p>
      </div>
    );
  }

  if (!profileB && opponents.length === 0) {
    return (
      <div className="duelView duelViewEmpty">
        <h3>Выбери соперника</h3>
        <p>Нет других игроков в лидерборде для этого сезона.</p>
      </div>
    );
  }

  if (!profileB) {
    return (
      <div className="duelView duelViewSelectOpponent">
        <h3>Выбери соперника</h3>
        <p>Выбери игрока из списка, чтобы сравнить 8-угольники.</p>
        <div className="duelOpponentDropdown">
          <select
            className="duelOpponentSelect"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) onSelectOpponent?.(id);
            }}
            aria-label={t("dnaLab.opponent")}
          >
            <option value="">{t("dnaLab.selectOpponent")}</option>
            {opponents.map((e) => {
              const id = e.playerId ?? e.playerName ?? "";
              const name = e.playerName ?? e.playerId ?? id;
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
        <div className="duelViewOctagon duelViewOctagonSolo">
          <OctagonDuelRadar
            genesMe={genesMe ?? {}}
            genesOpp={null}
            selectedAxis={selectedAxis}
            onSelectAxis={setSelectedAxis}
            hasOpponent={false}
          />
        </div>
        <div className="duelLegend">
          <span className="duelLegendItem duelLegendMe">
            <span className="duelLegendDot duelLegendDotMe" /> {t("dnaLab.you")}
          </span>
        </div>
        {selectedAxis && (
          <div className="duelViewInspector">
            <AxisInspector
              geneKey={selectedAxis}
              valueMe={valueMe}
              valueOpp={null}
              geneLabel={geneLabel}
              hint={hint}
              lowSample={lowSampleMe}
            />
          </div>
        )}
      </div>
    );
  }

  const hasNoDataB = !profileB?.genes?.length && !(profileB?.matchHistory?.length || profileB?.matches?.length);

  if (hasNoDataB) {
    return (
      <div className="duelView duelViewEmpty">
        <h3>{t("dnaLab.opponentNoDna")}</h3>
        <p>{t("dnaLab.selectAnotherOpponent")}</p>
      </div>
    );
  }

  return (
    <div className={`duelView duelViewReady ${selectedAxis ? "hasInspector" : ""}`}>
      <div className="duelViewHeader">
        <div className="duelTimeSliceSegmented">
          <button
            type="button"
            className={`duelTimeSliceBtn ${timeSlice === TIME_SLICE_YEAR ? "isActive" : ""}`}
            onClick={() => setTimeSlice(TIME_SLICE_YEAR)}
          >
            {t("dnaLab.periodYear")}
          </button>
          <button
            type="button"
            className={`duelTimeSliceBtn ${timeSlice === TIME_SLICE_MONTH ? "isActive" : ""}`}
            onClick={() => setTimeSlice(TIME_SLICE_MONTH)}
          >
            {t("dnaLab.periodMonth")}
          </button>
          <button
            type="button"
            className={`duelTimeSliceBtn ${timeSlice === TIME_SLICE_WEEK ? "isActive" : ""}`}
            onClick={() => setTimeSlice(TIME_SLICE_WEEK)}
          >
            {t("dnaLab.periodWeek")}
          </button>
        </div>
        <div className="duelOpponentDropdown">
          <label className="duelOpponentLabel">{t("dnaLab.opponent")}:</label>
          <select
            className="duelOpponentSelect"
            value={profileB?.playerId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id) onSelectOpponent?.(id);
            }}
            aria-label={t("dnaLab.opponent")}
          >
            {opponents.map((e) => {
              const id = e.playerId ?? e.playerName ?? "";
              const name = e.playerName ?? e.playerId ?? id;
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="duelLegend">
        <span className="duelLegendItem duelLegendMe">
          <span className="duelLegendDot duelLegendDotMe" /> {t("dnaLab.you")}
        </span>
        <span className="duelLegendItem duelLegendOpp">
          <span className="duelLegendDot duelLegendDotOpp" /> {t("dnaLab.opponent")}
        </span>
      </div>

      <div className="duelViewMain">
        <div className="duelViewOctagon">
          <OctagonDuelRadar
            genesMe={genesMe ?? {}}
            genesOpp={genesOpp}
            selectedAxis={selectedAxis}
            onSelectAxis={setSelectedAxis}
            hasOpponent={!!profileB}
          />
        </div>
        {selectedAxis && (
          <div className="duelViewInspector">
            <AxisInspector
              geneKey={selectedAxis}
              valueMe={valueMe}
              valueOpp={valueOpp}
              geneLabel={geneLabel}
              hint={hint}
              lowSample={lowSampleMe || lowSampleOpp}
            />
          </div>
        )}
      </div>

      {(aggMe.lowSample || aggOpp?.lowSample) && (
        <span className="duelViewBadge duelViewBadgeLowSample">{t("dnaLab.lowSample")}</span>
      )}
    </div>
  );
}
