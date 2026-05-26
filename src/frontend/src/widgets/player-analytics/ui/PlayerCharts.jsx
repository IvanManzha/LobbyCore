import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

function PlayerCharts({ profile, tournaments, selectedYear }) {
  // Мемоизируем фильтрацию истории для оптимизации
  const filteredHistory = useMemo(() => {
    if (!profile || !profile.history || profile.history.length === 0) return [];

    const canceledIds = new Set(
      (tournaments || []).filter(t => t.state === 'Турнир отменен').map(t => t.id)
    );

    return profile.history
      .filter(h => h.newRating != null && !canceledIds.has(h.tournamentId))
      .filter(h => !selectedYear || (typeof h.date === 'string' && h.date.startsWith(`${selectedYear}-`)))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [profile, tournaments, selectedYear]);

  // Мемоизируем вычисления для линейного графика
  // Используем requestIdleCallback для разбиения тяжелых вычислений на части
  const ratingChartData = useMemo(() => {
    if (filteredHistory.length === 0) return null;

    const dates = filteredHistory.map(h => h.date);
    const newRatings = filteredHistory.map(h => h.newRating);

    const W = 5; // Window size
    const M = 10; // Short anchor size
    const longAnchor = profile?.longAnchor ?? newRatings[0];
    const longArr = dates.map(() => longAnchor);
    
    // Оптимизация: предварительно вычисляем суммы для скользящих средних
    const shortArr = new Array(newRatings.length);
    const windowArr = new Array(newRatings.length);
    
    for (let i = 0; i < newRatings.length; i++) {
      // Short anchor
      const shortStart = Math.max(0, i + 1 - M);
      const shortSlice = newRatings.slice(shortStart, i + 1);
      shortArr[i] = shortSlice.reduce((a, b) => a + b, 0) / shortSlice.length;
      
      // Window
      const windowStart = Math.max(0, i + 1 - W);
      const windowSlice = newRatings.slice(windowStart, i + 1);
      windowArr[i] = windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length;
    }

    return {
      labels: dates,
      datasets: [
        {
          label: 'Long Anchor',
          data: longArr,
          borderDash: [5, 5],
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
          tension: 0,
          borderColor: '#888',
        },
        {
          label: 'Short Anchor',
          data: shortArr,
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0.2,
          borderColor: '#666',
        },
        {
          label: 'Window Rating',
          data: windowArr,
          borderDash: [2, 2],
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0.2,
          borderColor: '#4caf50',
        },
        {
          label: 'DNA Rating',
          data: newRatings,
          borderWidth: 3,
          fill: false,
          pointRadius: 3,
          tension: 0.1,
          borderColor: '#1976d2',
        },
      ],
    };
  }, [filteredHistory, profile?.longAnchor]);

  // Мемоизируем вычисления для радар-чарта
  const radarChartData = useMemo(() => {
    if (filteredHistory.length === 0) return null;

    const places = filteredHistory.map(h => h.place);
    const kills = filteredHistory.map(h => Number(h.personalKills) || 0);
    const points = filteredHistory.map(h => h.points);
    const N = filteredHistory.length;
    
    // Оптимизация: вычисляем суммы за один проход
    let sumPlace = 0, sumKills = 0, sumPoints = 0;
    let maxKills = 0, maxPoints = 0, maxPlace = 0;
    
    for (let i = 0; i < N; i++) {
      sumPlace += places[i];
      sumKills += kills[i];
      sumPoints += points[i];
      if (kills[i] > maxKills) maxKills = kills[i];
      if (points[i] > maxPoints) maxPoints = points[i];
      if (places[i] > maxPlace) maxPlace = places[i];
    }
    
    const avgPlace = sumPlace / N;
    const avgKills = sumKills / N;
    const avgPoints = sumPoints / N;
    const Kmax = Math.max(maxKills, 1);
    const Pmax = Math.max(maxPoints, 1);
    const totalTours = (tournaments || [])
      .filter(t => t.state !== 'Турнир отменен')
      .filter(t => !selectedYear || (typeof t.date === 'string' && t.date.startsWith(`${selectedYear}-`)))
      .length || 1;

    const m1 = ((maxPlace + 1 - avgPlace) / maxPlace) * (1 - avgKills / Kmax);
    const m2 = avgKills / Kmax;
    const m3 = filteredHistory.filter(h => Number(h.personalKills) >= 3).length / N;
    const m4 = avgPoints / Pmax;
    const m5 = N / totalTours;
    const stabilityThreshold = Math.max(1, Math.ceil(maxPlace * 0.3));
    const stabilityRate = places.filter((place) => place <= stabilityThreshold).length / N;
    const m6 = stabilityRate;

    const norm = x => {
      const normalized = x * 0.9 + 0.05;
      return Math.max(0, Math.min(1, normalized));
    };
    const radarData = [m1, m2, m3, m4, m5, m6].map(norm);
    const radarLabels = ['Интеллект', 'Стрельба', 'Агрессия', 'Эффективность', 'Активность', 'Стабильность'];

    return {
      labels: radarLabels,
      datasets: [
        {
          label: 'KPI',
          data: radarData,
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          backgroundColor: 'rgba(25, 118, 210, 0.2)',
          borderColor: '#1976d2',
          pointBackgroundColor: '#1976d2',
        },
      ],
    };
  }, [filteredHistory, tournaments, selectedYear]);

  // Мемоизируем опции графиков
  const chartOptions = useMemo(() => {
    if (!ratingChartData) return null;
    
    const newRatings = ratingChartData.datasets[3].data;
    
    // Оптимизация: вычисляем min/max за один проход
    let minRating = Infinity;
    let maxRating = -Infinity;
    for (let i = 0; i < newRatings.length; i++) {
      if (newRatings[i] < minRating) minRating = newRatings[i];
      if (newRatings[i] > maxRating) maxRating = newRatings[i];
    }
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Дата турнира',
          },
        },
        y: {
          title: {
            display: true,
            text: 'Рейтинг',
          },
          min: Math.max(0, minRating - 20),
          max: maxRating + 20,
        },
      },
    };
  }, [ratingChartData]);

  // Мемоизируем опции для радар-чарта
  const radarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    scales: {
      r: {
        beginAtZero: true,
        suggestedMax: 1,
        pointLabels: {
          font: {
            size: 16,
          },
        },
        ticks: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  }), []);

  if (!profile || !profile.history || profile.history.length === 0 || filteredHistory.length === 0) {
    return null;
  }

  if (!ratingChartData || !radarChartData || !chartOptions) {
    return null;
  }

  return (
    <div className="player-charts">
      <div className="chart-container">
        <h3>График изменения рейтинга</h3>
        <div className="chart-wrapper">
          <Line data={ratingChartData} options={chartOptions} />
        </div>
      </div>
      <div className="chart-container">
        <h3>KPI Радар</h3>
        <div className="chart-wrapper">
          <Radar data={radarChartData} options={radarOptions} />
        </div>
      </div>
    </div>
  );
}

// Мемоизируем компонент для предотвращения лишних перерендеров
export default React.memo(PlayerCharts);

