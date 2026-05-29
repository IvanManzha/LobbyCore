import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerApi, getBackendOrigin } from '@/services/api';
import { isSteamAuthEnabled } from '@/shared/config';
import { useTranslation } from '@/contexts/LanguageContext';
import './Login.css';

function Login() {
  const [pubgNick, setPubgNick] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!pubgNick.trim()) {
      setError(t('auth.enterPubgNick'));
      return;
    }
    if (!password.trim()) {
      setError(t('auth.enterPassword'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await playerApi.login(pubgNick.trim(), password);
      navigate(`/player/${encodeURIComponent(pubgNick.trim())}`);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    await playerApi.logout();
    navigate('/');
  };

  const handleSteamLogin = () => {
    const returnTo = pubgNick.trim() ? `/player/${encodeURIComponent(pubgNick.trim())}` : '/';
    window.location.href = `${getBackendOrigin()}/auth/steam/start?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="login">
        <div className="login-card">
        <p className="page-section-title">{t('auth.login')}</p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="pubgNick">{t('auth.pubgNick')}</label>
            <input
              className="input"
              id="pubgNick"
              type="text"
              value={pubgNick}
              onChange={(e) => setPubgNick(e.target.value)}
              placeholder={t('auth.pubgNickPlaceholder')}
              disabled={loading}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              className="input"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? t('common.loading') : t('auth.submit')}
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleGuest} disabled={loading}>
              {t('auth.loginAsGuest')}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/register')} disabled={loading}>
              {t('auth.register')}
            </button>
            {isSteamAuthEnabled && (
              <button className="btn btn-steam" type="button" onClick={handleSteamLogin} disabled={loading}>
                {t('auth.loginWithSteam')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;

