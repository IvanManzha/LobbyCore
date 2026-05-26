import React, { useEffect, useMemo, useState } from "react";
import InspectorPanel from "./InspectorPanel";
import MapCanvas from "./MapCanvas";
import Timeline from "./Timeline";
import EventFeed from "./EventFeed";
import "./StudioLayout.css";

/**
 * DNA Map Studio: left panel + map + bottom timeline.
 * @param {{
 *   session: import('../../services/dnaMapSessionContract').DnaMapSession | null;
 *   loading: boolean;
 *   error: string | null;
 *   currentTimeSec: number;
 *   onCurrentTimeChange: (t: number) => void;
 *   selectedEventId: string | null;
 *   selectedFightId: string | null;
 *   onSelectEvent: (id: string | null) => void;
 *   onSelectFight: (id: string | null) => void;
 *   compareEnabled: boolean;
 *   layers: { path: boolean; events: boolean; zone: boolean; fights: boolean };
 *   eventFilters: Record<string, boolean>;
 *   onLayersChange: (layers: any) => void;
 *   onEventFiltersChange: (filters: Record<string, boolean>) => void;
 *   onResetView: () => void;
 *   onFocusDeath: () => void;
 *   onFocusPoint: (x: number, y: number) => void;
 *   matchId: string;
 *   primaryId: string;
 *   secondaryId: string;
 *   onMatchChange: (id: string) => void;
 *   onPrimaryChange: (id: string) => void;
 *   onSecondaryChange: (id: string) => void;
 *   onCompareToggle: (v: boolean) => void;
 *   useDnaTest: boolean;
 *   onUseDnaTestChange: (v: boolean) => void;
 *   devMatchId: string;
 *   devPlayerId: string;
 *   onDevMatchIdChange: (v: string) => void;
 *   onDevPlayerIdChange: (v: string) => void;
 *   onLoadLastMatch: () => void;
 *   onLoadSession: () => void;
 *   sourceFile?: boolean;
 *   onSourceFileChange?: (v: boolean) => void;
 *   fileStoreMatches?: Array<{ matchId: string; mapName?: string; startedAt?: string }>;
 *   loadingFileStoreList?: boolean;
 *   onLoadFileStoreMatches?: () => void;
 *   onFileStoreMatchSelect?: (matchId: string) => void;
 *   isolateFightId: string | null;
 *   onIsolateFight: (id: string | null) => void;
 * }} props
 */
export default function StudioLayout(props) {
  const {
    variant = "studio",
    session,
    loading,
    error,
    currentTimeSec,
    onCurrentTimeChange,
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
    focusPoint,
    onFocusApplied,

    // Premium selection
    tournaments = [],
    loadingTournaments,
    selectedTournamentId = "",
    tournamentMatches = [],
    loadingTournamentMatches,
    onTournamentChange,
    onTournamentMatchSelect,

    // Player controls
    isPlaying,
    playSpeed,
    onTogglePlayPause,
    onPlaySpeedChange,
  } = props;

  const selectedTournament = useMemo(
    () => tournaments.find((t) => String(t.id) === String(selectedTournamentId)) ?? null,
    [tournaments, selectedTournamentId]
  );

  const selectedMatchMeta = useMemo(
    () => tournamentMatches.find((m) => String(m.matchId) === String(matchId)) ?? null,
    [tournamentMatches, matchId]
  );

  const matchLabel = useMemo(() => {
    const mapName = session?.match?.mapName || selectedMatchMeta?.mapName || null;
    const startedAt = session?.match?.startedAt || selectedMatchMeta?.startedAt || null;
    return [mapName ? String(mapName) : null, startedAt ? new Date(startedAt).toLocaleString() : null]
      .filter(Boolean)
      .join(" • ");
  }, [selectedMatchMeta, session?.match?.mapName, session?.match?.startedAt]);

  const [selectionExpanded, setSelectionExpanded] = useState(!matchId);

  useEffect(() => {
    if (matchId) setSelectionExpanded(false);
  }, [matchId]);

  if (variant === "premiumPlayer") {
    return (
      <div className="dna-studio-layout dna-studio-layout--premium">
        <div className="dna-studio-premium-header">
          {!selectionExpanded ? (
            <div className="dna-studio-premium-chip dna-studio-premium-chip--compact">
              <span className="dna-studio-premium-chip-title">DNA Map</span>
              <span className="dna-studio-premium-chip-sep">/</span>
              <span className="dna-studio-premium-chip-body">
                {selectedTournament?.name || (selectedTournamentId ? selectedTournamentId : "Турнир")}
                {" • "}
                {matchLabel || (matchId ? `${matchId.slice(0, 8)}…` : "—")}
              </span>
              <button
                type="button"
                className="dna-studio-premium-chip-action"
                onClick={() => setSelectionExpanded(true)}
              >
                Сменить
              </button>
            </div>
          ) : (
            <div className="dna-studio-premium-selectionPanel">
              <div className="dna-studio-premium-selectionTitle">Выберите турнир и матч</div>

              {error && <div className="dna-studio-premium-selectionError">{error}</div>}

              <div className="dna-studio-premium-selectionGrid">
                <div className="dna-studio-premium-field">
                  <div className="dna-studio-premium-label">Турнир</div>
                  <select
                    className="dna-studio-premium-select"
                    value={selectedTournamentId}
                    disabled={loadingTournaments || tournaments.length === 0 || loading}
                    onChange={(e) => onTournamentChange?.(e.target.value)}
                  >
                    <option value="">{loadingTournaments ? "Загрузка..." : "Выберите турнир"}</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dna-studio-premium-field">
                  <div className="dna-studio-premium-label">Матч</div>
                  <select
                    className="dna-studio-premium-select"
                    value={matchId || ""}
                    disabled={
                      loading || loadingTournamentMatches || !selectedTournamentId || tournamentMatches.length === 0
                    }
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!next) return;
                      setSelectionExpanded(false);
                      onTournamentMatchSelect?.(next);
                    }}
                  >
                    <option value="">{loadingTournamentMatches ? "Загрузка..." : "Выберите матч"}</option>
                    {tournamentMatches.map((m) => (
                      <option key={m.matchId} value={m.matchId}>
                        {m.mapName || m.matchId}
                        {m.startedAt ? ` • ${new Date(m.startedAt).toLocaleDateString()}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="dna-studio-premium-selectionHint">
                После выбора матча карта загрузится автоматически.
              </div>
            </div>
          )}
        </div>

        <div className="dna-studio-premium-map">
          <MapCanvas
            session={session}
            currentTimeSec={currentTimeSec}
            selectedEventId={selectedEventId}
            selectedFightId={selectedFightId}
            layers={layers}
            eventFilters={eventFilters}
            compareEnabled={compareEnabled}
            onSelectEvent={onSelectEvent}
            onSelectFight={onSelectFight}
            onFocusPoint={onFocusPoint}
            onResetView={onResetView}
            isolateFightId={isolateFightId}
            focusPoint={focusPoint}
            onFocusApplied={onFocusApplied}
          />
          <div className="dna-studio-premium-immersion" aria-hidden />
          <div className="dna-studio-premium-eventFeed">
            <EventFeed
              session={session}
              currentTimeSec={currentTimeSec}
              selectedEventId={selectedEventId}
              eventFilters={eventFilters}
              onSelectEvent={onSelectEvent}
              onCurrentTimeChange={onCurrentTimeChange}
              onFocusPoint={onFocusPoint}
              isolateFightId={isolateFightId}
            />
          </div>
        </div>

        <div className="dna-studio-premium-timeline">
          <Timeline
            session={session}
            currentTimeSec={currentTimeSec}
            onCurrentTimeChange={onCurrentTimeChange}
            selectedEventId={selectedEventId}
            selectedFightId={selectedFightId}
            onSelectEvent={onSelectEvent}
            onSelectFight={onSelectFight}
            onFocusDeath={onFocusDeath}
            compareEnabled={compareEnabled}
            isolateFightId={isolateFightId}
            isPlaying={isPlaying}
            playSpeed={playSpeed}
            onTogglePlayPause={onTogglePlayPause}
            onPlaySpeedChange={onPlaySpeedChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dna-studio-layout">
      <aside className="dna-studio-panel">
        <InspectorPanel
          session={session}
          loading={loading}
          error={error}
          selectedEventId={selectedEventId}
          selectedFightId={selectedFightId}
          onSelectEvent={onSelectEvent}
          onSelectFight={onSelectFight}
          compareEnabled={compareEnabled}
          layers={layers}
          eventFilters={eventFilters}
          onLayersChange={onLayersChange}
          onEventFiltersChange={onEventFiltersChange}
          onResetView={onResetView}
          onFocusDeath={onFocusDeath}
          onFocusPoint={onFocusPoint}
          matchId={matchId}
          primaryId={primaryId}
          secondaryId={secondaryId}
          onMatchChange={onMatchChange}
          onPrimaryChange={onPrimaryChange}
          onSecondaryChange={onSecondaryChange}
          onCompareToggle={onCompareToggle}
          useDnaTest={useDnaTest}
          onUseDnaTestChange={onUseDnaTestChange}
          devMatchId={devMatchId}
          devPlayerId={devPlayerId}
          onDevMatchIdChange={onDevMatchIdChange}
          onDevPlayerIdChange={onDevPlayerIdChange}
          onLoadLastMatch={onLoadLastMatch}
          onLoadSession={onLoadSession}
          sourceFile={sourceFile}
          onSourceFileChange={onSourceFileChange}
          fileStoreMatches={fileStoreMatches}
          loadingFileStoreList={loadingFileStoreList}
          onLoadFileStoreMatches={onLoadFileStoreMatches}
          onFileStoreMatchSelect={onFileStoreMatchSelect}
          isolateFightId={isolateFightId}
          onIsolateFight={onIsolateFight}
        />
      </aside>
      <div className="dna-studio-map">
        <MapCanvas
          session={session}
          currentTimeSec={currentTimeSec}
          selectedEventId={selectedEventId}
          selectedFightId={selectedFightId}
          layers={layers}
          eventFilters={eventFilters}
          compareEnabled={compareEnabled}
          onSelectEvent={onSelectEvent}
          onSelectFight={onSelectFight}
          onFocusPoint={onFocusPoint}
          onResetView={onResetView}
          isolateFightId={isolateFightId}
          focusPoint={focusPoint}
          onFocusApplied={onFocusApplied}
        />
      </div>
      <div className="dna-studio-timeline">
        <Timeline
          session={session}
          currentTimeSec={currentTimeSec}
          onCurrentTimeChange={onCurrentTimeChange}
          selectedEventId={selectedEventId}
          selectedFightId={selectedFightId}
          onSelectEvent={onSelectEvent}
          onSelectFight={onSelectFight}
          onFocusDeath={onFocusDeath}
          compareEnabled={compareEnabled}
          isolateFightId={isolateFightId}
        />
      </div>
    </div>
  );
}
