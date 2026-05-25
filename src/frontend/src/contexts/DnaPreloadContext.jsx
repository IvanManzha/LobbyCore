import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { getProfile, getDictionary } from "../services/dnaApi";

const DnaPreloadContext = createContext(null);

export function useDnaPreload() {
  return useContext(DnaPreloadContext);
}

const CACHE_KEY_PREFIX = "dnaPreload";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export function cacheKey(playerId, seasonId, useDnaTest) {
  return `${CACHE_KEY_PREFIX}:${playerId}:${seasonId}:${useDnaTest ? "1" : "0"}`;
}

export function getPreloadedDnaData(playerId, seasonId, useDnaTest) {
  try {
    const key = cacheKey(playerId, seasonId, useDnaTest);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    sessionStorage.removeItem(key);
    return data;
  } catch {
    return null;
  }
}

function setCached(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function DnaPreloadProvider({ children, playerId, seasonId = "2025", useDnaTest = false }) {
  const preloadingRef = useRef(false);
  const preload = useCallback(() => {
    if (!playerId || preloadingRef.current) return;
    const key = cacheKey(playerId, seasonId, useDnaTest);
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_MS) return;
      }
    } catch {}
    preloadingRef.current = true;
    Promise.all([
      getProfile(playerId, seasonId, { useDnaTest }),
      getDictionary(),
    ])
      .then(([profileRes, dictRes]) => {
        const data = { profile: profileRes, dictionary: Array.isArray(dictRes) ? dictRes : [] };
        setCached(key, data);
      })
      .catch(() => {})
      .finally(() => {
        preloadingRef.current = false;
      });
  }, [playerId, seasonId, useDnaTest]);

  useEffect(() => {
    if (!playerId) return;
    const schedule = () => {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => preload(), { timeout: 2000 });
      } else {
        setTimeout(preload, 1500);
      }
    };
    const t = setTimeout(schedule, 500);
    return () => clearTimeout(t);
  }, [playerId, seasonId, useDnaTest, preload]);

  return (
    <DnaPreloadContext.Provider value={{ preload }}>
      {children}
    </DnaPreloadContext.Provider>
  );
}
