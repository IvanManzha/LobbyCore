import React from "react";

const MAX_MATCHES = 10;

/**
 * List of last 5–10 matches: date/time, map, placement, kills. Click selects match.
 */
export default function MatchList({
  matches = [],
  matchHistory = [],
  selectedMatchId,
  onSelectMatch,
}) {
  const source = matchHistory.length ? matchHistory : matches;
  const list = source.slice(0, MAX_MATCHES);

  if (list.length === 0) {
    return (
      <div className="dnaMatchListWrap">
        <div className="dnaMatchListTitle">Последние матчи</div>
        <div className="dnaEmpty">Нет матчей в срезе.</div>
      </div>
    );
  }

  return (
    <div className="dnaMatchListWrap">
      <div className="dnaMatchListTitle">Последние матчи</div>
      <ul className="dnaMatchList">
        {list.map((m) => {
          const id = m.matchId || m.id;
          const isSelected = id === selectedMatchId;
          const dateStr = m.startedAt || m.dateISO;
          const dateLabel = dateStr
            ? new Date(dateStr).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "—";
          const mapName = m.mapName || "";
          const placement = m.summary?.placement ?? m.placement;
          const kills = m.summary?.kills ?? m.kills ?? "—";

          return (
            <li key={id}>
              <button
                type="button"
                className={`dnaMatchRow ${isSelected ? "isActive" : ""}`}
                onClick={() => onSelectMatch?.(id)}
              >
                <div className="dnaMatchRowLeft">
                  <span className="dnaMatchRowDate">{dateLabel}</span>
                  <span className="dnaMatchRowLabel">{m.label || `Match ${id}`}</span>
                  {mapName && <span className="dnaMatchRowMap">{mapName}</span>}
                </div>
                <div className="dnaMatchRowRight">
                  {placement != null && <span className="dnaMono">#{placement}</span>}
                  {kills != null && kills !== "—" && <span className="dnaMono">{kills}K</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
