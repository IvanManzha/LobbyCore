import React, { useMemo, useState, useEffect } from 'react';
import {
  MAX_PLAQUE_BADGES,
  listBackgroundAchievements,
  listBadgeAchievements,
  getUnlockedAchievementIds,
  normalizeLoadout,
} from '@/entities/achievement';
import { PlayerPlaque } from '@/entities/player';
import { usePlayerLoadout } from '@/entities/player';
import { useTranslation } from '@/contexts/LanguageContext';
import './PlaqueCustomizer.css';

function PlaqueCustomizer({ playerId, displayName }) {
  const { t } = useTranslation();
  const { loadout, setLoadout } = usePlayerLoadout(playerId);
  const [draft, setDraft] = useState(loadout);
  const [saveStatus, setSaveStatus] = useState(null);
  const unlocked = useMemo(() => new Set(getUnlockedAchievementIds()), []);

  useEffect(() => {
    setDraft(loadout);
  }, [loadout]);

  const backgrounds = listBackgroundAchievements();
  const badges = listBadgeAchievements();

  const toggleBadge = (id) => {
    setDraft((prev) => {
      const has = prev.badgeIds.includes(id);
      if (has) {
        return normalizeLoadout({
          ...prev,
          badgeIds: prev.badgeIds.filter((b) => b !== id),
        });
      }
      if (prev.badgeIds.length >= MAX_PLAQUE_BADGES) return prev;
      return normalizeLoadout({
        ...prev,
        badgeIds: [...prev.badgeIds, id],
      });
    });
  };

  const handleSave = () => {
    setLoadout(draft);
    setSaveStatus({ type: 'success', text: t('plaque.saveSuccess') });
  };

  const handleReset = () => {
    const empty = normalizeLoadout({ backgroundId: 'bg-default', badgeIds: [] });
    setDraft(empty);
    setLoadout(empty);
    setSaveStatus({ type: 'success', text: t('plaque.resetSuccess') });
  };

  useEffect(() => {
    if (!saveStatus) return undefined;
    const timer = window.setTimeout(() => setSaveStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  return (
    <div className="plaque-customizer">
      <p className="plaque-customizer__hint muted">{t('plaque.customizerHint')}</p>

      <div className="plaque-customizer__preview">
        <PlayerPlaque
          playerId={playerId}
          displayName={displayName}
          size="lg"
          loadout={draft}
          interactive={false}
        />
      </div>

      <div className="plaque-customizer__section">
        <h3 className="plaque-customizer__label">{t('plaque.background')}</h3>
        <div className="plaque-customizer__grid plaque-customizer__grid--bg">
          {backgrounds.map((bg) => {
            const active = draft.backgroundId === bg.id;
            const isUnlocked = unlocked.has(bg.id);
            return (
              <button
                key={bg.id}
                type="button"
                className={`plaque-customizer__bg-option ${active ? 'is-active' : ''} ${!isUnlocked ? 'is-locked' : ''}`}
                style={{ background: bg.background }}
                title={bg.description}
                disabled={!isUnlocked}
                onClick={() => isUnlocked && setDraft((p) => normalizeLoadout({ ...p, backgroundId: bg.id }))}
              >
                <span>{bg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="plaque-customizer__section">
        <h3 className="plaque-customizer__label">
          {t('plaque.badges')} ({draft.badgeIds.length}/{MAX_PLAQUE_BADGES})
        </h3>
        <div className="plaque-customizer__grid plaque-customizer__grid--badges">
          {badges.map((badge) => {
            const active = draft.badgeIds.includes(badge.id);
            const isUnlocked = unlocked.has(badge.id);
            const slotsFull = draft.badgeIds.length >= MAX_PLAQUE_BADGES && !active;
            return (
              <button
                key={badge.id}
                type="button"
                className={`plaque-customizer__badge-option ${active ? 'is-active' : ''} ${!isUnlocked || slotsFull ? 'is-disabled' : ''}`}
                title={badge.description}
                disabled={!isUnlocked || (slotsFull && !active)}
                onClick={() => {
                  if (!isUnlocked) return;
                  if (active || !slotsFull) toggleBadge(badge.id);
                }}
              >
                <span className="plaque-customizer__badge-icon">{badge.icon}</span>
                <span className="plaque-customizer__badge-label">{badge.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="plaque-customizer__actions">
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          {t('plaque.saveLoadout')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleReset}>
          {t('plaque.resetLoadout')}
        </button>
        {saveStatus && (
          <p
            className={`plaque-customizer__status plaque-customizer__status--${saveStatus.type}`}
            role="status"
            aria-live="polite"
          >
            {saveStatus.text}
          </p>
        )}
      </div>
    </div>
  );
}

export default PlaqueCustomizer;
