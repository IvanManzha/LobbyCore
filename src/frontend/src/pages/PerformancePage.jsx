import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLayoutConfig, useLayoutConfigSetter } from '@/contexts/LayoutConfigContext';
import { EmptyState, Skeleton } from '@/shared/ui';
import {
  PerformanceHero,
  PerformanceTable,
  KillsHeatmap,
  HighlightsCards,
  DataCoverage,
} from '@/widgets/performance-dashboard';
import { tournamentApi, subscribeToUpdates } from '@/services/api';
import {
  getMatchResults,
  getTeamKillsMatrix,
  computeHighlights,
  computeSummary,
  computeFormDots,
} from '@/entities/player';
import { useTranslation } from '@/contexts/LanguageContext';
import './PerformancePage.css';

function PerformancePage({ type }) {
  const { t } = useTranslation();
  const params = useParams();
  const tournamentId = params.tournamentId || params.id;
  const entityName = type === 'team' ? params.teamName : params.playerName;

  const [table, setTable] = useState(null);
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverMatch, setHoverMatch] = useState(null);
  const [highlightedMatch, setHighlightedMatch] = useState(null);
  const [highlightTick, setHighlightTick] = useState(0);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToUpdates(() => {
      loadData();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, entityName, type]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await tournamentApi.getTable(tournamentId);
      setTable(data);

      const teams = data.teams || [];
      let found = null;

      if (type === 'team') {
        found = teams.find((t) => t.name === entityName) || null;
      } else {
        // Для solo-страницы: команда совпадает с ником игрока
        found = teams.find((t) => t.name === entityName) || null;
      }

      if (!found) {
        setError(type === 'team' ? t('performance.teamNotFound') : t('performance.playerNotFound'));
      }

      setEntity(found);
      setError(null);
    } catch (err) {
      setError(t('performance.loadError'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setLayoutConfig = useLayoutConfigSetter();
  useLayoutConfig({ pageTitleOverride: type === 'team' ? t('performance.team') : t('performance.player'), showInfoSidebar: false });
  useEffect(() => {
    if (setLayoutConfig && entityName) setLayoutConfig({ pageTitleOverride: entityName, showInfoSidebar: false });
  }, [setLayoutConfig, entityName]);
  if (loading) {
    return (
      <div className="performance-page">
          <Skeleton height={80} />
          <Skeleton height={260} />
      </div>
    );
  }

  if (error || !entity || !table) {
    return (
        <EmptyState
          title={error || (type === 'team' ? t('performance.teamNotFound') : t('performance.playerNotFoundShort'))}
          description={t('performance.checkLink')}
          secondaryAction={
            <button className="btn btn-secondary" onClick={() => window.history.back()}>
              {t('performance.back')}
            </button>
          }
        />
    );
  }

  const tournament = table.tournament || {};
  const matchResults = getMatchResults(entity, tournament);
  const summary = computeSummary(matchResults, entity);
  const highlights = computeHighlights(matchResults, entity);
  const killsMatrix =
    type === 'team' && entity.playerKills && entity.playerKills.length > 0
      ? getTeamKillsMatrix(entity, tournament)
      : null;

  const pointsCoverage = (() => {
    const total = matchResults.length;
    const tracked = matchResults.filter((r) => r.points != null).length;
    if (!total) return null;
    return {
      trackedMatches: tracked,
      totalMatches: total,
      label: `Points tracked: ${tracked}/${total}`
    };
  })();

  const killsCoverage = summary.killsCoverage || killsMatrix?.coverage || null;

  const formDots = computeFormDots(matchResults);

  const handleMatchSelect = (matchIndex) => {
    if (matchIndex == null) return;
    setHighlightedMatch(matchIndex);
    setHighlightTick((tick) => tick + 1);
    setHoverMatch(matchIndex);
    // Снимаем подсветку через короткое время, чтобы не зависала навсегда
    setTimeout(() => {
      setHighlightedMatch((current) => (current === matchIndex ? null : current));
    }, 1600);
  };

  const handleAwardClick = (payload) => {
    if (!payload) return;
    if (payload.type === 'match' && payload.matchIndex != null) {
      handleMatchSelect(payload.matchIndex);
    }
    if (payload.type === 'mvp' && payload.playerName) {
      // подсветку конкретного игрока в heatmap можно добавить позднее
    }
  };

  return (
    <div className="performance-page">
        <PerformanceHero
          type={type}
          name={entityName}
          tournament={tournament}
          summary={summary}
          matchResults={matchResults}
          formDots={formDots}
          highlights={highlights}
          onMatchHover={setHoverMatch}
          onMatchSelect={handleMatchSelect}
        />

        <PerformanceTable
          results={matchResults}
          highlightedMatch={highlightedMatch}
          highlightTick={highlightTick}
        />

        {killsMatrix && (
          <KillsHeatmap
            matrixData={killsMatrix}
            selectedMatch={hoverMatch}
            onSelectMatch={setHoverMatch}
            isTeam={type === 'team'}
          />
        )}

        <HighlightsCards highlights={highlights} onAwardClick={handleAwardClick} />

        <DataCoverage
          killsCoverage={killsCoverage}
          pointsCoverage={pointsCoverage}
        />
    </div>
  );
}

export default PerformancePage;

