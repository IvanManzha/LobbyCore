import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tournamentApi, playerApi } from '@/services/api';
import { formatMode, formatFeedDate } from '@/utils/feed';
import {
  getMyRegistration,
  getRegistrationRules,
  isRegistrationClosed,
} from '@/entities/tournament';
import { useTranslation } from '@/contexts/LanguageContext';
import './RegisterModal.css';

const STEPS = { closed: 'closed', login: 'login', already: 'already', choice: 'choice', solo: 'solo', team: 'team', freeAgent: 'freeAgent', success: 'success' };

function getTeamSizeLimits(tournamentType) {
  const type = (tournamentType || '').toLowerCase();
  if (type === 'duo') return { min: 2, max: 2 };
  if (type === 'trio') return { min: 3, max: 3 };
  if (type === 'squad') return { min: 4, max: 4 };
  if (type === 'mixed') return { min: 1, max: 4 };
  return { min: 1, max: 4 };
}

/**
 * Модалка регистрации на турнир (solo / team / free_agent).
 * Если у турнира entryFeeDC > 0, при нехватке DC кнопка регистрации блокируется.
 */
function RegisterModal({ tournament, currentPlayerId, availableDC = 0, onClose, onSuccess }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(() => {
    if (!tournament) return STEPS.closed;
    if (isRegistrationClosed(tournament)) return STEPS.closed;
    if (!currentPlayerId) return STEPS.login;
    const myReg = getMyRegistration(tournament, currentPlayerId);
    if (myReg) return STEPS.already;
    const rules = getRegistrationRules(tournament);
    const hasChoice = (rules.allowSolo && rules.allowTeams) || (rules.allowTeams && rules.allowFreeAgents);
    if (hasChoice) return STEPS.choice;
    if (rules.allowSolo) return STEPS.solo;
    return STEPS.team;
  });
  const [kind, setKind] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [teamNameError, setTeamNameError] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [updatedTournament, setUpdatedTournament] = useState(null);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const rules = tournament ? getRegistrationRules(tournament) : { allowSolo: false, allowTeams: false, allowFreeAgents: false };
  const myRegistration = tournament && currentPlayerId ? getMyRegistration(tournament, currentPlayerId) : null;
  const mode = formatMode(tournament?.type || tournament?.mode);
  const date = formatFeedDate(tournament?.date);

  const handleChoice = (k) => {
    setKind(k);
    setError('');
    if (k === 'team') {
      setSelectedMembers(currentPlayerId ? [currentPlayerId] : []);
      const t = (tournament?.type || '').toLowerCase();
      if (t === 'mixed' && currentPlayerId) {
        setTeamName((prev) => ((prev || '').trim() ? prev : currentPlayerId));
      }
    }
    if (k === 'solo') setStep(STEPS.solo);
    else if (k === 'team') setStep(STEPS.team);
    else if (k === 'free_agent') setStep(STEPS.freeAgent);
  };

  const teamSizeLimits = tournament ? getTeamSizeLimits(tournament.type) : { min: 1, max: 4 };

  const searchPlayers = useCallback(async (query) => {
    if (!query || !String(query).trim()) {
      setPlayerSearchResults([]);
      return;
    }
    setPlayerSearchLoading(true);
    try {
      const list = await playerApi.search(String(query).trim());
      setPlayerSearchResults(Array.isArray(list) ? list : []);
    } catch {
      setPlayerSearchResults([]);
    } finally {
      setPlayerSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPlayers(playerSearchQuery), 300);
    return () => clearTimeout(t);
  }, [playerSearchQuery, searchPlayers]);

  useEffect(() => {
    if (step === STEPS.team && currentPlayerId && selectedMembers.length === 0) {
      setSelectedMembers([currentPlayerId]);
    }
  }, [step, currentPlayerId]);

  const toggleMember = (playerId) => {
    const id = (playerId || '').trim();
    if (!id) return;
    if (id === currentPlayerId) return;
    setSelectedMembers((prev) => {
      const has = prev.some((p) => (p || '').trim().toLowerCase() === id.toLowerCase());
      if (has) {
        const next = prev.filter((p) => (p || '').trim().toLowerCase() !== id.toLowerCase());
        return next;
      }
      if (prev.length >= teamSizeLimits.max) return prev;
      return [...prev, id];
    });
  };

  const isMemberSelected = (playerId) => selectedMembers.some((p) => (p || '').trim().toLowerCase() === (playerId || '').trim().toLowerCase());

  const handleSubmitSolo = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await tournamentApi.register(tournament.id, { kind: 'solo' });
      setUpdatedTournament(res.tournament);
      setStep(STEPS.success);
      onSuccess?.(res.tournament);
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('registerModal.regError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTeam = async () => {
    setError('');
    const typeLower = (tournament.type || '').toLowerCase();
    let resolvedTeamName = (teamName || '').trim();
    if (typeLower === 'mixed' && resolvedTeamName.length < 2 && currentPlayerId) {
      resolvedTeamName = currentPlayerId.trim();
    }
    if (resolvedTeamName.length < 2 || resolvedTeamName.length > 24) {
      setTeamNameError(t('registerModal.teamNameError'));
      return;
    }
    setTeamNameError('');
    const members = selectedMembers.length > 0 ? selectedMembers : [currentPlayerId];
    if (members.length < teamSizeLimits.min || members.length > teamSizeLimits.max) {
      setError(t('registerModal.teamSizeError') || `Состав: от ${teamSizeLimits.min} до ${teamSizeLimits.max} игроков`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await tournamentApi.register(tournament.id, { kind: 'team', teamName: resolvedTeamName, members });
      setUpdatedTournament(res.tournament);
      setStep(STEPS.success);
      onSuccess?.(res.tournament);
    } catch (err) {
      const data = err.response?.data;
      const code = data?.code;
      const msg = code === 'TEAM_POWER_EXCEEDED' ? t('registerModal.teamPowerExceeded')
        : code === 'ELITE_LIMIT_EXCEEDED' ? t('registerModal.eliteLimitExceeded')
          : code === 'TEAM_POWER_EXCEEDED_MANUAL' ? t('registerModal.teamPowerExceededManual')
            : (data?.error || err.message || t('registerModal.regError'));
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFreeAgent = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await tournamentApi.register(tournament.id, { kind: 'free_agent' });
      setUpdatedTournament(res.tournament);
      setStep(STEPS.success);
      onSuccess?.(res.tournament);
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('registerModal.regError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawFreeAgent = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await tournamentApi.withdrawFreeAgent(tournament.id);
      onSuccess?.(res.tournament);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('registerModal.leaveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTournament = () => {
    onSuccess?.(updatedTournament);
    onClose();
    if (tournament?.id) navigate(`/tournament/${tournament.id}`);
    else navigate('/tournaments');
  };

  const handleGoToLogin = () => {
    onClose();
    navigate('/login');
  };

  if (!tournament) return null;

  return (
    <div className="register-modal-overlay" onClick={handleOverlayClick}>
      <div className="register-modal">
        <div className="register-modal__header">
          <h2 className="register-modal__title">{t('registerModal.title')}</h2>
          <button className="register-modal__close btn btn-ghost" onClick={onClose} aria-label={t('registerModal.closeAria')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="register-modal__info">
          <h3 className="register-modal__tournament-name">{tournament.name || t('registerModal.tournamentFallback')}</h3>
          <div className="register-modal__meta">
            {mode && <span className="register-modal__chip">{mode}</span>}
            {date && <span className="register-modal__chip">{date}</span>}
          </div>
        </div>

        <div className="register-modal__body">
          {step === STEPS.closed && (
            <>
              <p className="register-modal__text">{t('registerModal.registrationClosed')}</p>
              <div className="register-modal__actions">
                <button className="btn btn-primary" onClick={onClose}>{t('registerModal.close')}</button>
              </div>
            </>
          )}

          {step === STEPS.login && (
            <>
              <p className="register-modal__text">{t('registerModal.loginToRegister')}</p>
              <div className="register-modal__actions">
                <button className="btn btn-secondary" onClick={onClose}>{t('registerModal.close')}</button>
                <button className="btn btn-primary" onClick={handleGoToLogin}>{t('registerModal.loginBtn')}</button>
              </div>
            </>
          )}

          {step === STEPS.already && (
            <>
              <p className="register-modal__text">
                {myRegistration?.kind === 'free_agent' ? t('registerModal.freeAgentOrRegistered') : t('registerModal.alreadyRegistered')}
              </p>
              {error && <p className="register-modal__error">{error}</p>}
              <div className="register-modal__actions">
                {myRegistration?.kind === 'free_agent' && !isRegistrationClosed(tournament) && (
                  <button className="btn btn-secondary" onClick={handleWithdrawFreeAgent} disabled={submitting}>
                    {submitting ? t('registerModal.leaving') : t('registerModal.leavePool')}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={onClose}>{t('registerModal.close')}</button>
                <button className="btn btn-primary" onClick={handleOpenTournament}>{t('registerModal.openTournament')}</button>
              </div>
            </>
          )}

          {step === STEPS.choice && (
            <>
              <p className="register-modal__subtext">{t('registerModal.chooseType')}</p>
              <div className="register-modal__choice">
                {rules.allowSolo && (
                  <button className="btn btn-secondary register-modal__choice-btn" onClick={() => handleChoice('solo')} disabled={submitting}>
                    {t('registerModal.soloOption')}
                  </button>
                )}
                {rules.allowTeams && (
                  <button className="btn btn-secondary register-modal__choice-btn" onClick={() => handleChoice('team')} disabled={submitting}>
                    {t('registerModal.teamOption')}
                  </button>
                )}
                {rules.allowFreeAgents && rules.allowTeams && (
                  <button className="btn btn-secondary register-modal__choice-btn" onClick={() => handleChoice('free_agent')} disabled={submitting}>
                    {t('registerModal.freeAgentOption')}
                  </button>
                )}
              </div>
              <div className="register-modal__actions">
                <button className="btn btn-ghost" onClick={onClose}>{t('registerModal.close')}</button>
              </div>
            </>
          )}

          {step === STEPS.solo && (
            <>
              <p className="register-modal__text">{t('registerModal.youRegisterAs')} <strong>{currentPlayerId}</strong></p>
              {(tournament.finance?.entryFeeDC ?? 0) > 0 && (
                <p className="register-modal__subtext">
                  {availableDC < (tournament.finance?.entryFeeDC ?? 0) ? (
                    <>Недостаточно DC для регистрации. Нужно {(tournament.finance?.entryFeeDC ?? 0)} DC. <Link to="/finance">Пополнить</Link></>
                  ) : (
                    <>Взнос: {(tournament.finance?.entryFeeDC ?? 0)} DC (у вас {availableDC} DC)</>
                  )}
                </p>
              )}
              {error && <p className="register-modal__error">{error}</p>}
              <div className="register-modal__actions">
                {(rules.allowTeams || rules.allowFreeAgents) && (
                  <button className="btn btn-secondary" onClick={() => setStep(STEPS.choice)} disabled={submitting}>{t('common.back')}</button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitSolo}
                  disabled={submitting || ((tournament.finance?.entryFeeDC ?? 0) > 0 && availableDC < (tournament.finance?.entryFeeDC ?? 0))}
                >
                  {submitting ? t('registerModal.saving') : t('registerModal.confirmReg')}
                </button>
              </div>
            </>
          )}

          {step === STEPS.team && (
            <>
              <label className="register-modal__label">
                {t('registerModal.teamNameLabel')}
                <input
                  type="text"
                  className={`input register-modal__input ${teamNameError ? 'error' : ''}`}
                  placeholder={t('registerModal.captainPlaceholder')}
                  value={teamName}
                  onChange={(e) => { setTeamName(e.target.value); setTeamNameError(''); }}
                  maxLength={24}
                  disabled={submitting}
                />
                {teamNameError && <span className="register-modal__field-error">{teamNameError}</span>}
              </label>
              <div className="register-modal__label">
                <span className="register-modal__label-text">
                  {t('registerModal.teamRoster', 'Состав команды')}: {selectedMembers.length} / {teamSizeLimits.max}
                </span>
                <div className="register-modal__selected-members">
                  {selectedMembers.map((pid) => (
                    <span
                      key={pid}
                      className={`register-modal__bubble register-modal__bubble--selected ${pid === currentPlayerId ? 'register-modal__bubble--captain' : ''}`}
                      title={pid === currentPlayerId ? t('registerModal.captain', 'Капитан') : undefined}
                    >
                      {pid}{pid === currentPlayerId ? ' (C)' : ''}
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  className="input register-modal__input register-modal__search"
                  placeholder={t('registerModal.searchPlayer', 'Поиск игрока по нику')}
                  value={playerSearchQuery}
                  onChange={(e) => setPlayerSearchQuery(e.target.value)}
                  disabled={submitting}
                />
                {playerSearchLoading && <p className="register-modal__subtext">{t('registerModal.searching', 'Поиск…')}</p>}
                <div className="register-modal__player-bubbles">
                  {playerSearchResults.map((p) => {
                    const pid = p.playerId || p.nickname || p;
                    const selected = isMemberSelected(pid);
                    const isCaptain = (pid || '').trim().toLowerCase() === (currentPlayerId || '').trim().toLowerCase();
                    return (
                      <button
                        key={pid}
                        type="button"
                        className={`register-modal__bubble register-modal__bubble--clickable ${selected ? 'register-modal__bubble--selected' : ''} ${isCaptain ? 'register-modal__bubble--captain' : ''}`}
                        onClick={() => toggleMember(pid)}
                        disabled={submitting || (isCaptain && selected) || (!selected && selectedMembers.length >= teamSizeLimits.max)}
                        title={selected ? t('registerModal.clickToRemove', 'Клик — убрать из состава') : t('registerModal.clickToAdd', 'Клик — добавить в состав')}
                      >
                        {pid}{isCaptain ? ' (C)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
              {(tournament.finance?.entryFeeDC ?? 0) > 0 && (
                <p className="register-modal__subtext">
                  {availableDC < (tournament.finance?.entryFeeDC ?? 0) ? (
                    <>Недостаточно DC для регистрации. Нужно {(tournament.finance?.entryFeeDC ?? 0)} DC (взнос за 1 участника). <Link to="/finance">Пополнить</Link></>
                  ) : (
                    <>Взнос: {(tournament.finance?.entryFeeDC ?? 0)} DC за каждого участника (у вас {availableDC} DC)</>
                  )}
                </p>
              )}
              {error && <p className="register-modal__error">{error}</p>}
              <div className="register-modal__actions">
                {(rules.allowSolo || rules.allowFreeAgents) && (
                  <button className="btn btn-secondary" onClick={() => setStep(STEPS.choice)} disabled={submitting}>{t('common.back')}</button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitTeam}
                  disabled={submitting || selectedMembers.length < teamSizeLimits.min || selectedMembers.length > teamSizeLimits.max || ((tournament.finance?.entryFeeDC ?? 0) > 0 && availableDC < (tournament.finance?.entryFeeDC ?? 0))}
                >
                  {submitting ? t('registerModal.saving') : t('registerModal.registerBtn')}
                </button>
              </div>
            </>
          )}

          {step === STEPS.freeAgent && (
            <>
              <p className="register-modal__text">{t('registerModal.freeAgentDesc')}</p>
              {error && <p className="register-modal__error">{error}</p>}
              <div className="register-modal__actions">
                <button className="btn btn-secondary" onClick={() => setStep(STEPS.choice)} disabled={submitting}>{t('common.back')}</button>
                <button className="btn btn-primary" onClick={handleSubmitFreeAgent} disabled={submitting}>
                  {submitting ? t('registerModal.saving') : t('registerModal.joinPool')}
                </button>
              </div>
            </>
          )}

          {step === STEPS.success && (
            <>
              <p className="register-modal__text">{t('registerModal.done')}</p>
              <p className="register-modal__subtext">
                {(() => {
                  const entryFeeDC = tournament.finance?.entryFeeDC ?? 0;
                  if (entryFeeDC > 0) {
                    return t(
                      'registerModal.youRegisteredWithFee',
                      'Вы предварительно зарегистрированы. Для завершения регистрации оплатите вступительный взнос на странице турнира.'
                    );
                  }
                  return t('registerModal.youRegistered');
                })()}
              </p>
              <div className="register-modal__actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    onClose();
                    onSuccess?.(updatedTournament);
                  }}
                >
                  {t('registerModal.close')}
                </button>
                <button className="btn btn-primary" onClick={handleOpenTournament}>
                  {t(
                    'registerModal.openAndPay',
                    (tournament.finance?.entryFeeDC ?? 0) > 0
                      ? 'Перейти к оплате'
                      : t('registerModal.openTournament')
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegisterModal;
