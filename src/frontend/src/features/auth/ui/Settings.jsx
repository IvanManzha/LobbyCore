import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { playerApi, statsApi, steamLinkRequestApi } from '@/services/api';
import { isSteamAuthEnabled } from '@/shared/config';
import { Link } from 'react-router-dom';
import './Settings.css';

function Settings() {
  const { user, isAuthenticated } = useAuth();
  const themeContext = useTheme();
  const { t, lang, setLang } = useTranslation();
  const [snapshotYear, setSnapshotYear] = useState('2025');
  const [snapshotStatus, setSnapshotStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [pubgNick, setPubgNick] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [linkSteamLoading, setLinkSteamLoading] = useState(false);
  const [targetPubgNickForLink, setTargetPubgNickForLink] = useState('');
  const [steamLinkRequestLoading, setSteamLinkRequestLoading] = useState(false);
  const [steamLinkRequestStatus, setSteamLinkRequestStatus] = useState(null);

  useEffect(() => {
    if (user) {
      setPubgNick(user.pubgNick || '');
    }
  }, [user]);

  const defaultAdmin = 'ivanchk';
  const adminUsers = (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = user && adminUsers.includes((user.username || '').toLowerCase());

  const periodOptions = useMemo(() => (['2025', '2026']), []);

  const handleProfileSave = async () => {
    if (!user) return;
    if (!pubgNick.trim()) {
      setProfileStatus({ type: 'error', text: t('settings.pubgRequired') });
      return;
    }
    if (newPassword || newPasswordConfirm || currentPassword) {
      if (!currentPassword) {
        setProfileStatus({ type: 'error', text: t('settings.enterCurrentPassword') });
        return;
      }
      if (newPassword.length < 6) {
        setProfileStatus({ type: 'error', text: t('settings.passwordMinLength') });
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        setProfileStatus({ type: 'error', text: t('settings.passwordsMismatch') });
        return;
      }
    }

    try {
      setProfileLoading(true);
      setProfileStatus(null);
      await playerApi.updateProfile({
        pubgNick: pubgNick.trim(),
        password: newPassword ? newPassword : undefined,
        currentPassword: newPassword ? currentPassword : undefined
      });
      setProfileStatus({ type: 'success', text: t('settings.profileUpdated') });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error) {
      setProfileStatus({ type: 'error', text: error.response?.data?.error || t('settings.profileError') });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSteamLinkRequest = async () => {
    const nick = targetPubgNickForLink.trim();
    if (!nick) {
      setSteamLinkRequestStatus({ type: 'error', text: t('settings.steamLinkRequestEnterNick') });
      return;
    }
    try {
      setSteamLinkRequestLoading(true);
      setSteamLinkRequestStatus(null);
      await steamLinkRequestApi.create(nick);
      setSteamLinkRequestStatus({ type: 'success', text: t('settings.steamLinkRequestSent') });
      setTargetPubgNickForLink('');
    } catch (err) {
      setSteamLinkRequestStatus({ type: 'error', text: err.response?.data?.error || t('auth.loginError') });
    } finally {
      setSteamLinkRequestLoading(false);
    }
  };

  const handleLinkSteam = async () => {
    try {
      setLinkSteamLoading(true);
      const url = await playerApi.getSteamLinkUrl('/settings');
      window.location.href = url;
    } catch (error) {
      setProfileStatus({ type: 'error', text: error.response?.data?.error || t('auth.loginError') });
    } finally {
      setLinkSteamLoading(false);
    }
  };

  const handleSnapshot = async () => {
    if (!snapshotYear) return;
    const confirmed = window.confirm(t('settings.snapshotConfirm', { year: snapshotYear }));
    if (!confirmed) return;

    try {
      setSubmitting(true);
      setSnapshotStatus(null);
      await statsApi.createYearSnapshot(snapshotYear);
      setSnapshotStatus({ type: 'success', text: t('settings.snapshotCreated', { year: snapshotYear }) });
    } catch (error) {
      setSnapshotStatus({ type: 'error', text: error.response?.data?.error || t('settings.snapshotError') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="settings">
        <div className="settings-section">
          <h2>{t('settings.appearance')}</h2>
          <div className="settings-row settings-row--align">
            <span>{t('settings.theme')}</span>
            <div className="settings-theme-switch">
              <button
                type="button"
                className={`btn btn-ghost settings-theme-btn ${themeContext?.theme === 'light' ? 'active' : ''}`}
                onClick={() => themeContext?.theme !== 'light' && themeContext?.toggleTheme()}
                title={t('settings.themeLightTitle')}
              >
                {t('settings.themeLight')}
              </button>
              <button
                type="button"
                className={`btn btn-ghost settings-theme-btn ${themeContext?.theme === 'dark' ? 'active' : ''}`}
                onClick={() => themeContext?.theme !== 'dark' && themeContext?.toggleTheme()}
                title={t('settings.themeDarkTitle')}
              >
                {t('settings.themeDark')}
              </button>
            </div>
          </div>
          <div className="settings-row settings-row--align">
            <span>{t('settings.language')}</span>
            <div className="settings-theme-switch">
              <button
                type="button"
                className={`btn btn-ghost settings-theme-btn ${lang === 'ru' ? 'active' : ''}`}
                onClick={() => lang !== 'ru' && setLang('ru')}
              >
                {t('settings.languageRu')}
              </button>
              <button
                type="button"
                className={`btn btn-ghost settings-theme-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => lang !== 'en' && setLang('en')}
              >
                {t('settings.languageEn')}
              </button>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h2>{t('plaque.sectionTitle')}</h2>
          <p className="muted plaque-settings-intro">{t('plaque.settingsIntro')}</p>
          {isAuthenticated && user && (
            <Link to="/settings/plaque" className="btn btn-secondary">
              {t('plaque.openEditor')}
            </Link>
          )}
          {!isAuthenticated && (
            <p className="muted">{t('plaque.loginRequired')}</p>
          )}
        </div>
        <div className="settings-section">
          <h2>{t('settings.profile')}</h2>
          <div className="form-group">
            <label>{t('settings.pubgNick')}</label>
            <input
              className="input"
              value={pubgNick}
              onChange={(e) => setPubgNick(e.target.value)}
              placeholder={t('settings.pubgNickPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('settings.currentPassword')}</label>
            <div className="input-password-wrapper">
              <input
                className="input"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('settings.currentPasswordPlaceholder')}
              />
              <button
                type="button"
                className="input-password-toggle"
                onClick={() => setShowCurrentPassword((v) => !v)}
                aria-label={showCurrentPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                tabIndex={-1}
              >
                {showCurrentPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>{t('settings.newPassword')}</label>
            <div className="input-password-wrapper">
              <input
                className="input"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.newPasswordPlaceholder')}
              />
              <button
                type="button"
                className="input-password-toggle"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>{t('settings.confirmPassword')}</label>
            <div className="input-password-wrapper">
              <input
                className="input"
                type={showNewPasswordConfirm ? 'text' : 'password'}
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder={t('settings.confirmPasswordPlaceholder')}
              />
              <button
                type="button"
                className="input-password-toggle"
                onClick={() => setShowNewPasswordConfirm((v) => !v)}
                aria-label={showNewPasswordConfirm ? t('settings.hidePassword') : t('settings.showPassword')}
                tabIndex={-1}
              >
                {showNewPasswordConfirm ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div className="settings-row">
            <button className="btn btn-primary" onClick={handleProfileSave} disabled={profileLoading}>
              {profileLoading ? t('settings.saving') : t('settings.saveProfile')}
            </button>
          </div>
          {profileStatus && (
            <div className={`settings-status ${profileStatus.type}`}>
              {profileStatus.text}
            </div>
          )}
          {isSteamAuthEnabled && (
          <div className="form-group settings-steam-row">
            <label>Steam</label>
            {user?.steam ? (
              <>
                <p className="muted">
                  {t('auth.steamLinked')}: {user.steam.personaName || user.steam.steamId64 || '—'}
                </p>
                <p className="muted small">{t('settings.steamLinkRequestHint')}</p>
                <div className="settings-row" style={{ alignItems: 'flex-end', gap: 8 }}>
                  <input
                    className="input"
                    type="text"
                    value={targetPubgNickForLink}
                    onChange={(e) => setTargetPubgNickForLink(e.target.value)}
                    placeholder={t('settings.steamLinkRequestPlaceholder')}
                    disabled={steamLinkRequestLoading}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSteamLinkRequest}
                    disabled={steamLinkRequestLoading}
                  >
                    {steamLinkRequestLoading ? t('common.loading') : t('settings.steamLinkRequestSubmit')}
                  </button>
                </div>
                {steamLinkRequestStatus && (
                  <div className={`settings-status ${steamLinkRequestStatus.type}`}>
                    {steamLinkRequestStatus.text}
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn btn-steam"
                onClick={handleLinkSteam}
                disabled={linkSteamLoading}
              >
                {linkSteamLoading ? t('common.loading') : t('auth.linkSteam')}
              </button>
            )}
          </div>
          )}
        </div>

        <div className="settings-section">
          <h2>{t('settings.export')}</h2>
          <p className="muted">{t('settings.exportSoon')}</p>
          <button className="btn btn-secondary" disabled>{t('settings.exportButton')}</button>
        </div>

        {isAdmin && (
          <div className="settings-section">
            <h2>{t('settings.adminStats')}</h2>
            <p className="muted">
              {t('settings.adminStatsDesc')}
            </p>
            <div className="settings-row">
              <select
                className="select"
                value={snapshotYear}
                onChange={(event) => setSnapshotYear(event.target.value)}
              >
                {periodOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={handleSnapshot}
                disabled={submitting}
              >
                {submitting ? t('settings.resetting') : t('settings.resetStats')}
              </button>
            </div>
            {snapshotStatus && (
              <div className={`settings-status ${snapshotStatus.type}`}>
                {snapshotStatus.text}
              </div>
            )}
          </div>
        )}
      </div>
  );
}

export default Settings;
