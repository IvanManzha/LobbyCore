import React from 'react';
import './KpiBar.css';

function KpiBar({ metric }) {
  const { label, displayValue, percentile, tooltip, coverage, invertPercentile } = metric;

  const hasData = metric.value != null && Number.isFinite(metric.value);
  const percentileValue = percentile != null ? Math.round(percentile) : null;
  const barWidth = percentileValue != null ? Math.max(0, Math.min(100, percentileValue)) : 0;

  // Определяем состояние для индикатора
  const isExcellent = percentileValue != null && percentileValue >= 75;
  const isPoor = percentileValue != null && percentileValue <= 25;

  return (
    <div className="kpi-bar-tile">
      <div className="kpi-bar-header">
        <div className="kpi-bar-label">{label}</div>
        {coverage && coverage.totalMatches > 0 && coverage.trackedMatches < coverage.totalMatches && (
          <span
            className="kpi-bar-coverage"
            title={coverage.label}
            aria-label={coverage.label}
          >
            !
          </span>
        )}
        {tooltip && (
          <span
            className="kpi-bar-tooltip-icon"
            title={tooltip}
            aria-label={tooltip}
          >
            i
          </span>
        )}
      </div>
      <div className="kpi-bar-content">
        <div className="kpi-bar-value">{displayValue}</div>
        {percentileValue != null && (
          <div className="kpi-bar-percentile-pill">
            P{percentileValue}
          </div>
        )}
      </div>
      {hasData ? (
        <div className="kpi-bar-track">
          <div
            className="kpi-bar-fill"
            style={{ width: `${barWidth}%` }}
          />
          {isExcellent && (
            <span className="kpi-bar-indicator excellent" title="Отличный результат">
              ✓
            </span>
          )}
          {isPoor && (
            <span className="kpi-bar-indicator poor" title="Нужно улучшить">
              ⚠
            </span>
          )}
        </div>
      ) : (
        <div className="kpi-bar-empty">
          <span className="kpi-bar-empty-text">Недостаточно данных</span>
        </div>
      )}
    </div>
  );
}

export default React.memo(KpiBar);
