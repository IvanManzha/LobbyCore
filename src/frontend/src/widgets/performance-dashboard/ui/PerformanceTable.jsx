import React from 'react';
import PremiumTable from './PremiumTable';
import { EmptyState } from '@/shared/ui';
import './PerformanceTable.css';

function getPlaceTone(placement) {
  if (placement == null) return 'muted';
  if (placement >= 1 && placement <= 3) return 'good';
  if (placement >= 4 && placement <= 10) return 'neutral';
  return 'muted';
}

function PlacePill({ placement }) {
  const tone = getPlaceTone(placement);
  const label = placement != null ? placement : '—';

  return (
    <span className={`place-pill place-pill-${tone}`}>
      <span className="place-indicator" />
      <span className="place-text table-number">{label}</span>
    </span>
  );
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toString();
}

function PerformanceTable({
  results,
  canAddResult = false,
  onAddResult,
  highlightedMatch,
  highlightTick
}) {
  const data = results || [];
  const maxPoints = React.useMemo(
    () =>
      data.reduce(
        (max, row) =>
          row.points != null && row.points > max ? row.points : max,
        0
      ),
    [data]
  );

  const columns = React.useMemo(
    () => [
      {
        id: 'match',
        header: 'Матч',
        accessorFn: (row) => row.matchIndex,
        enableSorting: true,
        cell: (info) => (
          <span className="match-badge table-number">
            M{formatNumber(info.getValue())}
          </span>
        )
      },
      {
        id: 'place',
        header: 'Место',
        accessorFn: (row) => row.placement,
        enableSorting: false,
        cell: (info) => <PlacePill placement={info.getValue()} />
      },
      {
        id: 'kills',
        header: 'Киллы',
        accessorFn: (row) => row.kills,
        enableSorting: false,
        cell: (info) => (
          <span className="table-number">
            {info.getValue() != null ? info.getValue() : '—'}
          </span>
        )
      },
      {
        id: 'points',
        header: 'Очки',
        accessorFn: (row) => row.points,
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue();
          const width =
            maxPoints > 0 && value != null
              ? `${(value / maxPoints) * 100}%`
              : '0%';
          return (
            <div className="points-cell-inner">
              <span className={`table-number points-cell ${value ? 'has-points' : ''}`}>
                {value != null ? value : '—'}
              </span>
              <div className="points-bar">
                <div className="points-bar-fill" style={{ width }} />
              </div>
            </div>
          );
        }
      }
    ],
    []
  );

  const emptyState = (
    <div className="performance-table">
      <h2>Результаты по матчам</h2>
      <EmptyState
        title="Пока нет результатов по матчам"
        description="Добавьте результаты матчей, чтобы увидеть статистику выступления."
        primaryAction={
          canAddResult && onAddResult ? (
            <button type="button" className="btn btn-primary" onClick={onAddResult}>
              Добавить результат
            </button>
          ) : null
        }
      />
    </div>
  );

  return (
    <div className="performance-table">
      <h2>Результаты по матчам</h2>
      <PremiumTable
        columns={columns}
        data={data}
        getRowId={(row) => String(row.matchIndex)}
        initialSorting={[{ id: 'match', desc: false }]}
        colWidths={['70px', '110px', '110px', '120px']}
        emptyState={emptyState}
        highlightRowId={highlightedMatch}
        highlightTick={highlightTick}
      />
    </div>
  );
}

export default PerformanceTable;

