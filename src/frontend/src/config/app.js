/**
 * App config: name and branding (single source of truth)
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'LobbyCore';
/** Tagline shown under app name in TopBar */
export const APP_TAGLINE = 'Tournament Hub';
/** @deprecated Use APP_TAGLINE */
export const APP_SUBTITLE = APP_TAGLINE;

/** DNA Lab feature flag. Set VITE_FEATURE_DNA_LAB=false to hide in production. Default true in dev. */
export const FEATURE_DNA_LAB = import.meta.env.VITE_FEATURE_DNA_LAB !== 'false';

/** Developers (usernames from app accounts). DNA Lab is shown only to these users. Comma-separated in VITE_DEVELOPERS. */
export const DEVELOPERS = (import.meta.env.VITE_DEVELOPERS || '')
  .split(',')
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);
