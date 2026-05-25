import React from 'react';
import FeedCard from './FeedCard';
import './FeedList.css';

/**
 * Список карточек ленты
 * @param {Object} props
 * @param {Array} props.posts - массив постов
 * @param {Function} props.onRegisterClick - callback для регистрации
 * @param {Function} props.onPromoClick - callback для промо
 */
function FeedList({ posts = [], currentPlayerId, tournamentOverrides = {}, onRegisterClick, onPromoClick }) {
  if (!posts.length) {
    return null;
  }

  return (
    <div className="feed-list">
      {posts.map((post, index) => (
        <FeedCard
          key={post.id}
          post={post}
          isHero={index === 0}
          currentPlayerId={currentPlayerId}
          tournamentOverride={post.tournamentId ? tournamentOverrides[post.tournamentId] : null}
          onRegisterClick={onRegisterClick}
          onPromoClick={onPromoClick}
        />
      ))}
    </div>
  );
}

export default FeedList;
