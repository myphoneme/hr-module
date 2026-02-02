import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Buffer } from 'buffer';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CandidateResponsePage } from './components/recruitment/CandidateResponsePage';
import { HeadPersonReviewPage } from './components/recruitment/HeadPersonReviewPage';
import { ToasterProvider } from './contexts/ToasterProvider';
import { API_BASE_URL } from './config/api';
import './index.css';
import App from './App.tsx';

// Polyfill Buffer for @react-pdf/renderer
;(window as any).Buffer = Buffer;

// This entire block runs before React to handle OAuth popups
const normalizeBasePath = (value: string | undefined) => {
  if (!value) return '/';
  let basePath = value.trim();
  if (!basePath.startsWith('/')) basePath = `/${basePath}`;
  if (basePath.length > 1 && basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }
  return basePath;
};

const basePath = normalizeBasePath(import.meta.env.VITE_BASE_PATH);

const normalizeCallbackPath = (path: string) => {
  if (basePath !== '/' && path.startsWith(basePath)) {
    return path.slice(basePath.length) || '/';
  }
  return path;
};

const oauthCallbacks: Record<string, string> = {
  '/auth/google/callback': 'calendar-oauth-callback',
  '/auth/gmail/callback': 'gmail-oauth-callback',
  '/hr/auth/google/callback': 'calendar-oauth-callback',
  '/hr/auth/gmail/callback': 'gmail-oauth-callback',
};

const OAUTH_EVENT_KEY = 'oauth-connection-event';
const OAUTH_CODE_KEY_PREFIX = 'oauth-connection-code:';

const callbackPath = normalizeCallbackPath(window.location.pathname);
const callbackType = oauthCallbacks[callbackPath];

// This function is only used by the fallback localStorage mechanism
const finalizeOAuth = (type: string, code: string) => {
  const endpoint = type === 'gmail-oauth-callback' ? '/gmail/callback' : '/calendar/callback';
  fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code }),
  })
    .then(async response => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return response.json().catch(() => ({}));
    })
    .then(() => {
      // Notify other tabs to reload
      localStorage.setItem(OAUTH_EVENT_KEY, JSON.stringify({ type, ts: Date.now() }));
      // And reload this tab
      window.location.reload();
    })
    .catch(err => {
      alert(`Authentication failed: ${err.message}`);
    });
};


if (callbackType) {
  // This page is an OAuth callback popup.
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (error) {
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:red;"><p>Authentication failed: ${error}</p></div>`;
    setTimeout(() => window.close(), 3000);
  } else if (code) {
    // We have a code. Try to notify the main window.
    // Try postMessage first (ideal case)
    if (window.opener) {
      window.opener.postMessage({ type: callbackType, code }, window.location.origin);
      document.body.innerHTML = '<p>Authentication successful! Closing...</p>';
      setTimeout(() => window.close(), 1000);
    } else {
      // Fallback for production where window.opener is null.
      // Set localStorage items which the main window will detect.
      localStorage.setItem(`${OAUTH_CODE_KEY_PREFIX}${callbackType}`, code);
      localStorage.setItem(OAUTH_EVENT_KEY, JSON.stringify({ type: 'storage-fallback', ts: Date.now() }));
      document.body.innerHTML = '<p>Authentication successful! Closing...</p>';
      setTimeout(() => window.close(), 1000);
    }
  }
} else {
  // This is the main application window, not a popup.
  // Set up listeners and render the app.

  // 1. Listen for localStorage changes to trigger a reload.
  window.addEventListener('storage', (event) => {
    if (event.key === OAUTH_EVENT_KEY) {
      window.location.reload();
    }
  });

  // 2. On page load, check if an OAuth code was stored by the fallback mechanism.
  const storedGmailCode = localStorage.getItem(`${OAUTH_CODE_KEY_PREFIX}gmail-oauth-callback`);
  if (storedGmailCode) {
    localStorage.removeItem(`${OAUTH_CODE_KEY_PREFIX}gmail-oauth-callback`);
    finalizeOAuth('gmail-oauth-callback', storedGmailCode);
  }
  const storedCalendarCode = localStorage.getItem(`${OAUTH_CODE_KEY_PREFIX}calendar-oauth-callback`);
  if (storedCalendarCode) {
    localStorage.removeItem(`${OAUTH_CODE_KEY_PREFIX}calendar-oauth-callback`);
    finalizeOAuth('calendar-oauth-callback', storedCalendarCode);
  }

  // 3. Render the React application.
  const queryClient = new QueryClient();
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={basePath === '/' ? undefined : basePath}>
            <ToasterProvider>
              <Routes>
                <Route path="/candidate-response/:token" element={<CandidateResponsePage />} />
                <Route path="/head-review/:token" element={<HeadPersonReviewPage />} />
                <Route
                  path="/*"
                  element={
                    <AuthProvider>
                      <ThemeProvider>
                        <App />
                      </ThemeProvider>
                    </AuthProvider>
                  }
                />
              </Routes>
            </ToasterProvider>
          </BrowserRouter>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </StrictMode>
  );
}
