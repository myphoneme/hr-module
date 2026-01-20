const DEFAULT_CLIENT_URL = 'http://localhost:5173';
const DEFAULT_SERVER_PORT = 3001;

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

export const serverPort = Number(process.env.PORT) || DEFAULT_SERVER_PORT;

export const serverBaseUrl = normalizeUrl(
  process.env.SERVER_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    `http://localhost:${serverPort}`
);

const rawClientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || DEFAULT_CLIENT_URL;
export const clientBaseUrl = normalizeUrl(rawClientUrl);

const getOriginFromUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return normalizeUrl(value);
  }
};

export const clientOrigin = getOriginFromUrl(rawClientUrl);

const parseOrigins = (rawOrigins: string | undefined, fallback: string) => {
  const origins = rawOrigins
    ? rawOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
    : [fallback];
  return origins;
};

export const corsOrigins = parseOrigins(
  process.env.CORS_ORIGINS || process.env.CORS_ORIGIN,
  clientOrigin
);
