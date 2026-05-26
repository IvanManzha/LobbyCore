import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { EmptyState, Skeleton } from '@/shared/ui';
import './RatingChart.css';

function RatingChart({ data, loading = false }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const chartData = useMemo(() => {
    if (!data || !data.mainLine || data.mainLine.length === 0) {
      return null;
    }

    // Объединяем все линии в один массив точек по дате
    const dateMap = new Map();

    data.mainLine.forEach((point) => {
      dateMap.set(point.date, {
        date: point.date,
        tournamentName: point.tournamentName,
        effectiveRating: point.value,
        delta: point.delta
      });
    });

    if (showAdvanced && data.advancedLines) {
      if (Array.isArray(data.advancedLines.movingAverage) && data.advancedLines.movingAverage.length > 0) {
        data.advancedLines.movingAverage.forEach((point) => {
          if (point && point.date != null && point.value != null) {
            const existing = dateMap.get(point.date) || { date: point.date };
            existing.movingAverage = point.value;
            dateMap.set(point.date, existing);
          }
        });
      }

      if (Array.isArray(data.advancedLines.trend) && data.advancedLines.trend.length > 0) {
        data.advancedLines.trend.forEach((point) => {
          if (point && point.date != null && point.value != null) {
            const existing = dateMap.get(point.date) || { date: point.date };
            existing.trend = point.value;
            dateMap.set(point.date, existing);
          }
        });
      }
    }

    const result = Array.from(dateMap.values()).sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return result;
  }, [data, showAdvanced]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const data = payload[0].payload;
    const effectiveRating = payload.find((p) => p.dataKey === 'effectiveRating');

    return (
      <div className="rating-chart-tooltip">
        <div className="tooltip-header">
          <div className="tooltip-tournament">{data.tournamentName}</div>
          <div className="tooltip-date">{data.date}</div>
        </div>
        {effectiveRating && (
          <div className="tooltip-value">
            <span className="tooltip-label">DNA рейтинг:</span>
            <span className="tooltip-number">{effectiveRating.value?.toFixed(1) || '—'}</span>
            {data.delta != null && (
              <span className={`tooltip-delta ${data.delta >= 0 ? 'positive' : 'negative'}`}>
                {data.delta >= 0 ? '+' : ''}{data.delta.toFixed(1)}
              </span>
            )}
          </div>
        )}
        {showAdvanced && (
          <div className="tooltip-advanced">
            {data.movingAverage != null && (
              <div className="tooltip-line">
                <span className="tooltip-label">Среднее:</span>
                <span className="tooltip-number">{data.movingAverage.toFixed(1)}</span>
              </div>
            )}
            {data.trend != null && (
              <div className="tooltip-line">
                <span className="tooltip-label">Тренд:</span>
                <span className="tooltip-number">{data.trend.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rating-chart-container">
        <Skeleton height={400} />
      </div>
    );
  }

  if (!data || !data.mainLine || data.mainLine.length < 2) {
    return (
      <div className="rating-chart-container">
        <EmptyState
          title="Недостаточно данных для графика"
          description="Сыграйте хотя бы 2 турнира, чтобы увидеть динамику DNA рейтинга."
        />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="rating-chart-container">
        <EmptyState
          title="Недостаточно данных для графика"
          description="Сыграйте хотя бы 2 турнира, чтобы увидеть динамику DNA рейтинга."
        />
      </div>
    );
  }

  // Вычисляем min/max для Y оси
  const allValues = chartData
    .map((d) => [
      d.effectiveRating,
      showAdvanced && d.movingAverage != null ? d.movingAverage : null,
      showAdvanced && d.trend != null ? d.trend : null
    ])
    .flat()
    .filter((v) => v != null && Number.isFinite(v));

  if (allValues.length === 0) {
    return (
      <div className="rating-chart-container">
        <EmptyState
          title="Недостаточно данных для графика"
          description="Сыграйте хотя бы 2 турнира, чтобы увидеть динамику DNA рейтинга."
        />
      </div>
    );
  }

  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = Math.max((maxValue - minValue) * 0.1, 5); // Минимум 5 единиц padding

  return (
    <div className="rating-chart-container">
      <div className="rating-chart-header">
        <h3>DNA рейтинг по турнирам</h3>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-label={showAdvanced ? 'Скрыть детали' : 'Показать детали'}
        >
          {showAdvanced ? 'Скрыть детали' : 'Advanced'}
        </button>
      </div>
      <div className="rating-chart-wrapper">
        <ResponsiveContainer width="100%" height={400}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
            <defs>
              <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--line2)"
              opacity={0.3}
            />
            <XAxis
              dataKey="date"
              stroke="var(--muted)"
              tick={{ fill: 'var(--muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
              tickFormatter={(value, index) => {
                const date = new Date(value);
                const day = date.getDate();
                const month = date.getMonth() + 1;
                return `${day}.${month}`;
              }}
              label={{ value: 'Дата / Турниры', position: 'insideBottom', offset: -8, fill: 'var(--muted)', fontSize: 11 }}
            />
            <YAxis
              stroke="var(--muted)"
              tick={{ fill: 'var(--muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
              domain={[minValue - padding, maxValue + padding]}
              tickFormatter={(value) => {
                return Math.round(value).toString();
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="effectiveRating"
              stroke="var(--accent)"
              strokeWidth={2.5}
              fill="url(#ratingGradient)"
              dot={{ fill: 'var(--accent)', r: 3 }}
              activeDot={{ r: 5, fill: 'var(--accent)' }}
            />
            {showAdvanced && data.advancedLines && Array.isArray(data.advancedLines.movingAverage) && data.advancedLines.movingAverage.length > 0 && (
              <Line
                type="monotone"
                dataKey="movingAverage"
                stroke="var(--accent2)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                legendType="line"
                connectNulls={true}
              />
            )}
            {showAdvanced && data.advancedLines && Array.isArray(data.advancedLines.trend) && data.advancedLines.trend.length > 0 && (
              <Line
                type="monotone"
                dataKey="trend"
                stroke="var(--muted2)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                legendType="line"
                connectNulls={true}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {showAdvanced && data.advancedLines && (
        <div className="rating-chart-legend">
          <div className="legend-item">
            <span className="legend-line main"></span>
            <span>DNA рейтинг</span>
          </div>
          {Array.isArray(data.advancedLines.movingAverage) && data.advancedLines.movingAverage.length > 0 && (
            <div className="legend-item">
              <span className="legend-line advanced" style={{ background: 'var(--accent2)' }}></span>
              <span>Среднее (окно 5)</span>
            </div>
          )}
          {Array.isArray(data.advancedLines.trend) && data.advancedLines.trend.length > 0 && (
            <div className="legend-item">
              <span className="legend-line advanced" style={{ background: 'var(--muted2)' }}></span>
              <span>Тренд</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(RatingChart);
