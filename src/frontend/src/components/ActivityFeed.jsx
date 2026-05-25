import React from 'react';
import { Link } from 'react-router-dom';
import './ActivityFeed.css';

function ActivityFeed({ activities = [] }) {
  const hasItems = activities.length > 0;

  return (
    <div className="activity-feed">
      <h3 className="activity-feed-title">Последние события</h3>
      {hasItems ? (
        <div className="activity-feed-list">
          {activities.map((activity, idx) => {
            const key = activity.id ?? idx;
            const content = (
              <>
                <div className="activity-time">{activity.time}</div>
                <div className="activity-text">{activity.text}</div>
              </>
            );
            const itemClass = `activity-item${activity.href ? ' activity-item-link' : ''}`;
            if (activity.href) {
              const isInternal = typeof activity.href === 'string' && activity.href.startsWith('/');
              return (
                <div key={key} className={itemClass}>
                  {isInternal ? (
                    <Link to={activity.href} className="activity-item-inner">
                      {content}
                    </Link>
                  ) : (
                    <a href={activity.href} className="activity-item-inner" target="_blank" rel="noopener noreferrer">
                      {content}
                    </a>
                  )}
                </div>
              );
            }
            return (
              <div key={key} className={itemClass}>
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="activity-feed-empty">Пока нет событий</div>
      )}
    </div>
  );
}

export default ActivityFeed;
