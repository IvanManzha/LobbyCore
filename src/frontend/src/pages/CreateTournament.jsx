// src/frontend/src/pages/CreateTournament.jsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tournamentApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { DEVELOPERS } from '../config/app';
import Modal from '../components/Modal';
import { useTranslation } from '../contexts/LanguageContext';
import { validateTournamentDate, getTodayISO } from '../utils/dateValidation';
import './CreateTournament.css';

const currentYear = () => new Date().getFullYear().toString();

/** Квартал для ID фонда (как на бэкенде resolveFinalFundSeasonId). */
function quarterIdFromIsoDate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return currentYear();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
  return `${y}-${q}`;
}

const initialFormData = () => ({
  name: '',
  date: new Date().toISOString().split('T')[0],
  startTime: '18:00',
  type: 'solo',
  rules: '',
  rounds: 5,
  price: '',
  barrier: '',
  teamCapMode: 'auto',
  placement1: 25,
  placement2: 20,
  placement3: 17,
  placement4: 15,
  placement5: 13,
  placement6: 11,
  perKill: 2,
  tournamentWeight: 30,
  countInRating: true,
  // Финансы (DC)
  entryFeeDC: 0,
  finalFundRate: 0,
  payoutSplit1: 50,
  payoutSplit2: 35,
  payoutSplit3: 15,
  payoutMode: 'per_player',
  withdrawalHours: '',
  withdrawalPercent: '',
  seasonId: quarterIdFromIsoDate(new Date().toISOString().split('T')[0])
});

function tournamentToFormData(tournament, table) {
  const startAt = tournament.startAt;
  let startTime = '18:00';
  if (startAt && typeof startAt === 'string') {
    const match = startAt.match(/T(\d{2}:\d{2})/);
    if (match) startTime = match[1];
  }
  const scoring = table?.tournament?.scoring || {};
  const placement = scoring.placement || {};
  const fin = tournament.finance || tournament.extra?.finance;
  const split = fin?.payoutSplit || [50, 35, 15];
  const policy = fin?.withdrawalPolicy || [];
  const firstRule = policy[0];
  return {
    name: tournament.name || '',
    date: (tournament.date || '').toString().split('T')[0] || new Date().toISOString().split('T')[0],
    startTime,
    type: tournament.type || 'solo',
    rules: tournament.rules || '',
    rounds: tournament.rounds ?? 5,
    price: tournament.price ?? '',
    barrier: tournament.barrier ?? '',
    teamCapMode:
      (tournament.teamCapMode || tournament.extra?.teamCapMode) === 'manual' ? 'manual' : 'auto',
    placement1: placement[1] ?? 25,
    placement2: placement[2] ?? 20,
    placement3: placement[3] ?? 17,
    placement4: placement[4] ?? 15,
    placement5: placement[5] ?? 13,
    placement6: placement[6] ?? 11,
    perKill: scoring.per_kill ?? 2,
    tournamentWeight: tournament.extra?.tournamentWeight ?? 30,
    countInRating: tournament.extra?.countInRating !== false,
    entryFeeDC: fin?.entryFeeDC ?? 0,
    finalFundRate: fin?.finalFundRate ?? 0,
    payoutSplit1: split[0] ?? 50,
    payoutSplit2: split[1] ?? 35,
    payoutSplit3: split[2] ?? 15,
    payoutMode: fin?.payoutMode ?? 'per_player',
    withdrawalHours: firstRule?.hoursBeforeStart ?? '',
    withdrawalPercent: firstRule?.refundPercent ?? '',
    seasonId: fin?.seasonId ?? quarterIdFromIsoDate((tournament.date || '').toString().split('T')[0])
  };
}

const LOG = (msg, data) => {
  if (import.meta.env.DEV) console.log('[CreateTournament]', msg, data !== undefined ? data : '');
};

function CreateTournament() {
  const navigate = useNavigate();
  const { id: tournamentId } = useParams();
  const isEditMode = Boolean(tournamentId);
  const [loading, setLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => initialFormData());
  const initialDataRef = useRef(initialFormData());
  const editMetaRef = useRef({ type: null, teamsCount: 0 });
  const [dirty, setDirty] = useState(false);
  const [existingTournaments, setExistingTournaments] = useState([]);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const { t } = useTranslation();

  LOG('render', { tournamentId, isEditMode, step, loading, hasLoadError: !!loadError });

  useEffect(() => {
    tournamentApi.getAll().then(setExistingTournaments).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditMode || !tournamentId) {
      LOG('load effect skip', { isEditMode, tournamentId });
      return;
    }
    let cancelled = false;
    LOG('load effect start', { tournamentId });
    setLoadError(null);
    (async () => {
      try {
        const [tournament, table] = await Promise.all([
          tournamentApi.getById(tournamentId),
          tournamentApi.getTable(tournamentId).catch(() => null)
        ]);
        if (cancelled) {
          LOG('load effect cancelled (after fetch)');
          return;
        }
        LOG('load effect success', { name: tournament?.name });
        setFormData(tournamentToFormData(tournament, table));
        editMetaRef.current = { type: tournament.type || 'solo', teamsCount: (table?.teams?.length) ?? 0 };
      } catch (err) {
        if (!cancelled) {
          LOG('load effect error', err?.message || err);
          setLoadError(err.response?.data?.error || err.message || 'Не удалось загрузить турнир');
        }
      } finally {
        if (!cancelled) {
          LOG('load effect finally, setLoading(false)');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      LOG('load effect cleanup (cancelled=true)');
    };
  }, [isEditMode, tournamentId]);

  useEffect(() => {
    LOG('step changed', step);
  }, [step]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDirty(true);
    setFieldErrors((prev) => ({ ...prev, [name]: null }));
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    if (name === 'date' && value) {
      const result = validateTournamentDate(value, today);
      if (!result.valid) setFieldErrors((prev) => ({ ...prev, date: t(result.errorKey, result.params) }));
    }
    const numericNames = ['rounds', 'price', 'barrier', 'entryFeeDC', 'payoutSplit1', 'payoutSplit2', 'payoutSplit3', 'tournamentWeight'];
    const isNumeric = name.startsWith('placement') || name.startsWith('rating') || name === 'perKill' || numericNames.includes(name);
    setFormData(prev => ({
      ...prev,
      [name]: isNumeric ? (value === '' ? '' : Number(value)) : value
    }));
  };

  const today = getTodayISO();

  const validateStep1 = useCallback(() => {
    const err = {};
    const name = (formData.name || '').trim();
    if (!name) err.name = t('createTournament.nameRequired');
    else {
      const sameName = existingTournaments.filter(
        (tr) => (tr.name || '').trim().toLowerCase() === name.toLowerCase()
      );
      const isDuplicate = isEditMode
        ? sameName.some((tr) => (tr.id || tr._id) !== tournamentId)
        : sameName.length > 0;
      if (isDuplicate) err.name = t('createTournament.nameDuplicate');
    }
    const dateStr = formData.date;
    if (!dateStr) err.date = t('dateValidation.required');
    else {
      const dateResult = validateTournamentDate(dateStr, today);
      if (!dateResult.valid) err.date = t(dateResult.errorKey, dateResult.params);
    }
    if (Object.keys(err).length) setFieldErrors((prev) => ({ ...prev, ...err }));
    return Object.keys(err).length === 0;
  }, [formData.name, formData.date, today, existingTournaments, isEditMode, tournamentId, t]);

  const nameTrimmed = (formData.name || '').trim();
  const isDuplicateName = nameTrimmed && existingTournaments.some(
    (t) => (t.name || '').trim().toLowerCase() === nameTrimmed.toLowerCase() && (t.id || t._id) !== tournamentId
  );
  const canProceedStep1 =
    nameTrimmed.length > 0 &&
    formData.date &&
    validateTournamentDate(formData.date, today).valid &&
    !isDuplicateName;

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    LOG('handleSubmit called', { step });
    if (step !== 3) {
      LOG('handleSubmit early return (step !== 3)');
      return;
    }
    setError(null);
    setFieldErrors({});

    if (!(formData.name || '').trim()) {
      setError(t('createTournament.nameRequired'));
      setFieldErrors((prev) => ({ ...prev, name: t('createTournament.nameRequired') }));
      return;
    }
    const dateStr = formData.date;
    if (!dateStr) {
      setFieldErrors((prev) => ({ ...prev, date: t('dateValidation.required') }));
      return;
    }
    const dateResult = validateTournamentDate(dateStr, today);
    if (!dateResult.valid) {
      setFieldErrors((prev) => ({ ...prev, date: t(dateResult.errorKey, dateResult.params) }));
      return;
    }
    const rounds = Number(formData.rounds);
    if (!Number.isFinite(rounds) || rounds < 1) {
      setError(t('createTournament.roundsError'));
      return;
    }

    const startTime = (formData.startTime || '00:00').toString().trim();
    const startAt = formData.date && startTime
      ? new Date(`${formData.date}T${startTime}:00`).toISOString()
      : null;

    if (isEditMode && formData.type !== editMetaRef.current.type && editMetaRef.current.teamsCount > 0) {
      const ok = window.confirm(t('createTournament.typeChangeConfirm'));
      if (!ok) return;
    }

    const payload = {
      ...formData,
      name: (formData.name || '').trim(),
      rounds: rounds,
      startAt: startAt || undefined,
      price: formData.price === '' || formData.price == null ? 0 : Number(formData.price),
      barrier: formData.barrier === '' || formData.barrier == null ? null : Number(formData.barrier),
      teamCapMode: formData.teamCapMode === 'manual' ? 'manual' : 'auto',
      countInRating: formData.countInRating !== false
    };
    const entryFeeDC =
      Number(formData.entryFeeDC) > 0
        ? Number(formData.entryFeeDC)
        : Number(payload.price) || 0;
    if (entryFeeDC > 0) {
      const withdrawalPolicy = [];
      const wh = formData.withdrawalHours;
      const wp = formData.withdrawalPercent;
      if (wh !== '' && wh != null && wp !== '' && wp != null) {
        withdrawalPolicy.push({
          hoursBeforeStart: Number(wh),
          refundPercent: Number(wp)
        });
      }
      if (withdrawalPolicy.length === 0) {
        withdrawalPolicy.push({ hoursBeforeStart: 4, refundPercent: 100 });
        withdrawalPolicy.push({ hoursBeforeStart: 0, refundPercent: 50 });
      }
      payload.finance = {
        entryFeeDC,
        finalFundRate: Number(formData.finalFundRate) || 0,
        payoutSplit: [
          Number(formData.payoutSplit1) || 50,
          Number(formData.payoutSplit2) || 35,
          Number(formData.payoutSplit3) || 15
        ],
        payoutMode: formData.payoutMode || 'per_player',
        withdrawalPolicy,
        seasonId: formData.seasonId || undefined
      };
    }

    try {
      setLoading(true);
      LOG('submit API call start', { isEditMode, tournamentId });
      if (isEditMode) {
        const updated = await tournamentApi.update(tournamentId, payload);
        LOG('submit success, navigating to tournament', updated?.id || tournamentId);
        window.dispatchEvent(new Event('tournament-updated'));
        navigate(`/tournament/${updated?.id || updated?._id || tournamentId}`);
      } else {
        const tournament = await tournamentApi.create(payload);
        const newId = tournament?.id || tournament?._id;
        LOG('create success, navigating to tournament', newId);
        navigate(`/tournament/${newId}`);
      }
    } catch (err) {
      LOG('submit error', err?.message || err);
      const msg = err.response?.data?.error || err.response?.data?.message || (isEditMode ? 'Ошибка при сохранении' : 'Ошибка при создании турнира');
      setError(msg.includes('similar name') || msg.includes('already exists') ? t('createTournament.nameDuplicate') : msg);
      if (import.meta.env.DEV) console.error(isEditMode ? 'Update tournament error:' : 'Create tournament error:', err);
    } finally {
      setLoading(false);
    }
  };

  const defaultAdmin = 'ivanchk';
  const adminUsers = (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = user && adminUsers.includes(((user.pubgNick || user.username) || '').toLowerCase());
  const isDeveloper = useMemo(() => {
    if (!user) return false;
    const userKey = (user.pubgNick || user.username || '').toLowerCase();
    return DEVELOPERS.length > 0 && DEVELOPERS.includes(userKey);
  }, [user]);
  const canAccess = isEditMode ? isDeveloper : isAdmin;
  if (!canAccess) {
    LOG('early return: no access', { isEditMode, isDeveloper, isAdmin });
    return (
      <div className="error">
          <p>{isEditMode ? t('createTournament.accessDeniedEdit') : t('createTournament.accessDeniedCreate')}</p>
        </div>
    );
  }
  if (isEditMode && loading && !dirty && !formData.name) {
    LOG('early return: loading screen');
    return (
      <div className="create-tournament">
        <div className="helper-text muted">{t('createTournament.loadingTournament')}</div>
      </div>
    );
  }
  if (isEditMode && loadError) {
    LOG('early return: loadError screen', loadError);
    return (
      <div className="create-tournament">
        <div className="error-message">{loadError}</div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>{t('common.back')}</button>
      </div>
    );
  }

  const steps = [
    { id: 1, label: t('createTournament.basicData') },
    { id: 2, label: t('createTournament.scoring') },
    { id: 3, label: t('createTournament.payment') }
  ];

  return (
    <>
    <div className="create-tournament">
        <div className="steps">
          {steps.map((item) => (
            <div key={item.id} className={`step-pill ${step === item.id ? 'active' : ''}`}>
              {item.label}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="tournament-form">
          {step === 1 && (
            <div className="form-section">
              <h2>{t('createTournament.mainInfo')}</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="name">{t('createTournament.name')}</label>
                  <input
                    className="input form-input--name"
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder={t('createTournament.namePlaceholder')}
                  />
                  {(fieldErrors.name || isDuplicateName) && (
                    <span className="form-field-error">{fieldErrors.name || t('createTournament.nameDuplicate')}</span>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="date">{t('createTournament.date')}</label>
                  <input
                    className="input form-input--date"
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    min={today}
                  />
                  {fieldErrors.date && <span className="form-field-error">{fieldErrors.date}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="startTime">{t('createTournament.startTime')}</label>
                  <input
                    className="input form-input--time"
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime || '18:00'}
                    onChange={handleChange}
                    title={t('createTournament.startTimeHint')}
                  />
                  <span className="form-field-hint">{t('createTournament.startTimeHint')}</span>
                </div>
                <div className="form-group">
                  <label htmlFor="type">{t('createTournament.type')}</label>
                  <select
                    className="select"
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                  >
                    <option value="solo">{t('createTournament.typeSolo')}</option>
                    <option value="duo">{t('createTournament.typeDuo')}</option>
                    <option value="squad">{t('createTournament.typeSquad')}</option>
                    <option value="mixed">{t('createTournament.typeMixed')}</option>
                  </select>
                  {isEditMode && formData.type !== editMetaRef.current.type && editMetaRef.current.teamsCount > 0 && (
                    <span className="form-field-hint form-field-hint--warning">
                      {t('createTournament.typeChangeHint', { count: editMetaRef.current.teamsCount })}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="rounds">{t('createTournament.rounds')}</label>
                  <input
                    className="input"
                    type="number"
                    id="rounds"
                    name="rounds"
                    value={formData.rounds}
                    onChange={handleChange}
                    min="1"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="form-section">
                <h2>{t('createTournament.scoringTitle')}</h2>
                <button
                  type="button"
                  className="form-scoring-link"
                  onClick={() => setShowScoringModal(true)}
                >
                  {t('createTournament.scoringHint')}
                </button>
                <div className="scoring-grid">
                  <div className="form-group">
                    <label htmlFor="placement1">1 {t('createTournament.placement')}</label>
                    <input
                      className="input"
                      type="number"
                      id="placement1"
                      name="placement1"
                      value={formData.placement1}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="placement2">2 {t('createTournament.placement')}</label>
                    <input
                      className="input"
                      type="number"
                      id="placement2"
                      name="placement2"
                      value={formData.placement2}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="placement3">3 {t('createTournament.placement')}</label>
                    <input
                      className="input"
                      type="number"
                      id="placement3"
                      name="placement3"
                      value={formData.placement3}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="placement4">4 {t('createTournament.placement')}</label>
                    <input
                      className="input"
                      type="number"
                      id="placement4"
                      name="placement4"
                      value={formData.placement4}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="placement5">5 {t('createTournament.placement')}</label>
                    <input
                      className="input"
                      type="number"
                      id="placement5"
                      name="placement5"
                      value={formData.placement5}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="placement6">6 {t('createTournament.placement')}</label>
                    <input
                      className="input"
                      type="number"
                      id="placement6"
                      name="placement6"
                      value={formData.placement6}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="perKill">{t('createTournament.perKill')}</label>
                  <input
                    className="input"
                    type="number"
                    id="perKill"
                    name="perKill"
                    value={formData.perKill}
                    onChange={handleChange}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tournamentWeight">{t('createTournament.tournamentWeightLabel')}</label>
                  <input
                    className="input"
                    type="number"
                    id="tournamentWeight"
                    name="tournamentWeight"
                    value={formData.tournamentWeight}
                    onChange={handleChange}
                    min="10"
                    max="50"
                  />
                  <span className="form-field-hint">{t('createTournament.tournamentWeightHint')}</span>
                </div>
                <div className="form-group form-group--checkbox">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="countInRating"
                      checked={formData.countInRating !== false}
                      onChange={handleChange}
                    />
                    {t('createTournament.countInRatingLabel')}
                  </label>
                  <span className="form-field-hint">{t('createTournament.countInRatingHint')}</span>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="form-section">
              <h2>{t('createTournament.paymentTitle')}</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="price">{t('createTournament.price')}</label>
                  <input
                    className="input"
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    min="0"
                    placeholder={t('createTournament.pricePlaceholder')}
                  />
                  <span className="form-field-hint">
                    DC-­взнос считается автоматически по цене турнира (1 DC = 1 ₽).
                  </span>
                </div>
                <div className="form-group">
                  <label>{t('createTournament.teamCapModeLabel')}</label>
                  <div className="form-row-inline form-row-inline--wrap">
                    <label className="radio-inline">
                      <input
                        type="radio"
                        name="teamCapMode"
                        value="auto"
                        checked={formData.teamCapMode === 'auto'}
                        onChange={handleChange}
                      />
                      {t('createTournament.teamCapModeAuto')}
                    </label>
                    <label className="radio-inline">
                      <input
                        type="radio"
                        name="teamCapMode"
                        value="manual"
                        checked={formData.teamCapMode === 'manual'}
                        onChange={handleChange}
                      />
                      {t('createTournament.teamCapModeManual')}
                    </label>
                  </div>
                  <span className="form-field-hint">{t('createTournament.teamCapModeHint')}</span>
                </div>
                {formData.teamCapMode === 'manual' && (
                  <div className="form-group">
                    <label htmlFor="barrier">{t('createTournament.barrier')}</label>
                    <input
                      className="input"
                      type="number"
                      id="barrier"
                      name="barrier"
                      value={formData.barrier}
                      onChange={handleChange}
                      min="0"
                      placeholder={t('createTournament.barrierPlaceholder')}
                    />
                  </div>
                )}
                {formData.teamCapMode === 'auto' && (
                  <span className="form-field-hint form-field-hint--block">{t('createTournament.teamCapModeAutoHint')}</span>
                )}
              </div>

              <div className="form-grid form-grid--two-columns">
                <div className="form-group">
                  <label>{t('createTournament.payoutSplit', 'Призы 1/2/3 место (%)')}</label>
                  <div className="form-row-inline">
                    <input
                      className="input form-input--short"
                      name="payoutSplit1"
                      value={formData.payoutSplit1}
                      onChange={handleChange}
                      type="number"
                      min="0"
                      max="100"
                    />
                    <input
                      className="input form-input--short"
                      name="payoutSplit2"
                      value={formData.payoutSplit2}
                      onChange={handleChange}
                      type="number"
                      min="0"
                      max="100"
                    />
                    <input
                      className="input form-input--short"
                      name="payoutSplit3"
                      value={formData.payoutSplit3}
                      onChange={handleChange}
                      type="number"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="payoutMode">{t('createTournament.payoutMode', 'Выплата призов')}</label>
                  <select
                    className="select"
                    id="payoutMode"
                    name="payoutMode"
                    value={formData.payoutMode}
                    onChange={handleChange}
                  >
                    <option value="per_player">{t('createTournament.payoutModePerPlayer', 'Каждому игроку')}</option>
                    <option value="pay_captain">{t('createTournament.payoutModeCaptain', 'Капитану')}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="rules">{t('createTournament.rules')}</label>
                <textarea
                  className="input textarea"
                  id="rules"
                  name="rules"
                  value={formData.rules}
                  onChange={handleChange}
                  rows="4"
                  placeholder={t('createTournament.rulesPlaceholder')}
                />
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                LOG('Назад clicked', { step });
                if (step === 1) {
                  if (dirty && !window.confirm(t('createTournament.confirmBack'))) return;
                  LOG('Назад: navigate(-1)');
                  navigate(-1);
                } else {
                  LOG('Назад: setStep', step - 1);
                  setStep(step - 1);
                }
              }}
              disabled={loading}
            >
              {t('createTournament.back')}
            </button>
            {step < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  LOG('Далее clicked', { step, canProceedStep1: step !== 1 || canProceedStep1 });
                  if (step === 1 && !validateStep1()) return;
                  requestAnimationFrame(() => setStep(step + 1));
                }}
                disabled={loading || (step === 1 && !canProceedStep1)}
              >
                {t('createTournament.next')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
              >
                {loading ? (isEditMode ? t('createTournament.saving') : t('createTournament.creating')) : (isEditMode ? t('createTournament.saveChanges') : t('createTournament.create'))}
              </button>
            )}
          </div>
        </form>
    </div>

      {showScoringModal && (
        <Modal
          title={t('createTournament.scoringModalTitle')}
          onClose={() => setShowScoringModal(false)}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setShowScoringModal(false)}>
              {t('createTournament.scoringModalOk')}
            </button>
          }
        >
          <p>{t('createTournament.scoringModalText1')}</p>
          <p>{t('createTournament.scoringModalText2')}</p>
        </Modal>
      )}
    </>
  );
}

export default CreateTournament;
