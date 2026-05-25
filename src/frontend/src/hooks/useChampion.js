import { useState, useEffect } from 'react';
import { getCurrentChampion } from '../utils/getCurrentChampion';
import { subscribeToUpdates } from '../services/api';

/**
 * Загружает текущего чемпиона и подписывается на SSE для обновления.
 * @returns {{ champion: object | null, loading: boolean }}
 */
export function useChampion() {
  const [champion, setChampion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchChampion = async () => {
      try {
        const data = await getCurrentChampion();
        if (!cancelled) setChampion(data);
      } catch (err) {
        if (!cancelled) setChampion(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchChampion();
    const unsubscribe = subscribeToUpdates(() => {
      fetchChampion();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { champion, loading };
}
