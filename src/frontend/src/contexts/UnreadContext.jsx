import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const LAST_SEEN_FEED = 'lastSeenFeedAt';
const FEED_LAST_UPDATED = 'feedLastUpdatedAt';

const UnreadContext = createContext(null);

export function UnreadProvider({ children }) {
  const [feedLastUpdated, setFeedLastUpdatedState] = useState(() =>
    Number(localStorage.getItem(FEED_LAST_UPDATED) || 0)
  );
  const [lastSeenFeed, setLastSeenFeedState] = useState(() =>
    Number(localStorage.getItem(LAST_SEEN_FEED) || 0)
  );

  const setFeedLastUpdated = useCallback((ts) => {
    const t = typeof ts === 'number' ? ts : new Date(ts || 0).getTime();
    setFeedLastUpdatedState(t);
    localStorage.setItem(FEED_LAST_UPDATED, String(t));
  }, []);

  const setLastSeenFeed = useCallback((ts) => {
    const t = typeof ts === 'number' ? ts : (ts ? new Date(ts).getTime() : Date.now());
    setLastSeenFeedState(t);
    localStorage.setItem(LAST_SEEN_FEED, String(t));
  }, []);

  const hasUnreadFeed = feedLastUpdated > lastSeenFeed;

  const value = {
    feedLastUpdated,
    lastSeenFeed,
    setFeedLastUpdated,
    setLastSeenFeed,
    hasUnreadFeed
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === FEED_LAST_UPDATED && e.newValue != null) {
        setFeedLastUpdatedState(Number(e.newValue));
      }
      if (e.key === LAST_SEEN_FEED && e.newValue != null) {
        setLastSeenFeedState(Number(e.newValue));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  return ctx || { hasUnreadFeed: false, setFeedLastUpdated: () => {}, setLastSeenFeed: () => {} };
}
