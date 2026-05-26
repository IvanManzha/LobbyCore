import React from 'react';
import { APP_NAME, APP_TAGLINE } from '../../config/app';
import './Brand.css';

/** Иконка/логотип приложения (22–26px). Единственное место, где рисуется бренд-марка. */
export function BrandMark({ size = 24, className = '' }) {
  const safeSize = Math.min(64, Math.max(45, size));
  return (
    <img
      className={`brand-mark ${className}`.trim()}
      src="/lobbycore-icon-v4.png"
      width={safeSize}
      height={safeSize}
      alt=""
      style={{ '--brand-mark-size': `${safeSize}px` }}
      aria-hidden
    />
  );
}

/**
 * Бренд-блок: BrandMark + название + опциональный tagline.
 * Используется только в TopBar.
 */
export default function Brand() {
  return (
    <div className="brand" aria-label={`${APP_NAME}, ${APP_TAGLINE}`}>
      <BrandMark size={54} />
      <div className="brand-text">
        <span className="brand-name">{APP_NAME}</span>
        <span className="brand-tagline">{APP_TAGLINE}</span>
      </div>
    </div>
  );
}
