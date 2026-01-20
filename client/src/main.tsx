import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Buffer } from 'buffer'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { CandidateResponsePage } from './components/recruitment/CandidateResponsePage'
import { HeadPersonReviewPage } from './components/recruitment/HeadPersonReviewPage'
import { ToasterProvider } from './contexts/ToasterProvider'
import { API_BASE_URL } from './config/api'
import './index.css'
import App from './App.tsx'

// Polyfill Buffer for @react-pdf/renderer
;(window as any).Buffer = Buffer

// Handle OAuth callback for Calendar/Gmail integration
// This runs before React renders to handle popup callbacks
const normalizeBasePath = (value: string | undefined) => {
  if (!value) return '/'
  let basePath = value.trim()
  if (!basePath.startsWith('/')) basePath = `/${basePath}`
  if (basePath.length > 1 && basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1)
  }
  return basePath
}

const basePath = normalizeBasePath(import.meta.env.VITE_BASE_PATH)

const normalizeCallbackPath = (path: string) => {
  if (basePath !== '/' && path.startsWith(basePath)) {
    return path.slice(basePath.length) || '/'
  }
  return path
}

const oauthCallbacks: Record<string, string> = {
  '/auth/google/callback': 'calendar-oauth-callback',
  '/auth/gmail/callback': 'gmail-oauth-callback',
  '/hr/auth/google/callback': 'calendar-oauth-callback',
  '/hr/auth/gmail/callback': 'gmail-oauth-callback',
}

const OAUTH_EVENT_KEY = 'oauth-connection-event'
const OAUTH_CODE_KEY_PREFIX = 'oauth-connection-code:'

// Notify other tabs to refresh after OAuth completes.
window.addEventListener('storage', (event) => {
  if (event.key === OAUTH_EVENT_KEY && event.newValue) {
    window.location.reload()
  }
})

const callbackPath = normalizeCallbackPath(window.location.pathname)
let callbackType = oauthCallbacks[callbackPath]
const finalizeOAuth = (type: string, code: string) => {
  const endpoint = type === 'gmail-oauth-callback' ? '/gmail/callback' : '/calendar/callback'
  fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code }),
  })
    .then(async response => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${response.status}`)
      }
      return response.json().catch(() => ({}))
    })
    .then(() => {
      localStorage.setItem(OAUTH_EVENT_KEY, JSON.stringify({ type, ts: Date.now() }))
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>Authentication successful! Redirecting...</p></div>'
      setTimeout(() => {
        window.location.href = basePath === '/' ? '/' : basePath
      }, 1500)
    })
    .catch(err => {
      document.body.innerHTML =
        `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:red;"><p>Authentication failed: ${err.message}</p></div>`
    })
}

if (callbackType) {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const error = urlParams.get('error')

  if (code) {
    if (window.opener) {
      localStorage.setItem(OAUTH_EVENT_KEY, JSON.stringify({ type: callbackType, ts: Date.now() }))
      // Send the code to the parent window
      window.opener.postMessage({ type: callbackType, code }, window.location.origin)
      // Close the popup
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>Authentication successful! You can close this window.</p></div>'
      setTimeout(() => window.close(), 1500)
    } else {
      // Fallback for tabs without window.opener: store code and redirect to main app
      localStorage.setItem(`${OAUTH_CODE_KEY_PREFIX}${callbackType}`, code)
      window.location.href = basePath === '/' ? '/' : basePath
    }
  } else if (error) {
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:red;"><p>Authentication failed: ${error}</p></div>`
    setTimeout(() => window.close(), 3000)
  }
}

// Fallback: handle OAuth code even if redirect path is not the expected callback.
if (!callbackType) {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const scope = urlParams.get('scope') || ''
  if (code) {
    if (scope.includes('gmail')) {
      callbackType = 'gmail-oauth-callback'
    } else if (scope.includes('calendar')) {
      callbackType = 'calendar-oauth-callback'
    }
  }
  if (callbackType && code) {
    localStorage.setItem(`${OAUTH_CODE_KEY_PREFIX}${callbackType}`, code)
    window.location.href = basePath === '/' ? '/' : basePath
  }
}

// Process any stored OAuth code on load (handles same-tab redirects).
const storedGmailCode = localStorage.getItem(`${OAUTH_CODE_KEY_PREFIX}gmail-oauth-callback`)
const storedCalendarCode = localStorage.getItem(`${OAUTH_CODE_KEY_PREFIX}calendar-oauth-callback`)
if (storedGmailCode) {
  localStorage.removeItem(`${OAUTH_CODE_KEY_PREFIX}gmail-oauth-callback`)
  finalizeOAuth('gmail-oauth-callback', storedGmailCode)
} else if (storedCalendarCode) {
  localStorage.removeItem(`${OAUTH_CODE_KEY_PREFIX}calendar-oauth-callback`)
  finalizeOAuth('calendar-oauth-callback', storedCalendarCode)
}

const queryClient = new QueryClient()

// Get Google Client ID from environment or use placeholder
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={basePath === '/' ? undefined : basePath}>
          <ToasterProvider>
            <Routes>
              {/* Public route for candidate response - no auth required */}
              <Route path="/candidate-response/:token" element={<CandidateResponsePage />} />
              {/* Public route for head person review - no auth required */}
              <Route path="/head-review/:token" element={<HeadPersonReviewPage />} />
              {/* All other routes go through the main app with auth */}
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
)
