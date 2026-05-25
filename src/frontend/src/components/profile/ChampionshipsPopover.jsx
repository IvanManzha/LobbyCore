import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MONTH_SHORT } from '../../utils/registration';
import './ChampionshipsPopover.css';

const VISIBLE_ITEMS = 5;

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = MONTH_SHORT[d.getMonth()] || '';
  return `${day} ${month}`;
}

export default function ChampionshipsPopover({
  anchorRef,
  open,
  onClose,
  championships,
  placement = 'bottom-start'
}) {
  const [showAll, setShowAll] = useState(false);
  const popoverRef = useRef(null);

  const data = championships || { total: 0, solo: 0, team: 0, items: [] };
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
      if (
        anchorRef?.current?.contains(e.target) ||
        popoverRef?.current?.contains(e.target)
      ) return;
      onClose?.();
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open || !anchorRef?.current || !popoverRef?.current) return;

    const applyPosition = () => {
      if (!anchorRef?.current || !popoverRef?.current) return;
      const anchor = anchorRef.current.getBoundingClientRect();
      const pop = popoverRef.current;
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const gap = 8;

      let top = anchor.bottom + gap;
      let left = anchor.left;

      pop.style.position = 'fixed';
      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;

      requestAnimationFrame(() => {
        if (!popoverRef?.current) return;
        const popRect = popoverRef.current.getBoundingClientRect();
        let t = top;
        let l = left;
        if (t + popRect.height > viewH - gap) t = anchor.top - popRect.height - gap;
        if (t < gap) t = gap;
        if (l + popRect.width > viewW - gap) l = viewW - popRect.width - gap;
        if (l < gap) l = gap;
        popoverRef.current.style.top = `${t}px`;
        popoverRef.current.style.left = `${l}px`;
      });
    };

    applyPosition();
  }, [open, placement, anchorRef, items.length, showAll]);

  if (!open) return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      className="championships-popover championships-popover--award"
      role="dialog"
      aria-labelledby="championships-popover-title"
    >
      <div className="championships-popover__inner">
        <h3 id="championships-popover-title" className="championships-popover__title">
          Чемпионства
        </h3>

        {total === 0 ? (
          <div className="championships-popover__empty">
            <p className="championships-popover__empty-text">Пока нет чемпионств</p>
            <p className="championships-popover__empty-hint">
              Займите первое место в завершённом турнире — соло или в команде — и титул появится здесь.
            </p>
          </div>
        ) : (
          <>
            <div className="championships-popover__breakdown">
              <span>Соло: <strong>{solo}</strong></span>
              <span>Командой: <strong>{team}</strong></span>
            </div>

            {items.length > 0 ? (
              <>
                <ul className="championships-popover__list">
                  {visibleItems.map((item, idx) => (
                    <li key={`${item.tournamentId}-${item.kind}-${idx}`}>
                      <Link
                        to={`/tournament/${item.tournamentId}`}
                        className="championships-popover__link"
                        onClick={onClose}
                      >
                        <span className="championships-popover__name">
                          {item.tournamentName || 'Турнир'}
                        </span>
                        <span className="championships-popover__meta">
                          {formatDate(item.date)} · {item.mode || '—'} · {item.kind === 'solo' ? 'Соло' : (item.teamName ? `Команда: ${item.teamName}` : 'Командой')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {hasMore && !showAll && (
                  <button
                    type="button"
                    className="championships-popover__show-all"
                    onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                  >
                    Показать всё
                  </button>
                )}
                {hasMore && showAll && (
                  <button
                    type="button"
                    className="championships-popover__show-all"
                    onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
                  >
                    Свернуть
                  </button>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}
