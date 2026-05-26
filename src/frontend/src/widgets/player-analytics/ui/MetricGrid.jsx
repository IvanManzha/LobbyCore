import React from 'react';
import './MetricGrid.css';

function MetricGrid({ items = [] }) {
  return (
    <div className="metric-grid">
      {items.map((item) => (
        <div key={item.id || item.label} className="metric-item">
          <div className="metric-label">
            <span>{item.label}</span>
            {item.tooltip && (
              <span className="metric-tooltip" title={item.tooltip} aria-label={item.tooltip}>
                i
              </span>
            )}
            {item.coverage &&
              item.coverage.totalMatches > 0 &&
              item.coverage.trackedMatches < item.coverage.totalMatches && (
              <span className="metric-coverage" title={item.coverage.label}>
                !
              </span>
            )}
          </div>
          <div className="metric-value">{item.displayValue ?? item.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

export default MetricGrid;
