import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { PlaqueEditor } from '@/features/player-cosmetics';
import { useFeatureFlag } from '@/contexts/FeatureFlagsContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useLayoutConfig } from '@/contexts/LayoutConfigContext';

export default function PlaqueEditorPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  useLayoutConfig(
    { pageTitle: t('plaque.editorTitle') },
    [t],
  );

  if (!FEATURE_PLAYER_PLAQUES) {
    return <Navigate to="/settings" replace />;
  }

  if (loading && !user) {
    return <div className="settings muted">{t('achievements.loading')}</div>;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="settings">
        <p className="muted">{t('plaque.loginRequired')}</p>
        <Link
          to="/login"
          state={{ returnTo: location.pathname }}
          className="btn btn-primary"
        >
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  const playerId = user.pubgNick || user.username;
  if (!playerId) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="settings">
      <PlaqueEditor playerId={playerId} displayName={playerId} />
    </div>
  );
}
