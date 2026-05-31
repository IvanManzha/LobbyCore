import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getCosmeticById } from '@/entities/achievement';
import { useTranslation } from '@/contexts/LanguageContext';
import { usePlayerLoadout } from '../model/usePlayerLoadout';
import './PlayerPlaque.css';

const SIZE_CLASS = {
  xs: 'player-plaque--xs',
  sm: 'player-plaque--sm',
  md: 'player-plaque--md',
  lg: 'player-plaque--lg',
  hero: 'player-plaque--hero',
  row: 'player-plaque--row',
  table: 'player-plaque--table',
};

function resolveBackgroundStyle(backgroundId) {
  const def = getCosmeticById(backgroundId);
  if (def?.background) {
    return { background: def.background };
  }
  const fallback = getCosmeticById('bg-yourself');
  return { background: fallback?.background || 'var(--surface2)' };
}

/**
 * @param {Object} props
 * @param {string} props.playerId
 * @param {string} [props.displayName]
 * @param {'xs'|'sm'|'md'|'lg'|'hero'|'row'|'table'} [props.size]
 * @param {import('@/entities/achievement').PlayerPlaqueLoadout} [props.loadout]
 * @param {string} [props.to]
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.trailing]
 * @param {boolean} [props.interactive]
 * @param {string} [props.className]
 */
function PlayerPlaque({
  playerId,
  displayName,
  size = 'md',
  loadout: loadoutProp,
  to,
  subtitle,
  trailing,
  interactive = true,
  className = '',
}) {
  const { t } = useTranslation();
  const name = (displayName || playerId || '?').trim();
  const { loadout: fetchedLoadout } = usePlayerLoadout(playerId, {
    preferStored: Boolean(loadoutProp),
  });
  const loadout = loadoutProp || fetchedLoadout;

  const badges = useMemo(
    () =>
      (loadout?.badgeIds || [])
        .map((id) => getCosmeticById(id))
        .filter(Boolean)
        .slice(0, 3),
    [loadout?.badgeIds],
  );

  const bgStyle = resolveBackgroundStyle(loadout?.backgroundId);
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;
  const hasBadges = badges.length > 0;

  const inner = (
    <>
      <div className="player-plaque__bg" style={bgStyle} aria-hidden />
      <div className="player-plaque__overlay" aria-hidden />
      <div className="player-plaque__body">
        <div className="player-plaque__text">
          <span className="player-plaque__name" title={name}>
            {name}
          </span>
          {subtitle ? (
            <span className="player-plaque__subtitle" title={subtitle}>
              {subtitle}
            </span>
          ) : null}
        </div>
        {trailing ? <div className="player-plaque__trailing">{trailing}</div> : null}
      </div>
      {hasBadges && (
        <div
          className={`player-plaque__badges${badges.length === 1 ? ' player-plaque__badges--single' : ''}`}
          aria-label="Achievement badges"
        >
          {badges.length >= 2 ? (
            <div className="player-plaque__badges-pair">
              {badges.slice(0, 2).map((badge) => (
                <span key={badge.id} className="player-plaque__badge" title={t(badge.labelKey)}>
                  {badge.icon || '★'}
                </span>
              ))}
            </div>
          ) : (
            <span className="player-plaque__badge" title={t(badges[0].labelKey)}>
              {badges[0].icon || '★'}
            </span>
          )}
          {badges[2] ? (
            <span className="player-plaque__badge player-plaque__badge--apex" title={t(badges[2].labelKey)}>
              {badges[2].icon || '★'}
            </span>
          ) : null}
        </div>
      )}
    </>
  );

  const rootClass = [
    'player-plaque',
    sizeClass,
    hasBadges ? 'player-plaque--has-badges' : '',
    interactive && to ? 'player-plaque--link' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (to && interactive) {
    return (
      <Link to={to} className={rootClass}>
        {inner}
      </Link>
    );
  }

  return <div className={rootClass}>{inner}</div>;
}

export default React.memo(PlayerPlaque);
