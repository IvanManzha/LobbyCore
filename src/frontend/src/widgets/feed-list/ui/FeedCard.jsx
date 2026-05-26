import React from 'react';
import TournamentBannerCard from './TournamentBannerCard';
import PromoBannerCard from './PromoBannerCard';

/**
 * Wrapper компонент для карточки ленты
 * Выбирает правильный компонент в зависимости от типа поста
 * @param {Object} props
 * @param {Object} props.post - данные поста
 * @param {Function} props.onRegisterClick - callback для регистрации
 * @param {Function} props.onPromoClick - callback для промо
 */
function FeedCard({ post, isHero = false, currentPlayerId, tournamentOverride, onRegisterClick, onPromoClick }) {
  if (!post) return null;

  switch (post.type) {
    case 'tournament':
      return (
        <TournamentBannerCard 
          post={post} 
          isHero={isHero}
          currentPlayerId={currentPlayerId}
          tournamentOverride={tournamentOverride}
          onRegisterClick={onRegisterClick}
        />
      );
    
    case 'promo':
      return (
        <PromoBannerCard 
          post={post} 
          onPromoClick={onPromoClick}
        />
      );
    
    default:
      console.warn(`Unknown post type: ${post.type}`);
      return null;
  }
}

export default FeedCard;
