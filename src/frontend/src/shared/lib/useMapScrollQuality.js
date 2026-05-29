import { useEffect, useRef, useState } from 'react';

/** Порог прокрутки (px), после которого подменяем preview на полное качество */
export const MAP_SCROLL_QUALITY_THRESHOLD = 320;

/**
 * Прогрессивная загрузка фона карты: по умолчанию preview, после скролла ≥ N — полное качество.
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {{ enabled?: boolean, lowUrl?: string | null, highUrl?: string | null, thresholdPx?: number }} options
 */
export function useMapScrollQuality(
  containerRef,
  { enabled = true, lowUrl = null, highUrl = null, thresholdPx = MAP_SCROLL_QUALITY_THRESHOLD } = {},
) {
  const canUpgrade = Boolean(lowUrl && highUrl && lowUrl !== highUrl);
  const [quality, setQuality] = useState('low');
  const scrollAccumRef = useRef(0);

  useEffect(() => {
    setQuality('low');
    scrollAccumRef.current = 0;
  }, [lowUrl, highUrl]);

  useEffect(() => {
    if (!highUrl) return undefined;
    const img = new Image();
    img.src = highUrl;
    return undefined;
  }, [highUrl]);

  useEffect(() => {
    if (!enabled || !canUpgrade) return undefined;
    const el = containerRef?.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      scrollAccumRef.current += e.deltaY;
      if (scrollAccumRef.current >= thresholdPx) {
        setQuality('high');
      } else if (scrollAccumRef.current <= -thresholdPx) {
        setQuality('low');
        scrollAccumRef.current = 0;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [enabled, canUpgrade, containerRef, thresholdPx]);

  const displayUrl =
    quality === 'high' && highUrl ? highUrl : lowUrl || highUrl || null;

  return {
    quality: canUpgrade ? quality : 'high',
    displayUrl,
    lowUrl: lowUrl || highUrl,
    highUrl: highUrl || lowUrl,
    canUpgrade,
  };
}
