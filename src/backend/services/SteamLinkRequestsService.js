/**
 * Запросы на привязку Steam к PUBG-профилю. Одобряет админ.
 */
const fs = require('fs');
const path = require('path');
const { steamLinkRequestsPath } = require('../config/dataPaths');

function readRequests() {
  try {
    const data = fs.readFileSync(steamLinkRequestsPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function writeRequests(list) {
  const dir = path.dirname(steamLinkRequestsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(steamLinkRequestsPath, JSON.stringify(list, null, 2), 'utf8');
}

function generateId() {
  return `slr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function create(requesterUsername, targetPubgNick) {
  const list = readRequests();
  const existing = list.find(
    (r) => r.status === 'pending' && r.requesterUsername === requesterUsername && r.targetPubgNick === targetPubgNick
  );
  if (existing) {
    return existing;
  }
  const item = {
    id: generateId(),
    requesterUsername,
    targetPubgNick: String(targetPubgNick || '').trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null
  };
  list.unshift(item);
  writeRequests(list);
  return item;
}

function getAll() {
  return readRequests();
}

function getById(id) {
  return readRequests().find((r) => r.id === id) || null;
}

function setStatus(id, status, reviewedBy) {
  const list = readRequests();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx].status = status;
  list[idx].reviewedBy = reviewedBy;
  list[idx].reviewedAt = new Date().toISOString();
  writeRequests(list);
  return list[idx];
}

module.exports = {
  create,
  getAll,
  getById,
  setStatus
};
