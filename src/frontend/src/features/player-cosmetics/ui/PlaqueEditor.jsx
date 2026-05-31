import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  MAX_PLAQUE_BADGES,
  listBackgroundCosmetics,
  listBadgeCosmetics,
  normalizeLoadout,
  DEFAULT_PLAQUE_LOADOUT,
  usePlayerAchievements,
  getAchievementStateForCosmetic,
  getCosmeticById,
} from '@/entities/achievement';
import { PlayerPlaque } from '@/entities/player';
import { useTranslation } from '@/contexts/LanguageContext';
import './PlaqueEditor.css';

function ProgressReveal({ state, t, id }) {
  if (!state) return null;
  const { achievement, unlocked, current, target, progressRatio } = state;
  const pct = Math.round(progressRatio * 100);

  return (
    <div className="plaque-editor__progress-reveal" id={id} role="region" aria-live="polite">
      {unlocked ? (
        <div className="plaque-editor__progress-reveal-done">{t('achievements.unlocked')}</div>
      ) : (
        <>
          <div className="plaque-editor__progress-reveal-stats">
            {t(achievement.progressKey, { current, target })}
          </div>
          <div className="plaque-editor__progress-bar" aria-hidden>
            <div className="plaque-editor__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="plaque-editor__progress-reveal-pct">{pct}%</div>
        </>
      )}
    </div>
  );
}

function BackgroundTile({ cosmetic, active, state, onSelect, t }) {
  const [tipPos, setTipPos] = useState(null);

  return (
    <>
      <div className={['plaque-editor__bg-wrap', active ? 'is-active' : ''].filter(Boolean).join(' ')}>
        <button
          type="button"
          className="plaque-editor__bg-tile plaque-editor__bg-swatch"
          style={{ background: cosmetic.background }}
          onClick={onSelect}
          onMouseEnter={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
          onMouseMove={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setTipPos(null)}
          aria-label={t(cosmetic.labelKey)}
          aria-pressed={active}
        >
          <span className="plaque-editor__bg-tile-label">{t(cosmetic.labelKey)}</span>
        </button>
      </div>
      {tipPos && state ? <CursorTooltip state={state} t={t} position={tipPos} /> : null}
    </>
  );
}

function CursorTooltip({ state, t, position }) {
  if (!state || !position) return null;

  const { achievement, unlocked, current, target } = state;
  const offset = 14;
  const maxLeft = window.innerWidth - 260;
  const maxTop = window.innerHeight - 120;
  const left = Math.min(position.x + offset, maxLeft);
  const top = Math.min(position.y + offset, maxTop);

  return createPortal(
    <div
      className="plaque-editor__cursor-tip"
      style={{ left, top }}
      role="tooltip"
    >
      <div className="plaque-editor__cursor-tip-title">{t(achievement.titleKey)}</div>
      <div className="plaque-editor__cursor-tip-desc">{t(achievement.descriptionKey)}</div>
      {!unlocked ? (
        <div className="plaque-editor__cursor-tip-progress">
          {t(achievement.progressKey, { current, target })}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function BadgeChip({ cosmetic, active, selectable, state, onSelect, t }) {
  const [tipPos, setTipPos] = useState(null);

  return (
    <>
      <button
        type="button"
        className={[
          'plaque-editor__badge-chip',
          active ? 'is-active' : '',
          !selectable ? 'is-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => selectable && onSelect?.()}
        onMouseEnter={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTipPos(null)}
        disabled={!selectable && !state}
        aria-label={t(cosmetic.labelKey)}
        aria-pressed={active}
      >
        <span className="plaque-editor__badge-chip-icon" aria-hidden>
          {cosmetic.icon}
        </span>
      </button>
      {tipPos && state ? <CursorTooltip state={state} t={t} position={tipPos} /> : null}
    </>
  );
}

function AchievementRewardPreview({ achievement, t }) {
  const bg = achievement.grants.backgroundId
    ? getCosmeticById(achievement.grants.backgroundId)
    : null;
  const badge = achievement.grants.badgeId
    ? getCosmeticById(achievement.grants.badgeId)
    : null;

  if (!bg && !badge) return null;

  return (
    <div className="plaque-editor__ach-reward" aria-hidden>
      {bg ? (
        <div
          className="plaque-editor__ach-reward-bg"
          style={{ background: bg.background }}
          title={t(bg.labelKey)}
        />
      ) : null}
      {badge ? (
        <span className="plaque-editor__ach-reward-badge" title={t(badge.labelKey)}>
          {badge.icon}
        </span>
      ) : null}
    </div>
  );
}

function AchievementRow({ state, t }) {
  const [expanded, setExpanded] = useState(false);
  const { achievement, unlocked } = state;

  const canExpand = !unlocked;
  const progressId = `ach-progress-${achievement.id}`;

  const handleToggle = () => {
    if (canExpand) setExpanded((open) => !open);
  };

  return (
    <article
      className={[
        'plaque-editor__ach',
        unlocked ? 'plaque-editor__ach--done' : 'plaque-editor__ach--locked',
        expanded ? 'plaque-editor__ach--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="plaque-editor__ach-main"
        onClick={handleToggle}
        disabled={!canExpand}
        aria-expanded={canExpand ? expanded : undefined}
        aria-controls={canExpand ? progressId : undefined}
      >
        <div className="plaque-editor__ach-icon" aria-hidden>
          {unlocked ? '✓' : '·'}
        </div>
        <div className="plaque-editor__ach-body">
          <div className="plaque-editor__ach-head">
            <div className="plaque-editor__ach-title">{t(achievement.titleKey)}</div>
            <span
              className={`plaque-editor__ach-badge${unlocked ? ' plaque-editor__ach-badge--done' : ''}`}
            >
              {unlocked ? t('achievements.unlocked') : t('achievements.locked')}
            </span>
          </div>
          <div className="plaque-editor__ach-desc">{t(achievement.descriptionKey)}</div>
          {canExpand ? (
            <div className="plaque-editor__ach-meta">
              <span className="plaque-editor__ach-hint">
                {expanded ? t('achievements.hideProgress') : t('achievements.showProgress')}
              </span>
            </div>
          ) : null}
        </div>
        <AchievementRewardPreview achievement={achievement} t={t} />
        {canExpand ? (
          <span className={`plaque-editor__ach-chevron${expanded ? ' is-open' : ''}`} aria-hidden>
            ›
          </span>
        ) : null}
      </button>
      {canExpand && expanded ? (
        <div className="plaque-editor__ach-reveal" id={progressId}>
          <ProgressReveal state={state} t={t} />
        </div>
      ) : null}
    </article>
  );
}

export default function PlaqueEditor({ playerId, displayName }) {
  const { t } = useTranslation();
  const {
    loading,
    error,
    loadout,
    setLoadout,
    states,
    unlockedCosmetics,
    unlockedCount,
    totalCount,
  } = usePlayerAchievements(playerId);

  const [draft, setDraft] = useState(() => ({ ...DEFAULT_PLAQUE_LOADOUT }));
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    if (loadout) setDraft(loadout);
  }, [loadout]);

  const unlockedBackgrounds = useMemo(
    () => listBackgroundCosmetics().filter((bg) => unlockedCosmetics.backgroundIds.has(bg.id)),
    [unlockedCosmetics],
  );

  const unlockedBadges = useMemo(
    () => listBadgeCosmetics().filter((badge) => unlockedCosmetics.badgeIds.has(badge.id)),
    [unlockedCosmetics],
  );

  const toggleBadge = (id) => {
    setDraft((prev) => {
      const has = prev.badgeIds.includes(id);
      if (has) {
        return normalizeLoadout(
          { ...prev, badgeIds: prev.badgeIds.filter((b) => b !== id) },
          unlockedCosmetics,
        );
      }
      if (prev.badgeIds.length >= MAX_PLAQUE_BADGES) return prev;
      return normalizeLoadout(
        { ...prev, badgeIds: [...prev.badgeIds, id] },
        unlockedCosmetics,
      );
    });
  };

  const handleSave = async () => {
    const normalized = normalizeLoadout(draft, unlockedCosmetics);
    setDraft(normalized);
    try {
      await setLoadout(normalized);
      setSaveStatus({ type: 'success', text: t('plaque.saveSuccess') });
    } catch {
      setSaveStatus({ type: 'error', text: t('plaque.saveError') });
    }
  };

  const handleReset = async () => {
    const empty = { ...DEFAULT_PLAQUE_LOADOUT };
    setDraft(empty);
    try {
      await setLoadout(empty);
      setSaveStatus({ type: 'success', text: t('plaque.resetSuccess') });
    } catch {
      setSaveStatus({ type: 'error', text: t('plaque.saveError') });
    }
  };

  useEffect(() => {
    if (!saveStatus) return undefined;
    const timer = window.setTimeout(() => setSaveStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  const previewSubtitle = useMemo(
    () => t('plaque.editorPreviewSubtitle', { unlocked: unlockedCount, total: totalCount }),
    [t, unlockedCount, totalCount],
  );

  if (loading) {
    return <div className="plaque-editor plaque-editor--loading muted">{t('achievements.loading')}</div>;
  }

  if (error) {
    return (
      <div className="plaque-editor plaque-editor--error">
        <p>{error}</p>
        <Link to="/settings" className="btn btn-ghost">{t('common.back')}</Link>
      </div>
    );
  }

  return (
    <div className="plaque-editor">
      <section className="plaque-editor__preview-section">
        <h2 className="plaque-editor__section-title">{t('plaque.preview')}</h2>
        <div className="plaque-editor__preview-wrap">
          <PlayerPlaque
            playerId={playerId}
            displayName={displayName}
            size="table"
            loadout={draft}
            subtitle={previewSubtitle}
            interactive={false}
          />
        </div>
      </section>

      {unlockedBackgrounds.length > 0 ? (
        <section className="plaque-editor__section">
          <h2 className="plaque-editor__section-title">{t('plaque.background')}</h2>
          <div className="plaque-editor__bg-list">
            {unlockedBackgrounds.map((bg) => (
              <BackgroundTile
                key={bg.id}
                cosmetic={bg}
                active={draft.backgroundId === bg.id}
                state={getAchievementStateForCosmetic(states, bg.id)}
                t={t}
                onSelect={() =>
                  setDraft((p) => normalizeLoadout({ ...p, backgroundId: bg.id }, unlockedCosmetics))
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {unlockedBadges.length > 0 ? (
        <section className="plaque-editor__section">
          <h2 className="plaque-editor__section-title">
            {t('plaque.badges')} ({draft.badgeIds.length}/{MAX_PLAQUE_BADGES})
          </h2>
          <div className="plaque-editor__badge-list">
            {unlockedBadges.map((badge) => {
              const active = draft.badgeIds.includes(badge.id);
              const slotsFull = draft.badgeIds.length >= MAX_PLAQUE_BADGES && !active;
              const selectable = !slotsFull || active;
              return (
                <BadgeChip
                  key={badge.id}
                  cosmetic={badge}
                  active={active}
                  selectable={selectable}
                  state={getAchievementStateForCosmetic(states, badge.id)}
                  t={t}
                  onSelect={() => toggleBadge(badge.id)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="plaque-editor__section">
        <div className="plaque-editor__section-head">
          <h2 className="plaque-editor__section-title">{t('achievements.listTitle')}</h2>
          <span className="plaque-editor__ach-summary">
            {unlockedCount}/{totalCount}
          </span>
        </div>
        <div className="plaque-editor__ach-list">
          {states.map((state) => (
            <AchievementRow key={state.achievement.id} state={state} t={t} />
          ))}
        </div>
      </section>

      <div className="plaque-editor__actions">
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          {t('plaque.saveLoadout')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleReset}>
          {t('plaque.resetLoadout')}
        </button>
        {saveStatus && (
          <p
            className={`plaque-editor__status plaque-editor__status--${saveStatus.type}`}
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
