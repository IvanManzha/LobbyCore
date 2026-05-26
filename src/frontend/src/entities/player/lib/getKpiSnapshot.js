// Клиентская версия getKpiSnapshot для фронтенда
// Собирает понятные KPI метрики из PlayerStatsResponse

export const getKpiSnapshot = (stats) => {
  if (!stats || !Array.isArray(stats.core) || stats.core.length === 0) {
    return null;
  }

  const metricMap = {
    avg_place: { invertPercentile: true }, // меньше = лучше
    kills_per_match: {},
    winrate: {},
    top_rate: {},
    kd: {}
  };

  const metrics = stats.core
    .filter((metric) =>
      ['avg_place', 'kills_per_match', 'winrate', 'top_rate', 'kd'].includes(metric.id)
    )
    .map((metric) => {
      const config = metricMap[metric.id] || {};

      return {
        id: metric.id,
        label: metric.label,
        value: metric.value,
        displayValue: metric.displayValue,
        percentile: null, // Заполнится через API перцентилей
        tooltip: metric.tooltip || '',
        coverage: metric.coverage,
        invertPercentile: config.invertPercentile || false
      };
    });

  const pointsMetric = Array.isArray(stats.secondary)
    ? stats.secondary.find((m) => m.id === 'avg_points')
    : null;

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

  return {
    metrics: metrics.slice(0, 6)
  };
};

