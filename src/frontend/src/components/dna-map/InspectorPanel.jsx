import React, { useState } from "react";
import EventInspector from "./EventInspector";
import FightsPanel from "./FightsPanel";
import "./InspectorPanel.css";

export default function InspectorPanel(props) {
  const {
    session,
    loading,
    error,
    selectedEventId,
    selectedFightId,
    onSelectEvent,
    onSelectFight,
    compareEnabled,
    layers,
    eventFilters,
    onLayersChange,
    onEventFiltersChange,
    onResetView,
    onFocusDeath,
    onFocusPoint,
    matchId,
    primaryId,
    secondaryId,
    onMatchChange,
    onPrimaryChange,
    onSecondaryChange,
    onCompareToggle,
    useDnaTest,
    onUseDnaTestChange,
    devMatchId,
    devPlayerId,
    onDevMatchIdChange,
    onDevPlayerIdChange,
    onLoadLastMatch,
    onLoadSession,
    sourceFile,
    onSourceFileChange,
    fileStoreMatches = [],
    loadingFileStoreList,
    onLoadFileStoreMatches,
    onFileStoreMatchSelect,
    isolateFightId,
    onIsolateFight,
  } = props;

  const [devOpen, setDevOpen] = useState(false);

  const selectedEvent = session?.events?.find((e) => e.id === selectedEventId) ?? null;
  const participants = session?.entities ? [session.entities.primary, session.entities.secondary].filter(Boolean) : [];
  const matchLabel = session?.match
    ? (session.match.mapName ? `${session.match.mapName}` : "Матч")
    : "";

  const EVENT_TYPES = [
    "LANDING",
    "KILL",
    "KNOCK",
    "DEATH",
    "REVIVE",
    "DAMAGE",
    "VEHICLE_ENTER",
    "VEHICLE_EXIT",
    "HEAL",
    "BOOST",
    "ZONE_DAMAGE",
  ];

  return (
    <div className="dna-inspector-panel">
      <div className="dna-inspector-header">DNA Map Studio</div>

      {error && (
        <div className="dna-inspector-error" role="alert">
          {error}
        </div>
      )}

      <section className="dna-inspector-section">
        <label className="dna-inspector-label">Матч</label>
        <div className="dna-inspector-match-row">
          <span className="dna-inspector-match-label">
            {matchLabel || (matchId ? `${matchId.slice(0, 8)}…` : "—")}
          </span>
          <button
            type="button"
            className="dna-inspector-btn"
            onClick={onLoadLastMatch}
            disabled={loading}
          >
            Последний матч
          </button>
          {matchId && (
            <button
              type="button"
              className="dna-inspector-btn"
              onClick={onLoadSession}
              disabled={loading}
            >
              Обновить
            </button>
          )}
        </div>
      </section>

      <section className="dna-inspector-section">
        <label className="dna-inspector-label">Матчи из хранилища</label>
        <div className="dna-inspector-match-row">
          <button
            type="button"
            className="dna-inspector-btn"
            onClick={onLoadFileStoreMatches}
            disabled={loadingFileStoreList || !onLoadFileStoreMatches}
          >
            {loadingFileStoreList ? "…" : "Загрузить список"}
          </button>
        </div>
        {fileStoreMatches?.length > 0 && onFileStoreMatchSelect && (
          <select
            className="dna-inspector-select"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) onFileStoreMatchSelect(v);
            }}
            disabled={loading}
          >
            <option value="">Выберите матч</option>
            {fileStoreMatches.map((m) => (
              <option key={m.matchId} value={m.matchId}>
                {m.mapName || m.matchId} {m.startedAt ? new Date(m.startedAt).toLocaleString() : ""}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="dna-inspector-section">
        <label className="dna-inspector-label">Игрок</label>
        <select
          className="dna-inspector-select"
          value={primaryId || ""}
          onChange={(e) => onPrimaryChange(e.target.value)}
          disabled={loading}
        >
          <option value="">Выберите игрока</option>
          {participants.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
          {session?.entities?.primary && !participants.some((p) => p.id === session.entities.primary.id) && (
            <option value={session.entities.primary.id}>{session.entities.primary.label}</option>
          )}
        </select>
      </section>

      <section className="dna-inspector-section dna-inspector-compare-row">
        <label className="dna-inspector-check">
          <input
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => onCompareToggle(e.target.checked)}
          />
          Сравнить
        </label>
        {compareEnabled && (
          <select
            className="dna-inspector-select"
            value={secondaryId || ""}
            onChange={(e) => onSecondaryChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Второй игрок</option>
            {participants.filter((p) => p.id !== primaryId).map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="dna-inspector-section">
        <span className="dna-inspector-label">Слои</span>
        <div className="dna-inspector-chips">
          {["path", "events", "zone", "fights"].map((key) => (
            <button
              key={key}
              type="button"
              className={`dna-inspector-chip ${layers[key] ? "dna-inspector-chip-active" : ""}`}
              onClick={() => onLayersChange({ ...layers, [key]: !layers[key] })}
            >
              {key === "path" ? "Трек" : key === "events" ? "События" : key === "zone" ? "Зона" : "Файты"}
            </button>
          ))}
        </div>
      </section>

      <section className="dna-inspector-section">
        <span className="dna-inspector-label">События</span>
        <div className="dna-inspector-chips dna-inspector-chips-wrap">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`dna-inspector-chip dna-inspector-chip-sm ${eventFilters[type] !== false ? "dna-inspector-chip-active" : ""}`}
              onClick={() => onEventFiltersChange({ ...eventFilters, [type]: eventFilters[type] === false })}
            >
              {type.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </section>

      <section className="dna-inspector-section dna-inspector-actions">
        <button type="button" className="dna-inspector-btn" onClick={onResetView}>
          Reset view
        </button>
        <button type="button" className="dna-inspector-btn" onClick={onFocusDeath}>
          Focus on death
        </button>
        <button type="button" className="dna-inspector-btn" disabled title="Скоро">
          Share snapshot
        </button>
      </section>

      {compareEnabled && session?.entities?.secondary && (
        <section className="dna-inspector-section dna-compare-summary">
          <span className="dna-inspector-label">Сравнение</span>
          <div className="dna-compare-summary-text">
            {session.entities.primary?.label} vs {session.entities.secondary.label}
          </div>
          {session.events?.length > 0 && (
            <div className="dna-compare-summary-text">
              Событий: {session.events.length}
            </div>
          )}
        </section>
      )}

      {selectedEvent && (
        <EventInspector
          event={selectedEvent}
          onFocusMap={() => selectedEvent && onFocusPoint(selectedEvent.x, selectedEvent.y)}
          onJumpNext={() => {}}
        />
      )}

      {session?.fights?.length > 0 && (
        <FightsPanel
          fights={session.fights}
          selectedFightId={selectedFightId}
          onSelectFight={onSelectFight}
          isolateFightId={isolateFightId}
          onIsolateFight={onIsolateFight}
          onFocusFight={(f) => onFocusPoint(f.centroid.x, f.centroid.y)}
        />
      )}

      <div className="dna-inspector-dev">
        <button
          type="button"
          className="dna-inspector-dev-toggle"
          onClick={() => setDevOpen(!devOpen)}
        >
          ⚙ Dev
        </button>
        {devOpen && (
          <div className="dna-inspector-dev-fields">
            <label>
              matchId
              <input
                type="text"
                value={devMatchId}
                onChange={(e) => onDevMatchIdChange(e.target.value)}
                className="dna-inspector-input"
              />
            </label>
            <label>
              playerId
              <input
                type="text"
                value={devPlayerId}
                onChange={(e) => onDevPlayerIdChange(e.target.value)}
                className="dna-inspector-input"
              />
            </label>
            <label className="dna-inspector-check">
              <input
                type="checkbox"
                checked={useDnaTest}
                onChange={(e) => onUseDnaTestChange(e.target.checked)}
              />
              Use test DB
            </label>
            <button type="button" className="dna-inspector-btn" onClick={onLoadLastMatch}>
              Last match
            </button>
            <button type="button" className="dna-inspector-btn dna-inspector-btn-primary" onClick={onLoadSession}>
              Load session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
