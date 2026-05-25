import React from 'react';
import './DataCoverage.css';

function CoverageItem({ label, coverage }) {
  if (!coverage) return null;

  const { trackedMatches, totalMatches, label: tooltip } = coverage;
  if (!totalMatches) return null;

  const display = `${trackedMatches}/${totalMatches}`;

  return (
    <span className="coverage-item" title={tooltip || label}>
      <span className="coverage-label">{label}</span>
      <span className="coverage-value table-number">{display}</span>
    </span>
  );
}

function DataCoverage({ killsCoverage, pointsCoverage }) {
  if (!killsCoverage && !pointsCoverage) return null;

  const hasPartialKills =
    killsCoverage &&
    killsCoverage.totalMatches > 0 &&
    killsCoverage.trackedMatches < killsCoverage.totalMatches;

  const hasPartialPoints =
    pointsCoverage &&
    pointsCoverage.totalMatches > 0 &&
    pointsCoverage.trackedMatches < pointsCoverage.totalMatches;

  const showWarn = hasPartialKills || hasPartialPoints;

  const tooltip =
    'Некоторые матчи могли быть добавлены без киллов или очков, поэтому часть статистики не учитывается полностью.';

  return (
    <div className="data-coverage-inline">
      <span className="data-coverage-label">Качество данных:</span>
      <span className="coverage-grid">
        <CoverageItem label="Киллы" coverage={killsCoverage} />
        <CoverageItem label="Очки" coverage={pointsCoverage} />
      </span>
      <span
        className={`metric-tooltip data-coverage-tooltip ${
          showWarn ? 'data-coverage-warn' : ''
        }`}
        title={tooltip}
        aria-label={tooltip}
      >
        i
      </span>
    </div>
  );
}

export default DataCoverage;

