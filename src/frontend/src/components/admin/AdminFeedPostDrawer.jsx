// src/frontend/src/components/admin/AdminFeedPostDrawer.jsx
import React, { useMemo } from 'react';
import TournamentBannerCard from '../feed/TournamentBannerCard';
import PromoBannerCard from '../feed/PromoBannerCard';
import './AdminFeedPostDrawer.css';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликован' },
  { value: 'archived', label: 'Архив' }
];

const TYPE_OPTIONS = [
  { value: 'tournament', label: 'Турнир' },
  { value: 'promo', label: 'Промо' }
];

function AdminFeedPostDrawer({ open, post, tournaments = [], onSave, onClose }) {
  const isEdit = Boolean(post?.id);
  const [form, setForm] = React.useState(() => ({
    type: 'tournament',
    status: 'draft',
    priority: 5,
    pinned: false,
    startAt: '',
    endAt: '',
    image: { url: '/assets/feed/covers/cover_default.svg', alt: '' },
    tournamentId: '',
    title: '',
    text: '',
    cta: { label: 'Регистрация', action: 'register', href: '/' }
  }));

  React.useEffect(() => {
    if (post) {
      setForm({
        type: post.type || 'tournament',
        status: post.status || 'draft',
        priority: post.priority ?? 5,
        pinned: Boolean(post.pinned),
        startAt: post.startAt ? post.startAt.slice(0, 16) : '',
        endAt: post.endAt ? post.endAt.slice(0, 16) : '',
        image: post.image && post.image.url
          ? { url: post.image.url, alt: post.image.alt || '' }
          : { url: '/assets/feed/covers/cover_default.svg', alt: '' },
        tournamentId: post.tournamentId || '',
        title: post.title || '',
        text: post.text || '',
        cta: post.cta
          ? { label: post.cta.label || '', action: post.cta.action || 'register', href: post.cta.href || '/' }
          : { label: 'Регистрация', action: 'register', href: '/' }
      });
    } else {
      setForm({
        type: 'tournament',
        status: 'draft',
        priority: 5,
        pinned: false,
        startAt: '',
        endAt: '',
        image: { url: '/assets/feed/covers/cover_default.svg', alt: '' },
        tournamentId: tournaments[0]?.id || '',
        title: '',
        text: '',
        cta: { label: 'Регистрация', action: 'register', href: '/' }
      });
    }
  }, [post, open, tournaments]);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateNested = (parent, key, value) => {
    setForm(prev => ({
      ...prev,
      [parent]: { ...(prev[parent] || {}), [key]: value }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      type: form.type,
      status: form.status,
      priority: Number(form.priority) || 0,
      pinned: form.pinned,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
      image: { url: form.image?.url || '/assets/feed/covers/cover_default.svg', alt: form.image?.alt || '' }
    };
    if (form.type === 'tournament') {
      payload.tournamentId = form.tournamentId;
      payload.cta = { label: form.cta?.label || 'Регистрация', action: form.cta?.action || 'register' };
    } else {
      payload.title = form.title;
      payload.text = form.text;
      payload.cta = {
        label: form.cta?.label || 'Подробнее',
        action: form.cta?.action || 'open',
        href: form.cta?.href || '/'
      };
    }
    if (post?.id) payload.id = post.id;
    onSave(payload);
  };

  const previewPost = useMemo(() => ({
    id: post?.id || 'preview',
    type: form.type,
    status: form.status,
    priority: form.priority,
    pinned: form.pinned,
    startAt: form.startAt || null,
    endAt: form.endAt || null,
    createdAt: post?.createdAt || new Date().toISOString(),
    image: { url: form.image?.url || '/assets/feed/covers/cover_default.svg', alt: form.image?.alt || '' },
    tournamentId: form.tournamentId,
    title: form.title,
    text: form.text,
    cta: form.cta
  }), [form, post]);

  if (!open) return null;

  return (
    <div className="admin-drawer-overlay" onClick={onClose}>
      <div className="admin-drawer" onClick={e => e.stopPropagation()}>
        <div className="admin-drawer-header">
          <h3>{isEdit ? 'Редактировать пост' : 'Новый пост'}</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Закрыть</button>
        </div>
        <div className="admin-drawer-body">
          <form onSubmit={handleSubmit} className="admin-feed-form">
            <div className="form-row">
              <label>Тип</label>
              <select
                value={form.type}
                onChange={e => update('type', e.target.value)}
              >
                {TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Статус</label>
              <select
                value={form.status}
                onChange={e => update('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Приоритет</label>
              <input
                type="number"
                value={form.priority}
                onChange={e => update('priority', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={e => update('pinned', e.target.checked)}
                />
                {' '}Закреплён
              </label>
            </div>
            <div className="form-row">
              <label>startAt</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={e => update('startAt', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>endAt</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={e => update('endAt', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Картинка URL</label>
              <input
                type="text"
                value={form.image?.url || ''}
                onChange={e => updateNested('image', 'url', e.target.value)}
                placeholder="/assets/feed/covers/cover_default.svg"
              />
            </div>
            <div className="form-row">
              <label>Картинка alt</label>
              <input
                type="text"
                value={form.image?.alt || ''}
                onChange={e => updateNested('image', 'alt', e.target.value)}
              />
            </div>

            {form.type === 'tournament' && (
              <>
                <div className="form-row">
                  <label>Турнир</label>
                  <select
                    value={form.tournamentId}
                    onChange={e => update('tournamentId', e.target.value)}
                  >
                    <option value="">— Выберите —</option>
                    {tournaments.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>CTA label</label>
                  <input
                    type="text"
                    value={form.cta?.label || ''}
                    onChange={e => updateNested('cta', 'label', e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label>CTA action</label>
                  <select
                    value={form.cta?.action || 'register'}
                    onChange={e => updateNested('cta', 'action', e.target.value)}
                  >
                    <option value="register">register</option>
                    <option value="open">open</option>
                  </select>
                </div>
              </>
            )}

            {form.type === 'promo' && (
              <>
                <div className="form-row">
                  <label>Заголовок</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => update('title', e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label>Текст</label>
                  <textarea
                    value={form.text}
                    onChange={e => update('text', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="form-row">
                  <label>CTA label</label>
                  <input
                    type="text"
                    value={form.cta?.label || ''}
                    onChange={e => updateNested('cta', 'label', e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label>CTA href</label>
                  <input
                    type="text"
                    value={form.cta?.href || ''}
                    onChange={e => updateNested('cta', 'href', e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="admin-drawer-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
              <button type="submit" className="btn btn-primary">Сохранить</button>
            </div>
          </form>

          <div className="admin-drawer-preview">
            <h4>Предпросмотр</h4>
            <div className="admin-drawer-preview-card">
              {previewPost.type === 'tournament' ? (
                <TournamentBannerCard post={previewPost} />
              ) : (
                <PromoBannerCard post={previewPost} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminFeedPostDrawer;
