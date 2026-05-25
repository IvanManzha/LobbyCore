import { PlayerStatsResponse, MetricItem, CoverageInfo } from './types';

export type KpiMetric = {
  id: string;
  label: string;
  value: number | null;
  displayValue: string;
  percentile: number | null; // 0-100, будет заполнено через API
  tooltip: string;
  coverage?: CoverageInfo;
  invertPercentile?: boolean; // для avg_place
};

export type KpiSnapshot = {
  metrics: KpiMetric[];
};

export const getKpiSnapshot = (stats: PlayerStatsResponse): KpiSnapshot | null => {
  if (!stats || !stats.core || stats.core.length === 0) {
    return null;
  }

  // Маппинг core метрик в KPI метрики
  const metricMap: Record<string, { invertPercentile?: boolean }> = {
    avg_place: { invertPercentile: true }, // меньше = лучше
    kills_per_match: {},
    winrate: {},
    top_rate: {},
    kd: {}
  };

  const metrics: KpiMetric[] = stats.core
    .filter((metric) => {
      // Включаем только нужные метрики для KPI панели
      return ['avg_place', 'kills_per_match', 'winrate', 'top_rate', 'kd'].includes(metric.id);
    })
    .map((metric: MetricItem): KpiMetric | null => {
      const config = metricMap[metric.id] || {};
      
      return {
        id: metric.id,
        label: metric.label,
        value: metric.value,
        displayValue: metric.displayValue,
        percentile: null, // Будет заполнено через API
        tooltip: metric.tooltip || '',
        coverage: metric.coverage,
        invertPercentile: config.invertPercentile || false
      };
    })
    .filter((m): m is KpiMetric => m !== null);

  // Добавляем points_per_match если есть данные в secondary
  const pointsMetric = stats.secondary?.find((m) => m.id === 'avg_points');
  if (pointsMetric && pointsMetric.value != null) {
    metrics.push({
      id: 'points_per_match',
      label: 'Points / Match',
      value: pointsMetric.value,
      displayValue: pointsMetric.displayValue,
      percentile: null,
      tooltip: pointsMetric.tooltip || 'Средние очки за матч',
      invertPercentile: false
    });
  }

  // Ограничиваем до 6 метрик максимум
  const limitedMetrics = metrics.slice(0, 6);

  return {
    metrics: limitedMetrics
  };
};
