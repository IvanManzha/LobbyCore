import React from 'react';
import './HighlightsCards.css';

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toString();
}

const AWARDS_CONFIG = {
  best: { icon: '🏆', title: 'Лучший матч', tone: 'good' },
  hardest: { icon: '🧨', title: 'Самый сложный матч', tone: 'muted' },
  mvp: { icon: '🎯', title: 'MVP (по киллам)', tone: 'mvp' },
  comeback: { icon: '🚀', title: 'Лучший камбэк', tone: 'good' }
};

function HighlightMatchCard({ config, match, onClick }) {
  if (!match) return null;

  return (
    <button
      type="button"
      className={`highlight-card highlight-${config.tone}`}
      onClick={onClick}
    >
      <div className="highlight-title">
        <span className="highlight-icon" aria-hidden="true">
          {config.icon}
        </span>
        <span>{config.title}</span>
      </div>
      <div className="highlight-main">
        <div className="highlight-main-row">
          <span className="highlight-main-value table-number">
            Матч {formatNumber(match.matchIndex)}
          </span>
        </div>
        <div className="highlight-row">
          <span className="highlight-label">Место</span>
          <span className="highlight-value table-number">
            {formatNumber(match.placement)}
          </span>
        </div>
        <div className="highlight-row">
          <span className="highlight-label">Киллы</span>
          <span className="highlight-value table-number">
            {match.kills != null ? match.kills : '—'}
          </span>
        </div>
        <div className="highlight-row">
          <span className="highlight-label">Очки</span>
          <span className="highlight-value table-number">
            {match.points != null ? match.points : '—'}
          </span>
        </div>
        {match.delta != null && (
          <div className="highlight-row">
            <span className="highlight-label">Прирост к прошлому</span>
            <span className="highlight-value table-number">
              +{formatNumber(match.delta)}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function MvpCard({ mvp, onClick }) {
  if (!mvp) return null;

  const config = AWARDS_CONFIG.mvp;

  return (
    <button
      type="button"
      className="highlight-card highlight-mvp"
      onClick={onClick}
    >
      <div className="highlight-title">
        <span className="highlight-icon" aria-hidden="true">
          {config.icon}
        </span>
        <span>{config.title}</span>
      </div>
      <div className="highlight-main">
        <div className="highlight-main-row">
          <span className="highlight-main-value">{mvp.playerName}</span>
        </div>
        <div className="highlight-row">
          <span className="highlight-label">Всего киллов</span>
          <span className="highlight-value table-number">
            {formatNumber(mvp.totalKills)}
          </span>
        </div>
      </div>
    </button>
  );
}

function HighlightsCards({ highlights, onAwardClick }) {
  if (!highlights) return null;

  const { bestMatch, worstMatch, mvp, comeback } = highlights;

  if (!bestMatch && !worstMatch && !mvp && !comeback) {
    return null;
  }

  return (
    <div className="highlights-section">
      <h2>Награды турнира</h2>
      <div className="highlights-grid">
        {bestMatch && (
          <HighlightMatchCard
            config={AWARDS_CONFIG.best}
            match={bestMatch}
            onClick={() =>
              onAwardClick &&
              onAwardClick({ type: 'match', matchIndex: bestMatch.matchIndex })
            }
          />
        )}
        {worstMatch && (
          <HighlightMatchCard
            config={AWARDS_CONFIG.hardest}
            match={worstMatch}
            onClick={() =>
              onAwardClick &&
              onAwardClick({ type: 'match', matchIndex: worstMatch.matchIndex })
            }
          />
        )}
        {comeback && (
          <HighlightMatchCard
            config={AWARDS_CONFIG.comeback}
            match={comeback}
            onClick={() =>
              onAwardClick &&
              onAwardClick({ type: 'match', matchIndex: comeback.matchIndex })
            }
          />
        )}
        <MvpCard
          mvp={mvp}
          onClick={() =>
            onAwardClick &&
            onAwardClick({ type: 'mvp', playerName: mvp.playerName })
          }
        />
      </div>
    </div>
  );
}

export default HighlightsCards;

