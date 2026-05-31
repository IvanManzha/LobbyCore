import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChampionPill from './ChampionPill';
import ProfileMenu from './ProfileMenu';
import DcBalance from './DcBalance';
import { useTranslation } from '@/contexts/LanguageContext';
import { getPageTitle } from '@/utils/pageTitle';
import './TopBar.css';

function TopBar({
  pageTitleOverride,
  pageTitle: pageTitleFromLayout,
  pageTitleMeta,
  pageTitleMetaHref,
  isMobile,
  onOpenDrawer,
  headerAction,
  champion,
  user,
  isAuthenticated,
  profileMenuOpen,
  onProfileMenuToggle,
  profileMenuAnchorRef,
  onLogout,
}) {
  const location = useLocation();
  const { lang, t } = useTranslation();
  const pageTitle = pageTitleOverride ?? pageTitleFromLayout ?? getPageTitle(location.pathname, lang);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          {isMobile && (
            <button
              type="button"
              className="topbar-hamburger"
              onClick={onOpenDrawer}
              aria-label={t('common.openMenu')}
            >
              <span className="topbar-hamburger-bar" />
              <span className="topbar-hamburger-bar" />
              <span className="topbar-hamburger-bar" />
            </button>
          )}
          <div className="topbar-title-group">
            <h1 className="topbar-pagetitle">{pageTitle}</h1>
            {pageTitleMeta && (
              <>
                <span className="topbar-title-sep" aria-hidden>
                  ·
                </span>
                {pageTitleMetaHref ? (
                  <Link to={pageTitleMetaHref} className="topbar-pagemeta topbar-pagemeta-link">
                    {pageTitleMeta}
                  </Link>
                ) : (
                  <span className="topbar-pagemeta">{pageTitleMeta}</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="topbar-actions">
          {headerAction}
          {champion && <ChampionPill champion={champion} />}
          {isAuthenticated && <DcBalance />}
          {isAuthenticated && user && (
            <div className="topbar-profile-wrapper">
              <button
                type="button"
                ref={profileMenuAnchorRef}
                className="topbar-profile-trigger"
                onClick={() => onProfileMenuToggle()}
                aria-label={t('nav.profileMenu')}
                aria-expanded={profileMenuOpen}
              >
                {(user.pubgNick || user.username || '').trim() || '?'}
              </button>
              {profileMenuOpen && (
                <ProfileMenu
                  user={user}
                  onClose={() => onProfileMenuToggle(false)}
                  onLogout={onLogout}
                  anchorRef={profileMenuAnchorRef}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
