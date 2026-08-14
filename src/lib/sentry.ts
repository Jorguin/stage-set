import * as Sentry from '@sentry/react'
import { browserTracingIntegration } from '@sentry/browser'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [browserTracingIntegration()],
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
export const captureException = Sentry.captureException
export const captureMessage = Sentry.captureMessage
export const setUser = Sentry.setUser
export const addBreadcrumb = Sentry.addBreadcrumb