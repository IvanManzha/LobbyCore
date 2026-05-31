/**
 * Статические env-флаги (fallback до загрузки runtime flags).
 * В компонентах предпочтительно useFeatureFlag() из FeatureFlagsContext.
 */
export const isSteamAuthEnabled = import.meta.env.VITE_WAITING_FOR_PRODUCTION !== 'true';

export const FEATURE_PLAYER_PLAQUES = import.meta.env.VITE_FEATURE_PLAYER_PLAQUES === 'true';

export {
  useFeatureFlag,
  useFeatureFlags,
  FeatureFlagsProvider,
  ENV_FLAG_DEFAULTS,
} from '@/contexts/FeatureFlagsContext';
