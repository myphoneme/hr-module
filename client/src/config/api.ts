const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';
const DEFAULT_CLIENT_URL = 'http://localhost:5173';

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

export const API_BASE_URL = normalizeUrl(
  import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL
);

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const CLIENT_BASE_URL = normalizeUrl(
  import.meta.env.VITE_CLIENT_URL ||
    import.meta.env.VITE_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : DEFAULT_CLIENT_URL)
);
