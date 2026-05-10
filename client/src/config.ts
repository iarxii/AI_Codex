const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9173';
const COLAB_URL = import.meta.env.VITE_COLAB_URL || '';
const COLAB_SECRET = import.meta.env.VITE_COLAB_SECRET || '';

export const config = {
  API_BASE_URL,
  COLAB_URL,
  COLAB_SECRET,
  API_V1_STR: '/api',
};

/**
 * Resolves the backend URL based on the active space.
 * Default is Cloud Run, but Premium CodexSpaces use Colab.
 */
export const getApiUrl = (spaceSlug?: string) => {
  if (spaceSlug?.includes('premium') && config.COLAB_URL) {
    return config.COLAB_URL;
  }
  return config.API_BASE_URL;
};

export const getWsUrl = (spaceSlug?: string) => {
  const url = getApiUrl(spaceSlug);
  return url.replace(/^http/, 'ws');
};
