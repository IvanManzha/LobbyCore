import React, { useState, useRef } from 'react';
import ChampionshipsPopover from './ChampionshipsPopover';
import './ChampionshipsAwardCard.css';

const TROPHY_IMAGE_SRC = '/trophy-award.png';

function TrophyIconFallback({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 56" fill="none" aria-hidden>
      <path
        d="M24 4C14 4 8 11 8 20v2c0 9 6 14 16 14s16-5 16-14v-2C40 11 34 4 24 4z"
        fill="currentColor"
        fillOpacity="0.8"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.4"
        strokeLinejoin="round"
      />
      <path d="M8 14a12 12 0 0 1 4 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" />
      <path d="M40 14a12 12 0 0 0-4 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" />
      <path d="M21 34h6v14h-6z" fill="currentColor" fillOpacity="0.9" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.35" strokeLinejoin="round" />
      <path d="M18 48h12l1.5 3h-15l1.5-3z" fill="currentColor" fillOpacity="0.95" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" strokeLinejoin="round" />
      <path d="M15 51h18l1 3H14l1-3z" fill="currentColor" fillOpacity="0.8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.45" strokeLinejoin="round" />
    </svg>
  );
}

function TrophyBadgeContent({ className }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return <TrophyIconFallback className={className} />;
  }

  return (
    <img
      src={TROPHY_IMAGE_SRC}
      alt=""
      className={className}
      onError={() => setImgError(true)}
    />
  );
}

export default function ChampionshipsAwardCard({ championships }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const cardRef = useRef(null);

  const data = championships || { total: 0, solo: 0, team: 0, items: [] };
  const total = data.total ?? 0;
  const solo = data.solo ?? 0;
  const team = data.team ?? 0;

  const breakdownLabel = total > 0
    ? `Соло: ${solo} • Командой: ${team}`
    : 'Пока без титулов';

  return (
    <>
      <div
        ref={cardRef}
        className={`
          championships-award
          ${open ? 'championships-award--open' : ''}
          ${hover ? 'championships-award--hover' : ''}
        `}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          type="button"
          className="championships-award__trigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Чемпионства, детали"
        >
          <div className="championships-award__badge" aria-hidden>
            <TrophyBadgeContent className="championships-award__badge-icon championships-award__badge-img" />
          </div>

          <div className="championships-award__content">
            <span className="championships-award__label">Чемпионства</span>
            <span className="championships-award__value">{total}</span>
            <span
              className={`championships-award__breakdown ${total > 0 || hover || open ? 'championships-award__breakdown--visible' : ''}`}
            >
              {breakdownLabel}
            </span>
          </div>

          <span className="championships-award__details" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
      </div>

      <ChampionshipsPopover
        anchorRef={cardRef}
        open={open}
        onClose={() => setOpen(false)}
        championships={championships}
        placement="bottom-start"
      />
    </>
  );
}
