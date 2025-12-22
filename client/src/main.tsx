import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Buffer } from 'buffer'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'
import App from './App.tsx'

// Polyfill Buffer for @react-pdf/renderer
(window as any).Buffer = Buffer

// Handle OAuth callback for Calendar/Gmail integration
// This runs before React renders to handle popup callbacks
const oauthCallbacks: Record<string, string> = {
  '/auth/google/callback': 'calendar-oauth-callback',
  '/auth/gmail/callback': 'gmail-oauth-callback'
};

const callbackType = oauthCallbacks[window.location.pathname];
if (callbackType) {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (code && window.opener) {
    // Send the code to the parent window
    window.opener.postMessage({ type: callbackType, code }, window.location.origin);
    // Close the popup
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>Authentication successful! You can close this window.</p></div>';
    setTimeout(() => window.close(), 1500);
  } else if (error) {
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:red;"><p>Authentication failed: ${error}</p></div>`;
    setTimeout(() => window.close(), 3000);
  }
}

const queryClient = new QueryClient()

// Get Google Client ID from environment or use placeholder
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
