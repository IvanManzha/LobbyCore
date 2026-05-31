import {
  DEFAULT_PLAQUE_LOADOUT,
  normalizeLoadout,
} from '@/entities/achievement';

const STORAGE_KEY = 'lobbycore:player-plaque-loadout';

export function loadStoredLoadout(playerId) {
  if (typeof window === 'undefined' || !playerId) {
    return { ...DEFAULT_PLAQUE_LOADOUT };
  }
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const raw = all[String(playerId).trim().toLowerCase()];
    return raw ? normalizeLoadout(raw) : { ...DEFAULT_PLAQUE_LOADOUT };
  } catch {
    return { ...DEFAULT_PLAQUE_LOADOUT };
  }
}

export function saveStoredLoadout(playerId, loadout) {
  if (typeof window === 'undefined' || !playerId) return;
  const key = String(playerId).trim().toLowerCase();
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[key] = normalizeLoadout(loadout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('player-plaque-loadout-changed', { detail: { playerId: key } }));
  } catch {
    /* ignore quota / parse errors */
  }
}
