import React from 'react';
import { Link } from 'react-router-dom';
import './HallOfFame.css';

function HallOfFame({ tournament, table, getTournamentId }) {
  const tid = getTournamentId(tournament);
  const teams = table?.teams || [];
  const sorted = teams
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const top1 = sorted[0];
  const top3 = sorted.slice(0, 3);
  const bestKills = teams.reduce((best, t) => {
    const k = (t.results || []).reduce((s, r) => s + (r?.kills ?? 0), 0);
    return k > (best?.kills ?? -1) ? { name: t.name, kills: k } : best;
  }, null);

  const hasData = top1 || (bestKills && bestKills.kills > 0) || top3.length > 0;
  if (!hasData) return null;

  return (
    <div className="hall-of-fame">
      <h3 className="hall-of-fame-title">Hall of Fame</h3>
      <div className="hall-of-fame-body">
        {top1 && (
          <div className="hall-of-fame-item">
            <span className="hall-of-fame-label">Последний чемпион</span>
            <Link to={`/tournament/${tid}`} className="hall-of-fame-value hall-of-fame-link">
              {top1.name}
              {top1.totalPoints != null && ` (${top1.totalPoints})`}
            </Link>
          </div>
        )}
        {bestKills && bestKills.kills > 0 && (
          <div className="hall-of-fame-item">
            <span className="hall-of-fame-label">Больше всего киллов</span>
            <Link to={`/tournament/${tid}`} className="hall-of-fame-value hall-of-fame-link">
              {bestKills.name} — {bestKills.kills}
            </Link>
          </div>
        )}
        {top3.length > 0 && (
          <div className="hall-of-fame-item">
            <span className="hall-of-fame-label">Топ-3</span>
            <div className="hall-of-fame-top3">
              {top3.map((t, i) => (
                <span key={t.name || i} className="hall-of-fame-top3-item">
                  {t.rank}. {t.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <Link to={`/tournament/${tid}`} className="hall-of-fame-cta btn btn-ghost">
        Открыть турнир
      </Link>
    </div>
  );
}

export default HallOfFame;
