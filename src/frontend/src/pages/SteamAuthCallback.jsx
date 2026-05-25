import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { setToken, setProfile, getBackendOrigin } from '../services/api';
import { useTranslation } from '../contexts/LanguageContext';
import './Login.css';

function SteamAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError(t('auth.loginError'));
      setLoading(false);
      return;
    }

    const exchange = async () => {
      try {
        const resp = await axios.post(`${getBackendOrigin()}/auth/steam/exchange`, { code });
        const { profile, token, returnTo } = resp.data;
        if (token) setToken(token);
        if (profile) setProfile(profile);
        window.dispatchEvent(new Event('auth-updated'));
        navigate(returnTo || '/');
      } catch (err) {
        setError(err.response?.data?.error || t('auth.loginError'));
      } finally {
        setLoading(false);
      }
    };

    exchange();
  }, [searchParams, navigate, t]);

  if (loading) {
    return (
      <div className="login">
        <div className="login-card">
          <p className="page-section-title">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login">
        <div className="login-card">
          <p className="page-section-title">{t('auth.login')}</p>
          <div className="error-message">{error}</div>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            {t('auth.goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default SteamAuthCallback;
