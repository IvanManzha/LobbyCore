import React from 'react';
import './KillsHeatmap.css';

function getCellTone(value, max) {
  if (value == null) return 'empty';
  if (max <= 0) return 'low';
  const ratio = value / max;
  if (ratio >= 0.7) return 'high';
  if (ratio >= 0.4) return 'medium';
  return 'low';
}

function KillsHeatmap({ matrixData, selectedMatch, onSelectMatch, isTeam = true }) {
  if (!matrixData || !matrixData.players?.length || !matrixData.matches?.length) {
    return null;
  }

  const { players, matches, matrix, rowSums, colSums } = matrixData;
  const flatValues = matrix.flat().filter((v) => v != null);
  const maxValue = flatValues.length ? Math.max(...flatValues) : 0;

  return (
    <div className="kills-heatmap">
      <div className="kills-heatmap-header">
        <h2>Киллы по матчам</h2>
        <div className="heatmap-legend">
          <span className="heatmap-legend-item">
            <span className="heatmap-legend-swatch heatmap-legend-0" />
            <span>0</span>
          </span>
          <span className="heatmap-legend-item">
            <span className="heatmap-legend-swatch heatmap-legend-1-2" />
            <span>1–2</span>
          </span>
          <span className="heatmap-legend-item">
            <span className="heatmap-legend-swatch heatmap-legend-3-4" />
            <span>3–4</span>
          </span>
          <span className="heatmap-legend-item">
            <span className="heatmap-legend-swatch heatmap-legend-5plus" />
            <span>5+</span>
          </span>
        </div>
      </div>
      <div className="kills-heatmap-shell">
        <div className="kills-heatmap-scroll">
          <table className="kills-heatmap-grid">
            <thead>
              <tr>
                <th className="sticky-col">Игрок</th>
                {matches.map((matchIndex) => (
                  <th
                    key={matchIndex}
                    className={`match-header ${selectedMatch === matchIndex ? 'match-selected' : ''}`}
                  >
                    <span className="table-number">M{matchIndex}</span>
                  </th>
                ))}
                <th className="match-header sum-header">
                  <span className="table-number">Σ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, rowIdx) => (
                <tr key={player}>
                  <td className="sticky-col player-cell">
                    <span>{player}</span>
                  </td>
                  {matches.map((matchIndex, colIdx) => {
                    const value = matrix[rowIdx]?.[colIdx] ?? null;
                    const tone = getCellTone(value, maxValue);

                    const tooltipParts = [
                      player,
                      `Матч ${matchIndex}`,
                      value != null ? `${value} киллов` : 'Киллы не отслеживались'
                    ];

                    return (
                      <td
                        key={matchIndex}
                        className={`heatmap-cell heatmap-${tone} ${
                          selectedMatch === matchIndex ? 'heatmap-selected' : ''
                        }`}
                        title={tooltipParts.join(' — ')}
                        onMouseEnter={() => onSelectMatch && onSelectMatch(matchIndex)}
                        onMouseLeave={() => onSelectMatch && onSelectMatch(null)}
                      >
                        {value != null ? (
                          <span className="heatmap-value table-number">
                            {value}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="heatmap-cell heatmap-sum">
                    <span className="table-number heatmap-sum-value">
                      {rowSums ? rowSums[rowIdx] : 0}
                    </span>
                  </td>
                </tr>
              ))}
              {isTeam && colSums && (
                <tr className="team-sum-row">
                  <td className="sticky-col player-cell team-sum-label">
                    <span>Σ по матчу</span>
                  </td>
                  {matches.map((matchIndex, colIdx) => (
                    <td key={matchIndex} className="heatmap-cell heatmap-sum">
                      <span className="table-number heatmap-sum-value">
                        {colSums[colIdx]}
                      </span>
                    </td>
                  ))}
                  <td className="heatmap-cell heatmap-sum" />
                </tr>
              )}
            </tbody>
          </table>
          <div className="heatmap-shadow-left" />
          <div className="heatmap-shadow-right" />
        </div>
      </div>
    </div>
  );
}

export default KillsHeatmap;

