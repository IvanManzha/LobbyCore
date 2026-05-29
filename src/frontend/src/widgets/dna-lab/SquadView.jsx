import React, { useMemo, useState, useEffect } from "react";
import { getProfile, getLeaderboard } from "@/services/dnaApi";
import DnaRadarChart from "./DnaRadarChart";
import GeneGarden from "./GeneGarden";
import { GENES } from "./mock/dnaMock";
import { useTranslation } from "@/contexts/LanguageContext";

const GENE_KEYS = GENES.map((g) => g.key);
const MAX_SQUAD_SIZE = 4;

/**
 * Aggregate genes from multiple profiles (average per gene).
 */
function aggregateProfiles(profiles) {
  const valid = profiles.filter((p) => p?.genes?.length > 0);
  if (valid.length === 0) return [];

  return GENE_KEYS.map((key) => {
    let sum = 0;
    let count = 0;
    valid.forEach((p) => {
      const g = p.genes.find((x) => x.key === key);
      if (g?.value != null && !Number.isNaN(g.value)) {
        sum += Math.max(0, Math.min(100, Number(g.value)));
        count += 1;
      }
    });
    const value = count > 0 ? Math.round(sum / count) : null;
    return { key, value, label: GENES.find((x) => x.key === key)?.label ?? key };
  }).filter((g) => g.value != null);
}

/**
 * Sprint 6: Squad DNA — aggregate DNA of squad members.
 */
export default function SquadView({
  profileMe = {},
  squadMemberIds = [],
  onSquadChange,
  dictionary = [],
  activeGeneKey,
  onSelectGene,
  seasonId,
  useDnaTest,
}) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [addOpen, setAddOpen] = useState(false);

  const playerId = profileMe?.playerId ?? "me";

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(seasonId, { useDnaTest })
      .then((data) => {
        if (!cancelled) setLeaderboard(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [seasonId, useDnaTest]);

  useEffect(() => {
    const ids = [...new Set(squadMemberIds)].filter(Boolean);
    if (ids.length === 0) {
      setProfiles({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      ids.map((id) =>
        getProfile(id, seasonId, { useDnaTest })
          .then((res) => ({ id, profile: res }))
          .catch(() => ({ id, profile: null }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      results.forEach(({ id, profile }) => {
        map[id] = profile;
      });
      setProfiles(map);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [squadMemberIds.join(","), seasonId, useDnaTest]);

  const allProfiles = useMemo(() => {
    const list = squadMemberIds
      .filter(Boolean)
      .map((id) => {
        if ((id || "").toLowerCase() === (playerId || "").toLowerCase()) return profileMe;
        return profiles[id] || null;
      })
      .filter(Boolean);
    return list;
  }, [squadMemberIds, playerId, profileMe, profiles]);

  const aggregateGenes = useMemo(() => aggregateProfiles(allProfiles), [allProfiles]);

  const aggregateProfile = useMemo(
    () => ({
      playerId: "squad",
      genes: aggregateGenes,
      coverage: { matchesTotal: allProfiles.reduce((a, p) => a + (p?.coverage?.matchesTotal ?? 0), 0) },
    }),
    [aggregateGenes, allProfiles]
  );

  const genes = useMemo(
    () =>
      GENES.map((g) => ({
        ...g,
        shortLabel: g.shortLabel ?? g.label?.slice(0, 4) ?? g.key?.slice(0, 4),
      })),
    []
  );

  const hasEnoughData = allProfiles.length > 0 && aggregateGenes.length >= 3;
  const canAdd = squadMemberIds.length < MAX_SQUAD_SIZE;
  const opponents = leaderboard.filter(
    (e) => !squadMemberIds.some((id) => (e.playerId || e.playerName || "").toLowerCase() === (id || "").toLowerCase())
  );

  const addMember = (id) => {
    if (!id || !canAdd) return;
    const next = [...squadMemberIds, id].slice(0, MAX_SQUAD_SIZE);
    onSquadChange?.(next);
    setAddOpen(false);
  };

  const removeMember = (id) => {
    const next = squadMemberIds.filter((x) => (x || "").toLowerCase() !== (id || "").toLowerCase());
    if (next.length >= 1) onSquadChange?.(next);
  };

  if (squadMemberIds.length === 0) {
    return (
      <div className="squadView squadViewEmpty">
        <h3>{t("dnaLab.squadTitle")}</h3>
        <p>{t("dnaLab.squadAddYourselfHint")}</p>
        <button type="button" className="squadViewAddFirst" onClick={() => onSquadChange?.([playerId])}>
          {t("dnaLab.squadStartWithMe")}
        </button>
      </div>
    );
  }

  if (loading && allProfiles.length === 0) {
    return (
      <div className="squadView squadViewLoading">
        <p>{t("dnaLab.squadLoading")}</p>
      </div>
    );
  }

  return (
    <div className={`genesView squadView ${hasEnoughData ? "hasData" : ""}`}>
      <div className="squadViewHeader">
        <div className="squadViewMembers">
          <span className="squadViewMembersLabel">{t("dnaLab.squadLabel")}</span>
          {squadMemberIds.map((id) => {
            const isMe = (id || "").toLowerCase() === (playerId || "").toLowerCase();
            const p = isMe ? profileMe : profiles[id];
            const name = p?.playerId ?? id ?? "?";
            const canRemove = squadMemberIds.length > 1;
            return (
              <span key={id} className="squadViewMemberChip">
                <span className="squadViewMemberName">{name}</span>
                {canRemove && (
                  <button
                    type="button"
                    className="squadViewMemberRemove"
                    onClick={() => removeMember(id)}
                    aria-label={t("dnaLab.squadRemoveMember", { name })}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          {canAdd && (
            <div className={`squadViewAddDropdown ${addOpen ? "isOpen" : ""}`}>
              <button
                type="button"
                className="squadViewAddBtn"
                onClick={() => setAddOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={addOpen}
              >
                {t("dnaLab.squadAddBtn")}
              </button>
              {addOpen && (
                <ul className="squadViewAddList" role="listbox">
                  {opponents.slice(0, 12).map((e) => {
                    const id = e.playerId ?? e.playerName ?? "";
                    return (
                      <li key={id}>
                        <button type="button" role="option" onClick={() => addMember(id)}>
                          {e.playerName ?? e.playerId ?? id}
                        </button>
                      </li>
                    );
                  })}
                  {opponents.length === 0 && <li className="squadViewAddEmpty">{t("dnaLab.squadNoPlayers")}</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {hasEnoughData ? (
        <>
          <div className="squadViewRadarStage dnaRadarStage">
            <DnaRadarChart
              profile={aggregateProfile}
              highlightedGeneKey={activeGeneKey}
            />
          </div>
          <div className="squadViewLegend">{t("dnaLab.squadAggregateLegend", { n: allProfiles.length })}</div>
          <div className="genesViewMain squadViewMain">
            <div className="genesViewLeft">
              <GeneGarden
                genes={genes}
                profileGenes={aggregateGenes}
                activeKey={activeGeneKey}
                onSelectGene={onSelectGene}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="squadViewEmptyData">
          <p>{t("dnaLab.squadAddMembersHint")}</p>
          <p className="squadViewHint">{t("dnaLab.squadAtLeastOneHint")}</p>
        </div>
      )}
    </div>
  );
}
