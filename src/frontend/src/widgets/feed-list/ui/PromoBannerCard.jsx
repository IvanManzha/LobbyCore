import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TournamentBannerCard.css'; // Base styles
import './PromoBannerCard.css';

/**
 * Карточка промо-материала для ленты
 * @param {Object} props
 * @param {Object} props.post - данные поста из feed.json
 * @param {Function} props.onPromoClick - callback для клика по промо без href
 */
function PromoBannerCard({ post, onPromoClick }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (post?.cta?.href) {
      navigate(post.cta.href);
    } else if (onPromoClick) {
      onPromoClick(post);
    }
  };

  const handleCtaClick = (e) => {
    e.stopPropagation();
    handleCardClick();
  };

  const coverUrl = post?.image?.url || '/assets/feed/covers/cover_default.svg';
  const coverAlt = post?.image?.alt || 'Promo';

  return (
    <article 
      className="feed-card feed-card--promo"
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
        <div className="feed-card__overlay feed-card__overlay--promo" />
      </div>

      {/* Content */}
      <div className="feed-card__content">
        {/* Top row: Promo badge */}
        <div className="feed-card__top">
          <span className="feed-promo-badge">ПРОМО</span>
        </div>

        {/* Bottom row: Title + Text + CTA */}
        <div className="feed-card__bottom">
          <div className="feed-card__info">
            {post?.title && (
              <h3 className="feed-card__title">{post.title}</h3>
            )}
            {post?.text && (
              <p className="feed-card__desc feed-card__desc--promo">{post.text}</p>
            )}
          </div>
          {post?.cta && (
            <button 
              className="feed-card__cta btn btn-secondary"
              onClick={handleCtaClick}
            >
              {post.cta.label || 'Подробнее'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default PromoBannerCard;
