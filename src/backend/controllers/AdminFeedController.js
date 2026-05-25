// src/backend/controllers/AdminFeedController.js
const fs = require('fs').promises;
const { getAdminFeedPath } = require('../config/dataPaths');
const AdminLogService = require('../services/AdminLogService');

function getPath() {
  const p = getAdminFeedPath();
  if (!p) return null;
  return p;
}

function validatePost(body, isUpdate = false) {
  if (!body.type || !['tournament', 'promo'].includes(body.type)) {
    return { error: 'type is required and must be "tournament" or "promo"' };
  }
  if (!body.status || !['draft', 'published', 'archived'].includes(body.status)) {
    return { error: 'status is required and must be "draft", "published" or "archived"' };
  }
  if (body.type === 'tournament' && !body.tournamentId) {
    return { error: 'tournamentId is required for type tournament' };
  }
  if (body.type === 'promo') {
    if (!body.title && !body.text) {
      return { error: 'title or text is required for type promo' };
    }
  }
  if (body.image && (typeof body.image !== 'object' || !body.image.url)) {
    return { error: 'image must be an object with url (and optional alt)' };
  }
  return null;
}

function ensureId(post) {
  if (!post.id) {
    post.id = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return post;
}

function normalizePost(body) {
  const post = {
    id: body.id,
    type: body.type,
    status: body.status,
    pinned: Boolean(body.pinned),
    createdAt: body.createdAt || new Date().toISOString(),
    createdBy: body.createdBy || 'admin',
    priority: typeof body.priority === 'number' ? body.priority : Number(body.priority) || 0,
    startAt: body.startAt || null,
    endAt: body.endAt || null,
    image: body.image && body.image.url
      ? { url: body.image.url, alt: body.image.alt || '' }
      : { url: '/assets/feed/covers/cover_default.svg', alt: '' }
  };
  if (post.type === 'tournament') {
    post.tournamentId = body.tournamentId;
    post.cta = body.cta && body.cta.label
      ? { label: body.cta.label, action: body.cta.action || 'register' }
      : { label: 'Регистрация', action: 'register' };
  } else {
    post.title = body.title || '';
    post.text = body.text || '';
    post.cta = body.cta
      ? { label: body.cta.label || 'Подробнее', action: body.cta.action || 'open', href: body.cta.href || '/' }
      : { label: 'Подробнее', action: 'open', href: '/' };
  }
  return post;
}

class AdminFeedController {
  async getAll(req, res) {
    const path = getPath();
    if (!path) {
      return res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    }
    try {
      const content = await fs.readFile(path, 'utf-8').catch(err => {
        if (err.code === 'ENOENT') return '[]';
        throw err;
      });
      const data = JSON.parse(content);
      const list = Array.isArray(data) ? data : [];
      res.json(list);
    } catch (error) {
      console.error('Admin feed getAll:', error);
      res.status(500).json({ error: 'Failed to load admin feed' });
    }
  }

  async create(req, res) {
    const path = getPath();
    if (!path) {
      return res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    }
    const err = validatePost(req.body, false);
    if (err) return res.status(400).json({ error: err.error });
    try {
      let list = [];
      try {
        const content = await fs.readFile(path, 'utf-8');
        list = JSON.parse(content);
        if (!Array.isArray(list)) list = [];
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      const post = normalizePost(req.body);
      ensureId(post);
      list.push(post);
      await fs.writeFile(path, JSON.stringify(list, null, 2), 'utf-8');
      AdminLogService.add(req.user?.username || req.user?.playerName, 'feed.create', 'feed', post.id);
      res.status(201).json({ success: true, post });
    } catch (error) {
      console.error('Admin feed create:', error);
      res.status(500).json({ error: 'Failed to create post' });
    }
  }

  async update(req, res) {
    const path = getPath();
    if (!path) {
      return res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    }
    const { id } = req.params;
    const err = validatePost(req.body, true);
    if (err) return res.status(400).json({ error: err.error });
    try {
      const content = await fs.readFile(path, 'utf-8');
      let list = JSON.parse(content);
      if (!Array.isArray(list)) list = [];
      const index = list.findIndex(p => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const post = normalizePost({ ...list[index], ...req.body, id });
      list[index] = post;
      await fs.writeFile(path, JSON.stringify(list, null, 2), 'utf-8');
      AdminLogService.add(req.user?.username || req.user?.playerName, 'feed.update', 'feed', id);
      res.json({ success: true, post });
    } catch (error) {
      console.error('Admin feed update:', error);
      res.status(500).json({ error: 'Failed to update post' });
    }
  }

  async delete(req, res) {
    const path = getPath();
    if (!path) {
      return res.status(403).json({ error: 'Admin Studio is disabled. Set DEV_DATA=true.' });
    }
    const { id } = req.params;
    try {
      const content = await fs.readFile(path, 'utf-8');
      let list = JSON.parse(content);
      if (!Array.isArray(list)) list = [];
      const index = list.findIndex(p => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Post not found' });
      }
      list.splice(index, 1);
      await fs.writeFile(path, JSON.stringify(list, null, 2), 'utf-8');
      AdminLogService.add(req.user?.username || req.user?.playerName, 'feed.delete', 'feed', id);
      res.json({ success: true, deleted: id });
    } catch (error) {
      console.error('Admin feed delete:', error);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  }
}

module.exports = new AdminFeedController();
