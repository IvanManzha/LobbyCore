import React from 'react';
import { Link } from 'react-router-dom';
import './InsightsPanel.css';

function InsightsPanel({ insightsData }) {
  if (!insightsData) {
    return null;
  }

  const { bestTournament, trends, breakdown, coverage, consistency } = insightsData;

  return (
    <div className="insights-panel">
      <div className="insights-header">
        <h3>Insights</h3>
      </div>

      <div className="insights-grid">
        {/* Highlights */}
        <div className="insight-card">
          <div className="insight-card-header">
            <h4>Highlights</h4>
          </div>
          <div className="insight-card-content">
            {bestTournament ? (
              <div className="insight-item">
                <div className="insight-label">Best tournament</div>
                <div className="insight-value-group">
                  {bestTournament.tournamentId ? (
                    <Link to={`/tournament/${bestTournament.tournamentId}`} className="insight-link">
                      {bestTournament.name}
                    </Link>
                  ) : (
                    <span className="insight-text">{bestTournament.name}</span>
                  )}
                  <div className="insight-meta">
                    {bestTournament.place != null && (
                      <span className="insight-badge">#{bestTournament.place}</span>
                    )}
                    {bestTournament.points != null && (
                      <span className="insight-badge">{bestTournament.points} pts</span>
                    )}
                    {bestTournament.kills != null && (
                      <span className="insight-badge">{bestTournament.kills} kills</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="insight-item">
                <div className="insight-label">Best tournament</div>
                <div className="insight-empty">—</div>
              </div>
            )}
            
            {bestTournament?.kills != null && bestTournament.kills > 0 ? (
              <div className="insight-item">
                <div className="insight-label">Best kills in a match</div>
                <div className="insight-value">{bestTournament.kills}</div>
              </div>
            ) : (
              <div className="insight-item">
                <div className="insight-label">Best kills in a match</div>
                <div className="insight-empty">—</div>
              </div>
            )}
          </div>
        </div>

        {/* Trends */}
        {(trends?.rating || trends?.avgPlace) && (
          <div className="insight-card">
            <div className="insight-card-header">
              <h4>Trends (last 5 tournaments)</h4>
            </div>
            <div className="insight-card-content">
              {trends.rating ? (
                <div className="insight-item">
                  <div className="insight-label">Rating trend</div>
                  <div className={`insight-trend ${trends.rating.direction}`}>
                    <span className="trend-arrow">
                      {trends.rating.direction === 'up' ? '↑' : trends.rating.direction === 'down' ? '↓' : '→'}
                    </span>
                    <span className="trend-value">{trends.rating.label}</span>
                  </div>
                </div>
              ) : (
                <div className="insight-item">
                  <div className="insight-label">Rating trend</div>
                  <div className="insight-empty">Мало турниров для тренда</div>
                </div>
              )}
              
              {trends.avgPlace ? (
                <div className="insight-item">
                  <div className="insight-label">Avg place trend</div>
                  <div className={`insight-trend ${trends.avgPlace.direction === 'improved' ? 'up' : trends.avgPlace.direction === 'worsened' ? 'down' : 'stable'}`}>
                    <span className="trend-text">{trends.avgPlace.label}</span>
                  </div>
                </div>
              ) : (
                <div className="insight-item">
                  <div className="insight-label">Avg place trend</div>
                  <div className="insight-empty">Мало турниров для тренда</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Breakdown */}
        {breakdown && (
          <div className="insight-card">
            <div className="insight-card-header">
              <h4>Breakdown</h4>
            </div>
            <div className="insight-card-content">
              <div className="insight-item">
                <div className="insight-label">Placement contribution</div>
                <div className="insight-value">{breakdown.placementShare}%</div>
              </div>
              <div className="insight-item">
                <div className="insight-label">Kills contribution</div>
                <div className="insight-value">{breakdown.killsShare}%</div>
              </div>
              <div className="breakdown-bar">
                <div className="breakdown-bar-fill" style={{ width: `${breakdown.placementShare}%` }} />
                <div className="breakdown-bar-fill kills" style={{ width: `${breakdown.killsShare}%` }} />
              </div>
              {breakdown.label && (
                <div className="insight-note">{breakdown.label}</div>
              )}
            </div>
          </div>
        )}

        {/* Consistency */}
        {consistency && (
          <div className="insight-card">
            <div className="insight-card-header">
              <h4>Consistency</h4>
            </div>
            <div className="insight-card-content">
              <div className="insight-item">
                <div className="insight-label">{consistency.label} rate</div>
                <div className="insight-value">
                  {consistency.topXTournaments}/{consistency.totalTournaments} ({consistency.topXRate}%)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coverage */}
        {coverage && (
          <div className="insight-card">
            <div className="insight-card-header">
              <h4>Coverage</h4>
            </div>
            <div className="insight-card-content">
              <div className="insight-item">
                <div className="insight-label">Киллы</div>
                <div className="insight-value">
                  {coverage.kills.tracked}
                  {coverage.kills.label && (
                    <span className="insight-hint" title={coverage.kills.label}> ⓘ</span>
                  )}
                </div>
              </div>
              {coverage.deaths.total > 0 && (
                <div className="insight-item">
                  <div className="insight-label">Смерти</div>
                  <div className="insight-value">
                    {coverage.deaths.tracked}
                    {coverage.deaths.label && (
                      <span className="insight-hint" title={coverage.deaths.label}> ⓘ</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(InsightsPanel);
