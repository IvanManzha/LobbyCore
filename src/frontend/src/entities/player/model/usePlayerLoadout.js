import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth';
import { playerApi } from '@/services/api';
import { useFeatureFlag } from '@/contexts/FeatureFlagsContext';
import {
  DEFAULT_PLAQUE_LOADOUT,
  getDemoLoadoutForPlayer,
} from '@/entities/achievement';
import { loadStoredLoadout } from '../lib/plaqueLoadoutStorage';

const DISABLED_LOADOUT = { ...DEFAULT_PLAQUE_LOADOUT };

/**
 * @param {string | null | undefined} playerId
 * @param {{ preferStored?: boolean }} [options]
 */
export function usePlayerLoadout(playerId, options = {}) {
  const plaquesEnabled = useFeatureFlag('playerPlaques');
  const { user } = useAuth();
  const normalizedId = (playerId || '').trim();
  const selfId = (user?.pubgNick || user?.username || '').trim();
  const isSelf =
    Boolean(normalizedId && selfId) &&
    normalizedId.toLowerCase() === selfId.toLowerCase();

  const [loadout, setLoadoutState] = useState(() => ({ ...DEFAULT_PLAQUE_LOADOUT }));
  const [loading, setLoading] = useState(Boolean(normalizedId && plaquesEnabled));

  const readFallbackLoadout = useCallback(() => {
    if (!normalizedId) return getDemoLoadoutForPlayer('');
    if (isSelf || options.preferStored) {
      return loadStoredLoadout(normalizedId);
    }
    return getDemoLoadoutForPlayer(normalizedId);
  }, [normalizedId, isSelf, options.preferStored]);

  const refresh = useCallback(async () => {
    if (!plaquesEnabled) {
      setLoadoutState({ ...DISABLED_LOADOUT });
      return;
    }
    if (!normalizedId) {
      setLoadoutState(getDemoLoadoutForPlayer(''));
      return;
    }
    try {
      const data = isSelf
        ? await playerApi.getMyCosmetics()
        : await playerApi.getCosmetics(normalizedId);
      setLoadoutState(data?.loadout || { ...DEFAULT_PLAQUE_LOADOUT });
    } catch {
      setLoadoutState(readFallbackLoadout());
    }
  }, [plaquesEnabled, normalizedId, isSelf, readFallbackLoadout]);

  useEffect(() => {
    if (!plaquesEnabled) {
      setLoadoutState({ ...DISABLED_LOADOUT });
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [plaquesEnabled, refresh]);

  useEffect(() => {
    if (!plaquesEnabled || !normalizedId) return undefined;
    const key = normalizedId.toLowerCase();
    const onChange = (e) => {
      if (e.detail?.playerId === key) {
        refresh();
      }
    };
    window.addEventListener('player-plaque-loadout-changed', onChange);
    return () => window.removeEventListener('player-plaque-loadout-changed', onChange);
  }, [plaquesEnabled, normalizedId, refresh]);

  const setLoadout = useCallback(
    async (next) => {
      if (!plaquesEnabled || !isSelf || !normalizedId) return;
      const value = typeof next === 'function' ? next(loadout) : next;
      const data = await playerApi.updateMyCosmetics(value);
      setLoadoutState(data?.loadout || { ...DEFAULT_PLAQUE_LOADOUT });
      window.dispatchEvent(
        new CustomEvent('player-plaque-loadout-changed', {
          detail: { playerId: normalizedId.toLowerCase() },
        }),
      );
    },
    [plaquesEnabled, isSelf, normalizedId, loadout],
  );

  return useMemo(
    () => {
      if (!plaquesEnabled) {
        return {
          loadout: { ...DISABLED_LOADOUT },
          loading: false,
          isSelf: false,
          setLoadout: async () => {},
          refresh: async () => {},
        };
      }
      return {
        loadout,
        loading,
        isSelf,
        setLoadout,
        refresh,
      };
    },
    [plaquesEnabled, loadout, loading, isSelf, setLoadout, refresh],
  );
}
