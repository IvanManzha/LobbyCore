// src/frontend/src/components/admin/AdminFeedTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/api';
import AdminFeedPostDrawer from './AdminFeedPostDrawer';
import './AdminFeedTab.css';

const TYPE_FILTER = { all: 'all', tournament: 'tournament', promo: 'promo' };
const STATUS_FILTER = { all: 'all', published: 'published', draft: 'draft', archived: 'archived' };

function AdminFeedTab() {
  const [posts, setPosts] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState(TYPE_FILTER.all);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTER.all);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.feed.getAll();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка загрузки', true);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadTournaments = useCallback(async () => {
    try {
      const data = await adminApi.tournaments.getAll();
      setTournaments(Array.isArray(data) ? data : []);
    } catch {
      setTournaments([]);
    }
  }, []);

  useEffect(() => {
    loadPosts();
    loadTournaments();
  }, [loadPosts, loadTournaments]);

  const filteredPosts = React.useMemo(() => {
    let list = [...posts];
    if (typeFilter !== TYPE_FILTER.all) {
      list = list.filter(p => p.type === typeFilter);
    }
    if (statusFilter !== STATUS_FILTER.all) {
      list = list.filter(p => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => {
        const title = (p.title || '').toLowerCase();
        const name = (p.tournamentId && tournaments.find(t => t.id === p.tournamentId)?.name || '').toLowerCase();
        return title.includes(q) || name.includes(q) || (p.id || '').toLowerCase().includes(q);
      });
    }
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [posts, typeFilter, statusFilter, search, tournaments]);

  const handleCreate = () => {
    setEditingPost(null);
    setDrawerOpen(true);
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingPost(null);
  };

  const handleSave = async (payload) => {
    try {
      if (editingPost?.id) {
        await adminApi.feed.update(editingPost.id, payload);
        showToast('Пост обновлён');
      } else {
        await adminApi.feed.create(payload);
        showToast('Пост создан');
      }
      handleCloseDrawer();
      loadPosts();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка сохранения', true);
    }
  };

  const handleDuplicate = async (post) => {
    try {
      const copy = {
        ...post,
        id: undefined,
        createdAt: new Date().toISOString()
      };
      delete copy.id;
      await adminApi.feed.create(copy);
      showToast('Пост скопирован');
      loadPosts();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка дублирования', true);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Удалить пост «${post.id}»?`)) return;
    try {
      await adminApi.feed.delete(post.id);
      showToast('Пост удалён');
      loadPosts();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Ошибка удаления', true);
    }
  };

  const getTitle = (p) => {
    if (p.type === 'promo') return p.title || p.id || '—';
    const t = tournaments.find(tour => tour.id === p.tournamentId);
    return t?.name || p.tournamentId || '—';
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return d;
    }
  };

  return (
    <div className="admin-feed-tab">
      <div className="admin-feed-toolbar">
        <div className="admin-feed-filters">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="admin-feed-select"
          >
            <option value={TYPE_FILTER.all}>Все типы</option>
            <option value={TYPE_FILTER.tournament}>Турнир</option>
            <option value={TYPE_FILTER.promo}>Промо</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="admin-feed-select"
          >
            <option value={STATUS_FILTER.all}>Все статусы</option>
            <option value={STATUS_FILTER.published}>Published</option>
            <option value={STATUS_FILTER.draft}>Draft</option>
            <option value={STATUS_FILTER.archived}>Archived</option>
          </select>
          <input
            type="search"
            placeholder="Поиск по названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="admin-feed-search"
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={handleCreate}>
          Создать пост
        </button>
      </div>

      {loading ? (
        <p className="admin-feed-loading">Загрузка...</p>
      ) : (
        <div className="admin-feed-table-wrap">
          <table className="admin-feed-table">
            <thead>
              <tr>
                <th>Статус</th>
                <th>Тип</th>
                <th>Название</th>
                <th>Приоритет</th>
                <th>Расписание</th>
                <th>Создан</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-feed-empty">Нет постов</td>
                </tr>
              ) : (
                filteredPosts.map(p => (
                  <tr key={p.id}>
                    <td><span className={`admin-feed-status admin-feed-status--${p.status}`}>{p.status}</span></td>
                    <td>{p.type}</td>
                    <td>{getTitle(p)}</td>
                    <td>{p.priority ?? 0}</td>
                    <td>
                      {p.startAt || p.endAt
                        ? `${p.startAt ? formatDate(p.startAt) : '—'} / ${p.endAt ? formatDate(p.endAt) : '—'}`
                        : '—'}
                    </td>
                    <td>{formatDate(p.createdAt)}</td>
                    <td>
                      <div className="admin-feed-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleEdit(p)} title="Редактировать">Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(p)} title="Дублировать">Duplicate</button>
                        <button type="button" className="btn btn-ghost btn-sm admin-feed-delete" onClick={() => handleDelete(p)} title="Удалить">Delete</button>
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
        <div className={`admin-feed-toast ${toast.isError ? 'admin-feed-toast--error' : ''}`}>
          {toast.message}
        </div>
      )}

      <AdminFeedPostDrawer
        open={drawerOpen}
        post={editingPost}
        tournaments={tournaments}
        onSave={handleSave}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}

export default AdminFeedTab;
