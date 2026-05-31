import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth';
import { playerApi } from '@/services/api';
import { getAchievementById } from '../../../../shared/achievement/index.js';

function toAchievementStates(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const achievement = getAchievementById(row.id);
      if (!achievement) return null;
      return {
        achievement,
        unlocked: row.unlocked,
        current: row.current,
        target: row.target,
        progressRatio: row.progressRatio,
      };
    })
    .filter(Boolean);
}

function toUnlockedSets(payload) {
  return {
    badgeIds: new Set(payload?.unlockedCosmetics?.badgeIds || []),
    backgroundIds: new Set(payload?.unlockedCosmetics?.backgroundIds || []),
  };
}

/**
 * @param {string | null | undefined} playerId
 */
export function usePlayerAchievements(playerId) {
  const { user } = useAuth();
  const normalizedId = (playerId || '').trim();
  const selfId = (user?.pubgNick || user?.username || '').trim();
  const isSelf =
    Boolean(normalizedId && selfId) &&
    normalizedId.toLowerCase() === selfId.toLowerCase();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(Boolean(normalizedId));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!normalizedId) {
      setPayload(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const data = isSelf
        ? await playerApi.getMyCosmetics()
        : await playerApi.getCosmetics(normalizedId);
      setPayload(data);
      return data;
    } catch (err) {
      setPayload(null);
      setError(err?.response?.data?.error || err?.message || 'Failed to load achievements');
      return null;
    } finally {
      setLoading(false);
    }
  }, [normalizedId, isSelf]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!normalizedId) {
        if (!cancelled) {
          setPayload(null);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = isSelf
          ? await playerApi.getMyCosmetics()
          : await playerApi.getCosmetics(normalizedId);
        if (cancelled) return;
        setPayload(data);
      } catch (err) {
        if (cancelled) return;
        setPayload(null);
        setError(err?.response?.data?.error || err?.message || 'Failed to load achievements');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedId, isSelf]);

  const setLoadout = useCallback(
    async (next) => {
      if (!isSelf || !normalizedId) return null;
      const data = await playerApi.updateMyCosmetics(next);
      setPayload(data);
      window.dispatchEvent(
        new CustomEvent('player-plaque-loadout-changed', {
          detail: { playerId: normalizedId.toLowerCase() },
        }),
      );
      return data?.loadout ?? null;
    },
    [isSelf, normalizedId],
  );

  const states = useMemo(() => toAchievementStates(payload?.achievements), [payload?.achievements]);

  const unlockedCosmetics = useMemo(() => toUnlockedSets(payload), [payload]);

  const unlockedCount = useMemo(
    () => states.filter((s) => s.unlocked).length,
    [states],
  );

  return {
    loading,
    error,
    loadout: payload?.loadout ?? null,
    isSelf,
    states,
    unlockedCosmetics,
    unlockedCount,
    totalCount: states.length,
    setLoadout,
    refresh,
  };
}
