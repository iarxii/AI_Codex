const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aicodex-be-1096425756328.us-central1.run.app';
const PREMIUM_API_URL = import.meta.env.VITE_PREMIUM_URL || '';
const COLAB_URL = import.meta.env.VITE_COLAB_URL || '';
const COLAB_SECRET = import.meta.env.VITE_COLAB_SECRET || '';

export const config = {
  API_BASE_URL,
  PREMIUM_API_URL,
  COLAB_URL,
  COLAB_SECRET,
  API_V1_STR: '/api',
};

/**
 * Resolves the backend URL based on the active space status.
 * Prioritizes: Colab (GPU) -> Cloud Run Premium (Dedicated) -> Cloud Run Base.
 */
export const getApiUrl = (isPremium?: boolean) => {
  if (isPremium) {
    // If we have an active Colab instance, use it for GPU acceleration
    if (config.COLAB_URL) return config.COLAB_URL;
    // Fallback to dedicated Premium Cloud Run instance
    if (config.PREMIUM_API_URL) return config.PREMIUM_API_URL;
  }
  return config.API_BASE_URL;
};

export const getWsUrl = (isPremium?: boolean) => {
  const url = getApiUrl(isPremium);
  return url.replace(/^http/, 'ws');
};
