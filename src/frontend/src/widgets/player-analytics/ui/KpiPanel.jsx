import React from 'react';
import KpiBar from './KpiBar';
import { EmptyState, Skeleton } from '@/shared/ui';
import './KpiPanel.css';

function KpiPanel({ snapshot, loading = false }) {
  if (loading) {
    return (
      <div className="kpi-panel-container">
        <div className="kpi-panel-header">
          <h3>Метрики</h3>
        </div>
        <div className="kpi-panel-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} height={120} />
          ))}
        </div>
      </div>
    );
  }

  if (!snapshot || !snapshot.metrics || snapshot.metrics.length === 0) {
    return (
      <div className="kpi-panel-container">
        <div className="kpi-panel-header">
          <h3>Метрики</h3>
        </div>
        <EmptyState
          title="Недостаточно данных"
          description="Сыграйте хотя бы несколько матчей, чтобы увидеть метрики."
        />
      </div>
    );
  }

  return (
    <div className="kpi-panel-container">
      <div className="kpi-panel-header">
        <h3>Метрики</h3>
      </div>
      <div className="kpi-panel-grid">
        {snapshot.metrics.map((metric) => (
          <KpiBar key={metric.id} metric={metric} />
        ))}
      </div>
      <div className="kpi-panel-footer">
        <div className="kpi-panel-legend">
          <span className="legend-label">Percentile</span>
          <span className="legend-desc">= позиция относительно друзей</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(KpiPanel);
