import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MONTH_SHORT } from '@/entities/tournament';
import './ChampionshipsTile.css';

const VISIBLE_ITEMS = 5;

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = MONTH_SHORT[d.getMonth()] || '';
  return `${day} ${month}`;
}

function ChampionshipsTile({ championships }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  const data = championships || {
    total: 0,
    solo: 0,
    team: 0,
    items: [],
    updatedAt: null
  };

  const total = data.total ?? 0;
  const solo = data.solo ?? 0;
  const team = data.team ?? 0;
  const items = Array.isArray(data.items) ? data.items : [];
  const visibleItems = showAll ? items : items.slice(0, VISIBLE_ITEMS);
  const hasMore = items.length > VISIBLE_ITEMS;

  useEffect(() => {
    if (!open) setShowAll(false);
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target) && popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const toggleShowAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowAll((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className="championships-tile-wrap"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={`championships-tile ${open ? 'championships-tile--open' : ''} ${hover ? 'championships-tile--hover' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Чемпионства"
      >
        <span className="championships-tile__icon" aria-hidden>🏆</span>
        <span className="championships-tile__label">Чемпионства</span>
        <span className="championships-tile__value">{total}</span>
      </button>

      {(open || hover) && (
        <div
          ref={popoverRef}
          className="championships-popover"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="championships-popover__inner">
            {total === 0 ? (
              <p className="championships-popover__empty">Пока нет чемпионств</p>
            ) : (
              <>
                <div className="championships-popover__breakdown">
                  <span>Соло: <strong>{solo}</strong></span>
                  <span>Командой: <strong>{team}</strong></span>
                </div>
                {items.length > 0 && (
                  <ul className="championships-popover__list">
                    {visibleItems.map((item, idx) => (
                      <li key={`${item.tournamentId}-${item.kind}-${idx}`}>
                        <Link
                          to={`/tournament/${item.tournamentId}`}
                          className="championships-popover__link"
                          onClick={() => setOpen(false)}
                        >
                          <span className="championships-popover__name">[{item.tournamentName}]</span>
                          <span className="championships-popover__meta">
                            {formatDate(item.date)} · {item.mode || '—'} · {item.kind === 'solo' ? 'solo' : (item.teamName || 'team')}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {hasMore && !showAll && (
                  <button
                    type="button"
                    className="championships-popover__show-all"
                    onClick={toggleShowAll}
                  >
                    Показать все
                  </button>
                )}
                {hasMore && showAll && (
                  <button
                    type="button"
                    className="championships-popover__show-all"
                    onClick={() => setShowAll(false)}
                  >
                    Свернуть
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChampionshipsTile;
