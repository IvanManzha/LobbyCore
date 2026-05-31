import React, { useState } from 'react';

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
  const [lowFailed, setLowFailed] = useState(false);
  const [highFailed, setHighFailed] = useState(false);

  if ((!lowUrl && !highUrl) || (lowFailed && highFailed)) return null;

  const bust = (url) => (url ? `${url}?v=${cacheBust}` : null);
  const showHigh = quality === 'high' && highUrl && !highFailed;
  const showLow = lowUrl && !lowFailed && (!showHigh || !highUrl);

  return (
    <div className={`dna-map-quality-bg ${className}`.trim()} aria-hidden>
      {showLow ? (
        <img
          src={bust(lowUrl)}
          alt=""
          className={`${imgClassName} dna-map-quality-bg__layer dna-map-quality-bg__layer--low${
            showHigh ? ' dna-map-quality-bg__layer--hidden' : ''
          }`}
          decoding="async"
          onError={() => setLowFailed(true)}
        />
      ) : null}
      {highUrl && highUrl !== lowUrl && !highFailed ? (
        <img
          src={bust(highUrl)}
          alt=""
          className={`${imgClassName} dna-map-quality-bg__layer dna-map-quality-bg__layer--high${
            showHigh ? ' dna-map-quality-bg__layer--visible' : ''
          }`}
          decoding="async"
          onError={() => setHighFailed(true)}
        />
      ) : null}
    </div>
  );
}
