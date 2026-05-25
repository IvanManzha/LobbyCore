// src/frontend/src/components/admin/AdminTournamentsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { validateTournamentDate, getTodayISO } from '../../utils/dateValidation';
import { useTranslation } from '../../contexts/LanguageContext';
import Modal from '../Modal';
import './AdminTournamentsTab.css';

const STATE_LABELS = {
  'Запланирован': 'REG',
  'В процессе': 'LIVE',
  'Турнир окончен': 'DONE'
};

function AdminTournamentsTab() {
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'solo',
    date: new Date().toISOString().split('T')[0],
    rounds: 5,
    rules: '',
    price: '',
    barrier: '',
    createFeedPost: false
  });

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.tournaments.getAll();
      setTournaments(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.response?.data?.error || err.message || t('admin.loadError'), true);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  const openCreate = () => {
    setEditingTournament(null);
    setForm({
      name: '',
      type: 'solo',
      date: new Date().toISOString().split('T')[0],
      rounds: 5,
      rules: '',
      price: '',
      barrier: '',
      createFeedPost: false
    });
    setModalOpen(true);
  };

  const openEdit = (t) => {
    setEditingTournament(t);
    setForm({
      name: t.name || '',
      type: (t.type || 'solo').toLowerCase(),
      date: (t.date || '').slice(0, 10),
      rounds: t.rounds ?? 5,
      rules: typeof t.rules === 'string' ? t.rules : '',
      price: t.price != null ? String(t.price) : '',
      barrier: t.barrier != null ? String(t.barrier) : '',
      createFeedPost: false
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dateResult = validateTournamentDate(form.date, getTodayISO());
    if (!dateResult.valid) {
      showToast(t(dateResult.errorKey, dateResult.params), true);
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        date: form.date,
        startDate: form.date,
        rounds: Number(form.rounds) || 5,
        rules: form.rules.trim(),
        price: form.price === '' ? null : Number(form.price),
        barrier: form.barrier === '' ? null : Number(form.barrier)
      };
      if (editingTournament) {
        await adminApi.tournaments.update(editingTournament.id, payload);
        showToast(t('admin.tournamentUpdated'));
      } else {
        const result = await adminApi.tournaments.create(payload);
        showToast(t('admin.tournamentCreated'));
        if (form.createFeedPost && result.tournament) {
          await adminApi.feed.create({
            type: 'tournament',
            status: 'published',
            priority: 8,
            tournamentId: result.tournament.id,
            image: { url: '/assets/feed/covers/cover_default.svg', alt: result.tournament.name },
            cta: { label: t('tournament.register'), action: 'register' }
          });
          showToast(t('admin.tournamentAndPostCreated'));
        }
      }
      setModalOpen(false);
      loadTournaments();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || t('admin.saveError'), true);
    }
  };

  const handleSetStatus = async (id, status) => {
    if (status === 'DONE' && !window.confirm(t('admin.setStatusConfirm'))) return;
    try {
      await adminApi.tournaments.setStatus(id, status);
      showToast(t('admin.statusSet', { status }));
      loadTournaments();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || t('common.error'), true);
    }
  };

  const formatDate = (d) => (d ? d.slice(0, 10) : '—');
  const stateLabel = (state) => STATE_LABELS[state] || state;

  return (
    <div className="admin-tournaments-tab">
      <div className="admin-tournaments-toolbar">
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          {t('admin.createTournament')}
        </button>
      </div>

      {loading ? (
        <p className="admin-tournaments-loading">{t('admin.loading')}</p>
      ) : (
        <div className="admin-tournaments-table-wrap">
          <table className="admin-tournaments-table">
            <thead>
              <tr>
                <th>{t('admin.name')}</th>
                <th>{t('admin.date')}</th>
                <th>{t('admin.mode')}</th>
                <th>{t('tournament.state')}</th>
                <th>{t('tournament.rounds')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-tournaments-empty">{t('admin.noTournaments')}</td>
                </tr>
              ) : (
                tournaments.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{formatDate(t.date)}</td>
                    <td>{(t.type || '').toLowerCase()}</td>
                    <td><span className={`admin-tournaments-status admin-tournaments-status--${(stateLabel(t.state) || '').toLowerCase()}`}>{stateLabel(t.state) || t.state}</span></td>
                    <td>{t.rounds ?? '—'}</td>
                    <td>
                      <div className="admin-tournaments-actions">
                        <Link to={`/tournament/${t.id}`} className="btn btn-ghost btn-sm">{t('admin.open')}</Link>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>{t('admin.edit')}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleSetStatus(t.id, 'REG')}>{t('admin.setReg')}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleSetStatus(t.id, 'LIVE')}>{t('admin.setLive')}</button>
                        <button type="button" className="btn btn-ghost btn-sm admin-tournaments-done" onClick={() => handleSetStatus(t.id, 'DONE')}>{t('admin.setDone')}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className={`admin-feed-toast ${toast.isError ? 'admin-feed-toast--error' : ''}`} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1100 }}>
          {toast.message}
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editingTournament ? t('admin.editTournament') : t('admin.newTournament')}
          onClose={() => setModalOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</button>
              <button type="submit" form="admin-tournament-form" className="btn btn-primary">{t('common.save')}</button>
            </>
          }
        >
          <form id="admin-tournament-form" onSubmit={handleSubmit} className="admin-tournaments-form">
            <div className="form-row">
              <label>{t('admin.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder={t('admin.namePlaceholder')}
              />
            </div>
            <div className="form-row">
              <label>{t('admin.date')}</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
                min={getTodayISO()}
              />
            </div>
            <div className="form-row">
              <label>{t('admin.mode')}</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="solo">{t('tournament.solo')}</option>
                <option value="duo">{t('tournament.duo')}</option>
                <option value="squad">{t('tournament.squad')}</option>
                <option value="mixed">{t('tournament.mixed')}</option>
              </select>
            </div>
            <div className="form-row">
              <label>{t('admin.rounds')}</label>
              <input
                type="number"
                min={1}
                value={form.rounds}
                onChange={e => setForm(f => ({ ...f, rounds: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label>{t('admin.rules')}</label>
              <textarea
                value={form.rules}
                onChange={e => setForm(f => ({ ...f, rules: e.target.value }))}
                rows={3}
                placeholder={t('admin.rulesPlaceholder')}
              />
            </div>
            <div className="form-row">
              <label>{t('admin.price')}</label>
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="form-row">
              <label>{t('admin.barrier')}</label>
              <input
                type="number"
                min={0}
                value={form.barrier}
                onChange={e => setForm(f => ({ ...f, barrier: e.target.value }))}
                placeholder="—"
              />
            </div>
            {!editingTournament && (
              <div className="form-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.createFeedPost}
                    onChange={e => setForm(f => ({ ...f, createFeedPost: e.target.checked }))}
                  />
                  {' '}Создать пост в ленте
                </label>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

export default AdminTournamentsTab;
