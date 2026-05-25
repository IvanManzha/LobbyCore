// src/backend/services/AdminLogService.js
const fs = require('fs');
const path = require('path');
const { getAdminLogsPath } = require('../config/dataPaths');

const MAX_ENTRIES = 200;

function getPath() {
  return getAdminLogsPath();
}

function ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
  }
}

function add(userId, action, entityType, entityId) {
  const filePath = getPath();
  if (!filePath) return;
  ensureFile(filePath);
  let list = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    list = JSON.parse(content);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    if (e.code !== 'ENOENT') return;
  }
  list.unshift({
    at: new Date().toISOString(),
    userId: userId || 'unknown',
    action,
    entityType: entityType || null,
    entityId: entityId || null
  });
  if (list.length > MAX_ENTRIES) {
    list = list.slice(0, MAX_ENTRIES);
  }
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
}

function getRecent(limit = 50) {
  const filePath = getPath();
  if (!filePath) return [];
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const list = JSON.parse(content);
    return Array.isArray(list) ? list.slice(0, limit) : [];
  } catch (e) {
    return [];
  }
}

module.exports = {
  add,
  getRecent
};
