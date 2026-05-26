import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ladderApi } from '@/services/api';
import { useLayoutConfig } from '@/contexts/LayoutConfigContext';
import { EmptyState, Skeleton } from '@/shared/ui';
import { LadderRankBadge } from '@/entities/ladder';
import './Ladder.css';

const CURRENT_YEAR = new Date().getFullYear();
const SEASON_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].filter((y) => y >= 2024);

function Ladder() {
  useLayoutConfig({ pageTitleOverride: 'Турнирный рейтинг (Ladder)' });
  const [season, setSeason] = useState(String(CURRENT_YEAR));
  const [data, setData] = useState({ rows: [], season: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await ladderApi.getLeaderboard(season);
        if (!cancelled) {
          setData(res);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Ошибка загрузки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [season]);

  const rows = data.rows || [];

  return (
    <div className="ladder-page">
      <div className="ladder-controls">
        <label className="ladder-season-label">
          Сезон:
          <select
            className="ladder-season-select"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          >
            {SEASON_OPTIONS.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="ladder-description">
        Ladder — турнирный соревновательный рейтинг. Обновляется после каждого завершённого турнира.
      </p>

      {error && <div className="ladder-error">{error}</div>}

      {loading ? (
        <Skeleton lines={12} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Нет данных"
          description="В этом сезоне пока нет записей в турнирном рейтинге. Ladder обновляется после закрытия турниров."
        />
      ) : (
        <div className="ladder-table-wrap">
          <table className="ladder-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Игрок</th>
                <th>Ladder Rating</th>
                <th>Ранг</th>
                <th>Изменение</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.player_id}>
                  <td>{row.place}</td>
                  <td>
                    <Link to={`/player/${encodeURIComponent(row.player_id)}`} className="ladder-player-link">
                      {row.player_id}
                    </Link>
                  </td>
                  <td>{row.ladder_rating}</td>
                  <td>
                    {row.ladder_rank_label ? (
                      <LadderRankBadge label={row.ladder_rank_label} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {row.last_delta != null ? (
                      <span className={row.last_delta >= 0 ? 'ladder-delta--pos' : 'ladder-delta--neg'}>
                        {row.last_delta >= 0 ? '+' : ''}{row.last_delta}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Ladder;
