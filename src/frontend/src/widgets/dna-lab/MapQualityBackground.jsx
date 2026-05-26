import React from 'react';

/**
 * Два слоя одной карты: preview (по умолчанию) и full (после скролла).
 */
export default function MapQualityBackground({
  lowUrl,
  highUrl,
  quality = 'low',
  className = '',
  imgClassName = 'dna-replay-immerse-map-img',
  cacheBust = '4',
}) {
  if (!lowUrl && !highUrl) return null;

  const bust = (url) => (url ? `${url}?v=${cacheBust}` : null);
  const showHigh = quality === 'high' && highUrl;

  return (
    <div className={`dna-map-quality-bg ${className}`.trim()} aria-hidden>
      {lowUrl ? (
        <img
          src={bust(lowUrl)}
          alt=""
          className={`${imgClassName} dna-map-quality-bg__layer dna-map-quality-bg__layer--low${
            showHigh ? ' dna-map-quality-bg__layer--hidden' : ''
          }`}
          decoding="async"
        />
      ) : null}
      {highUrl && highUrl !== lowUrl ? (
        <img
          src={bust(highUrl)}
          alt=""
          className={`${imgClassName} dna-map-quality-bg__layer dna-map-quality-bg__layer--high${
            showHigh ? ' dna-map-quality-bg__layer--visible' : ''
          }`}
          decoding="async"
        />
      ) : null}
    </div>
  );
}
