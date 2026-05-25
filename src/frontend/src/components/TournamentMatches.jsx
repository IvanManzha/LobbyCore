import React, { useState, useMemo } from 'react';
import EmptyState from './EmptyState';
import './TournamentMatches.css';

function MatchStatusPill({ status }) {
  const statusMap = {
    empty: { label: 'Пусто', class: 'empty' },
    partial: { label: 'Частично', class: 'partial' },
    filled: { label: 'Заполнено', class: 'filled' }
  };
  
  const config = statusMap[status] || statusMap.empty;
  
  return (
    <span className={`match-status-pill ${config.class}`}>
      <span className="match-status-led" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function MatchCard({ match, tournamentId, isAdmin, onAddResult, highlightMatchIndex }) {
  const [expanded, setExpanded] = useState(false);
  
  const top3 = match.results
    .filter(r => r.place != null)
    .slice(0, 3);
  
  const hasData = match.status !== 'empty';
  const isHighlighted = highlightMatchIndex === match.matchIndex;
  
  return (
    <div 
      id={`match-${match.matchIndex}`}
      className={`match-card ${expanded ? 'expanded' : ''} ${isHighlighted ? 'highlighted' : ''}`}
    >
      <div className="match-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="match-card-left">
          <div className="match-card-title">
            <span className="match-number">Матч {match.matchIndex}</span>
            {isAdmin && <MatchStatusPill status={match.status} />}
          </div>
          {hasData && top3.length > 0 && (
            <div className="match-card-summary">
              {top3.map((result, idx) => (
                <div key={idx} className="match-summary-item">
                  <span className="match-summary-place">#{result.place}</span>
                  <span className="match-summary-name">{result.name}</span>
                  {result.points != null && (
                    <span className="match-summary-points">{result.points} очк.</span>
                  )}
                  {result.kills != null && (
                    <span className="match-summary-kills">{result.kills} к.</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="match-card-right">
          <button 
            className="match-card-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="match-card-details">
          <div className="match-details-table">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Команда/Игрок</th>
                  <th>Очки</th>
                  <th>Киллы</th>
                </tr>
              </thead>
              <tbody>
                {match.results.map((result, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="table-number">
                        {result.place != null ? `#${result.place}` : '—'}
                      </span>
                    </td>
                    <td>{result.name}</td>
                    <td>
                      <span className="table-number">
                        {result.points != null ? result.points : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="table-number">
                        {result.kills != null ? result.kills : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && (
            <div className="match-card-actions">
              <button 
                className="btn btn-primary"
                onClick={() => onAddResult && onAddResult(match.matchIndex)}
              >
                {hasData ? 'Изменить результат' : 'Добавить результат'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TournamentMatches({ matches = [], tournamentId, isAdmin, onAddResult, highlightMatchIndex }) {
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'empty' | 'partial' | 'filled'
  
  const filteredMatches = useMemo(() => {
    if (!isAdmin || statusFilter === 'all') return matches;
    return matches.filter(m => m.status === statusFilter);
  }, [matches, statusFilter, isAdmin]);
  
  const filledMatchesCount = matches.filter(m => m.status === 'filled').length;
  const hasAnyData = filledMatchesCount > 0;
  
  if (!hasAnyData && matches.length > 0) {
    return (
      <div className="tournament-matches">
        <EmptyState
          title="Матчи пока не заполнены"
          description="Добавьте результаты матчей, чтобы увидеть таймлайн."
          primaryAction={
            isAdmin ? (
              <button 
                className="btn btn-primary"
                onClick={() => onAddResult && onAddResult(1)}
              >
                Добавить результат
              </button>
            ) : null
          }
        />
      </div>
    );
  }
  
  if (matches.length === 0) {
    return (
      <div className="tournament-matches">
        <EmptyState
          title="Матчи пока не заполнены"
          description="Добавьте результаты матчей, чтобы увидеть таймлайн."
        />
      </div>
    );
  }
  
  return (
    <div className="tournament-matches">
      <div className="matches-header">
        <div className="matches-header-left">
          <h2 className="matches-title">Матчи</h2>
          {isAdmin && (
            <span className="matches-count">
              {filledMatchesCount} / {matches.length} заполнено
            </span>
          )}
        </div>
        <div className="matches-header-right">
          <div className="matches-view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              Таймлайн
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Таблица
            </button>
          </div>
          {isAdmin && viewMode === 'table' && (
            <select
              className="matches-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Все</option>
              <option value="filled">Заполненные</option>
              <option value="partial">Частичные</option>
              <option value="empty">Пустые</option>
            </select>
          )}
        </div>
      </div>
      
      {viewMode === 'timeline' ? (
        <div className="matches-timeline">
          {filteredMatches.map(match => (
            <MatchCard
              key={match.matchIndex}
              match={match}
              tournamentId={tournamentId}
              isAdmin={isAdmin}
              onAddResult={onAddResult}
              highlightMatchIndex={highlightMatchIndex}
            />
          ))}
        </div>
      ) : (
        <div className="matches-table-view">
          <div className="table-shell">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Матч</th>
                  <th>Топ команда/игрок</th>
                  {isAdmin && <th>Статус</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map(match => (
                  <tr 
                    key={match.matchIndex}
                    id={`match-${match.matchIndex}`}
                    className={highlightMatchIndex === match.matchIndex ? 'highlighted' : ''}
                  >
                    <td>
                      <span className="table-number">#{match.matchIndex}</span>
                    </td>
                    <td>
                      {match.best.topEntity || '—'}
                    </td>
                    {isAdmin && (
                      <td>
                        <MatchStatusPill status={match.status} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentMatches;
