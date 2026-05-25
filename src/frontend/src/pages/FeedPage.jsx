import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { feedApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useUnread } from '../contexts/UnreadContext';
import FeedList from '../components/feed/FeedList';
import RegisterModal from '../components/modals/RegisterModal';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { filterPostsByType } from '../utils/feed';
import { sortFeedPosts } from '../utils/feedSort';
import { useTranslation } from '../contexts/LanguageContext';
import './FeedPage.css';

function FeedPage() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const { user } = useAuth();
  const currentPlayerId = user?.pubgNick || user?.username || null;
  const defaultAdmin = 'admin';
  const adminUsers = (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map((s) => s.trim().toLowerCase());
  const isAdmin = user && adminUsers.includes(((user.pubgNick || user.username) || '').toLowerCase());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [tournamentOverrides, setTournamentOverrides] = useState({});
  const { setFeedLastUpdated, setLastSeenFeed } = useUnread();

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    setLastSeenFeed(Date.now());
  }, [setLastSeenFeed]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      const data = await feedApi.getAll();
      setPosts(data);
      setError(null);
      const arr = Array.isArray(data) ? data : [];
      const maxUpdated = arr.reduce((acc, p) => {
        const t = p.updatedAt || p.createdAt || 0;
        const ts = typeof t === 'number' ? t : new Date(t).getTime();
        return Math.max(acc, ts);
      }, 0);
      if (maxUpdated > 0) setFeedLastUpdated(maxUpdated);
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('feedPage.loadError'));
      console.error('Feed load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = useMemo(() => {
    const filtered = filterPostsByType(posts, activeFilter);
    return sortFeedPosts(filtered);
  }, [posts, activeFilter]);

  const handleRegisterClick = (tournament, post) => {
    setSelectedTournament(tournament);
    setModalOpen(true);
  };

  const handlePromoClick = (post) => {
    // Для промо без href можно показать модалку или сделать что-то ещё
    // Пока просто ничего не делаем, т.к. промо с href уже обрабатываются в карточке
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTournament(null);
  };

  const handleRegistrationSuccess = useCallback((updatedTournament) => {
    if (updatedTournament?.id) {
      setTournamentOverrides((prev) => ({ ...prev, [updatedTournament.id]: updatedTournament }));
    }
  }, []);

  const filters = [
    { id: 'all', label: t('feedPage.filterAll') },
    { id: 'tournament', label: t('feedPage.filterTournament') },
    { id: 'promo', label: t('feedPage.filterPromo') }
  ];

  if (loading) {
    return (
      <div className="feed-page">
          <div className="feed-filters">
            {filters.map(f => (
              <button key={f.id} type="button" className="btn btn-ghost" disabled>
                {f.label}
              </button>
            ))}
          </div>
          <div className="feed-skeleton">
            <Skeleton height={300} />
            <Skeleton height={240} />
            <Skeleton height={240} />
            <Skeleton height={240} />
          </div>
        </div>
    );
  }

  if (error) {
    return (
      <div className="feed-page">
          <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="feed-page">
        {/* Filters */}
        <div className="feed-filters">
          {filters.map(f => (
            <button
              key={f.id}
              type="button"
              className={`btn btn-ghost ${activeFilter === f.id ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
              {f.id !== 'all' && (
                <span className="feed-filter-count">
                  {filterPostsByType(posts, f.id).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {filteredPosts.length === 0 ? (
          <EmptyState
            title={t('feedPage.emptyTitle')}
            description={t('feedPage.emptyDesc')}
            primaryAction={
              isAdmin ? (
                <Link to="/create" className="btn btn-primary">
                  {t('nav.createTournament')}
                </Link>
              ) : (
                <Link to="/tournaments" className="btn btn-primary">
                  {t('nav.tournaments')}
                </Link>
              )
            }
            secondaryAction={
              isAdmin ? (
                <Link to="/tournaments" className="btn btn-secondary">
                  К турнирам
                </Link>
              ) : null
            }
          />
        ) : (
          <FeedList
            posts={filteredPosts}
            currentPlayerId={currentPlayerId}
            tournamentOverrides={tournamentOverrides}
            onRegisterClick={handleRegisterClick}
            onPromoClick={handlePromoClick}
          />
        )}

        {modalOpen && selectedTournament && (
          <RegisterModal
            tournament={selectedTournament}
            currentPlayerId={currentPlayerId}
            onClose={handleCloseModal}
            onSuccess={handleRegistrationSuccess}
          />
        )}
    </div>
  );
}

export default FeedPage;
