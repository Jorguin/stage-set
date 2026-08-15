import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { browserTracingIntegration, replayIntegration } from '@sentry/browser'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Polyfill for process (required by some dependencies like @ftes/chordsheetjs)
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  window.process = {
    env: { NODE_ENV: 'production' },
    version: 'v18.0.0',
    platform: 'browser',
    argv: [],
    cwd: () => '/',
    nextTick: (fn) => setTimeout(fn, 0),
    browser: true,
    stdin: null,
    stdout: null,
    stderr: null,
  };
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      browserTracingIntegration(),
      replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    beforeSend(event, hint) {
      if (hint.originalException instanceof Error && hint.originalException.message.includes('Non-Error promise rejection captured')) {
        return null
      }
      return event
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)