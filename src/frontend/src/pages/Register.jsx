import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerApi, getBackendOrigin } from '../services/api';
import { isSteamAuthEnabled } from '../config/featureFlags';
import { useTranslation } from '../contexts/LanguageContext';
import './Login.css';

function Register() {
  const [pubgNick, setPubgNick] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSteamLogin = () => {
    window.location.href = `${getBackendOrigin()}/auth/steam/start?returnTo=${encodeURIComponent('/')}`;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!pubgNick.trim()) {
      setError(t('auth.enterPubgNick'));
      return;
    }
    if (!password.trim()) {
      setError(t('auth.enterPassword'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage('');
      await playerApi.register({
        pubgNick: pubgNick.trim(),
        password
      });
      setMessage(t('auth.registerSuccess'));
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || t('auth.registerError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
        <div className="login-card">
          <p className="page-section-title">{t('auth.registerTitle')}</p>
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label htmlFor="registerPubgNick">{t('auth.pubgNick')}</label>
              <input
                className="input"
                id="registerPubgNick"
                type="text"
                value={pubgNick}
                onChange={(e) => setPubgNick(e.target.value)}
                placeholder={t('auth.pubgNickPlaceholder')}
                disabled={loading}
                autoComplete="nickname"
              />
            </div>
            <div className="form-group">
              <label htmlFor="registerPassword">{t('auth.password')}</label>
              <input
                className="input"
                id="registerPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.newPasswordPlaceholder')}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            {message && <div className="register-hint">{message}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? t('common.loading') : t('auth.registerSubmit')}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => navigate('/login')} disabled={loading}>
                {t('auth.goToLogin')}
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

export default Register;
