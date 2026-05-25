import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';
import './ProfileMenu.css';

function ProfileMenu({ user, onClose, onLogout, anchorRef }) {
  const menuRef = useRef(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  const profileId = user?.pubgNick || user?.username;
  const profilePath = profileId ? `/player/${encodeURIComponent(profileId)}` : null;

  return (
    <div className="profile-menu" ref={menuRef} role="menu" aria-label={t('nav.profileMenu')}>
      {profilePath && (
        <Link to={profilePath} className="profile-menu-item" onClick={onClose} role="menuitem">
          {t('nav.profile')}
        </Link>
      )}
      <Link to="/finance" className="profile-menu-item" onClick={onClose} role="menuitem">
        {t('nav.finance')}
      </Link>
      <Link to="/settings" className="profile-menu-item" onClick={onClose} role="menuitem">
        {t('nav.settings')}
      </Link>
      <button
        type="button"
        className="profile-menu-item profile-menu-item--danger"
        onClick={() => {
          onClose();
          onLogout();
        }}
        role="menuitem"
      >
        {t('nav.logout')}
      </button>
    </div>
  );
}

export default ProfileMenu;
