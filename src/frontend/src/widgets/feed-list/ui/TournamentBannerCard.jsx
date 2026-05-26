import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournamentApi } from '@/services/api';
import { computeTimeLabel, computeBannerState } from '@/utils/timeLabel';
import { resolveTournamentCover, resolveCoverAlt, formatFeedDate, formatMode } from '@/entities/feed-post';
import { getMyRegistration, getRegistrationRules, isRegistrationClosed, getFreeAgentsCount } from '@/entities/tournament';
import { StatusLabel } from '@/entities/feed-post';
import './TournamentBannerCard.css';

/**
 * Карточка турнира для ленты
 * @param {Object} props
 * @param {Object} props.post - данные поста из feed.json
 * @param {boolean} props.isHero - первый турнир в ленте (увеличенная высота)
 * @param {string} props.currentPlayerId - ник текущего пользователя
 * @param {Object} props.tournamentOverride - обновлённый турнир (после регистрации)
 * @param {Function} props.onRegisterClick - callback для клика по CTA
 */
function TournamentBannerCard({ post, isHero = false, currentPlayerId, tournamentOverride, onRegisterClick }) {
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadTournament = async () => {
      if (!post?.tournamentId) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        const data = await tournamentApi.getById(post.tournamentId);
        setTournament(data);
        setError(false);
      } catch (err) {
        console.warn(`Tournament not found: ${post.tournamentId}`, err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadTournament();
  }, [post?.tournamentId]);

  const effectiveTournament = tournamentOverride ?? tournament;
  const myRegistration = getMyRegistration(effectiveTournament, currentPlayerId);

  const handleCardClick = () => {
    if (error || !post?.tournamentId) {
      navigate('/tournaments');
    } else {
      navigate(`/tournament/${post.tournamentId}`);
    }
  };

  const handleOpenClick = (e) => {
    e.stopPropagation();
    if (error || !post?.tournamentId) {
      navigate('/tournaments');
    } else {
      navigate(`/tournament/${post.tournamentId}`);
    }
  };

  const handleRegisterClick = (e) => {
    e.stopPropagation();
    if (onRegisterClick && effectiveTournament) {
      onRegisterClick(effectiveTournament, post);
    }
  };

  // Скрываем карточку если турнир не найден (опционально можно показать с badge)
  // По требованию: лучше скрыть и залогировать
  if (error && !loading) {
    return null;
  }

  const coverUrl = resolveTournamentCover(post, effectiveTournament);
  const coverAlt = resolveCoverAlt(post, effectiveTournament);
  const timeLabel = computeTimeLabel(effectiveTournament);
  const bannerState = computeBannerState(effectiveTournament);
  const regRules = getRegistrationRules(effectiveTournament);
  const regClosed = isRegistrationClosed(effectiveTournament);
  const mode = effectiveTournament?.type || effectiveTournament?.mode || '';
  const date = effectiveTournament?.date;
  const name = effectiveTournament?.name || 'Турнир';

  // Микро-мета: price, участники/команды
  const price = effectiveTournament?.price;
  const prizeLabel = effectiveTournament?.prizePool != null || effectiveTournament?.prize != null
    ? 'Приз'
    : null;
  const entries = effectiveTournament?.registration?.entries || [];
  const teamsCount = entries.filter((e) => e.kind === 'team').length;
  const soloCount = entries.filter((e) => e.kind === 'solo').length;
  const freeAgentsCount = getFreeAgentsCount(effectiveTournament);
  const freeAgentActive = myRegistration?.kind === 'free_agent';

  // CTA по BannerState и регистрации
  let primaryCta = null;
  let secondaryCta = null;
  let regClosedText = false;

  if (bannerState === 'DONE') {
    primaryCta = { label: 'Открыть итоги', onClick: handleOpenClick };
  } else if (bannerState === 'LIVE') {
    primaryCta = { label: 'Смотреть', onClick: handleOpenClick };
  } else if (bannerState === 'UNKNOWN') {
    primaryCta = { label: 'Открыть', onClick: handleOpenClick };
  } else if (bannerState === 'TODAY' || bannerState === 'UPCOMING') {
    if (myRegistration) {
      primaryCta = { label: 'Открыть', onClick: handleOpenClick };
    } else if (regRules.enabled && !regClosed) {
      primaryCta = { label: 'Регистрация', onClick: handleRegisterClick };
      secondaryCta = { label: 'Открыть', onClick: handleOpenClick };
    } else if (regClosed) {
      primaryCta = { label: 'Открыть', onClick: handleOpenClick };
      regClosedText = true;
    } else {
      primaryCta = { label: 'Открыть', onClick: handleOpenClick };
    }
  } else {
    primaryCta = { label: 'Открыть', onClick: handleOpenClick };
  }

  return (
    <article 
      className={`feed-card feed-card--tournament ${isHero ? 'feed-card--hero' : ''} ${loading ? 'feed-card--loading' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
    >
      {/* Background image */}
      <div className="feed-card__bg">
        <img 
          src={coverUrl} 
          alt={coverAlt}
          className="feed-card__bg-image"
          loading="lazy"
        />
        <div className="feed-card__overlay" />
      </div>

      {/* Content */}
      <div className="feed-card__content">
        {/* Top row: Status + Meta */}
        <div className="feed-card__top">
          <div className="feed-card__top-left">
            <StatusLabel label={timeLabel.label} variant={timeLabel.variant} />
            {freeAgentActive && (
              <span className="feed-card__registered-chip feed-card__free-agent-chip">Вы в пуле свободных агентов</span>
            )}
            {myRegistration && !freeAgentActive && (
              <span className="feed-card__registered-chip">Вы зарегистрированы</span>
            )}
          </div>
          <div className="feed-card__meta">
            {mode && (
              <span className="feed-card__chip">{formatMode(mode)}</span>
            )}
            {date && (
              <span className="feed-card__chip">{formatFeedDate(date)}</span>
            )}
            {price != null && (
              <span className="feed-card__chip">Взнос: {Number(price)}₽</span>
            )}
            {prizeLabel && (
              <span className="feed-card__chip">{prizeLabel}</span>
            )}
            {teamsCount > 0 && (
              <span className="feed-card__chip">Команд: {teamsCount}</span>
            )}
            {soloCount > 0 && (
              <span className="feed-card__chip">Участников: {soloCount}</span>
            )}
            {freeAgentsCount > 0 && (
              <span className="feed-card__chip">Свободных агентов: {freeAgentsCount}</span>
            )}
          </div>
        </div>

        {/* Bottom row: Title + CTA */}
        <div className="feed-card__bottom">
          <div className="feed-card__info">
            <h3 className="feed-card__title">{name}</h3>
            {effectiveTournament?.rules && (
              <p className="feed-card__desc feed-card__desc--clamp">{effectiveTournament.rules}</p>
            )}
          </div>
          <div className="feed-card__cta-row">
            {secondaryCta && (
              <button
                className="feed-card__cta btn btn-secondary"
                onClick={secondaryCta.onClick}
              >
                {secondaryCta.label}
              </button>
            )}
            {primaryCta && (
              <button
                className="feed-card__cta btn btn-primary"
                onClick={primaryCta.onClick}
              >
                {primaryCta.label}
              </button>
            )}
            {regClosedText && (
              <span className="feed-card__reg-closed">Регистрация закрыта</span>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="feed-card__loader">
          <div className="feed-card__loader-spinner" />
        </div>
      )}
    </article>
  );
}

export default TournamentBannerCard;
