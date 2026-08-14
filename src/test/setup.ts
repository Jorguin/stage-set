import { vi, expect } from 'vitest'

// Add Vitest matchers similar to jest-dom
expect.extend({
  toBeInTheDocument(received) {
    const pass = received !== null && received !== undefined
    return {
      pass,
      message: () => pass
        ? 'Expected element not to be in the document'
        : 'Expected element to be in the document',
    }
  },
  toBeVisible(received) {
    if (!received) {
      return { pass: false, message: () => 'Expected element to be visible but received null/undefined' }
    }
    const style = window.getComputedStyle(received)
    const pass = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    return {
      pass,
      message: () => pass
        ? 'Expected element not to be visible'
        : 'Expected element to be visible',
    }
  },
})

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, ...props }: any) => {
    const a = document.createElement('a')
    Object.assign(a, props)
    a.textContent = String(children)
    return a
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  }),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    ...navigator,
    wakeLock: {
      request: vi.fn().mockResolvedValue({ release: vi.fn() }),
    },
  },
})

HTMLCanvasElement.prototype.getContext = vi.fn()
HTMLCanvasElement.prototype.toDataURL = vi.fn()

const originalError = console.error
console.error = (...args) => {
  if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) return
  originalError.call(console, ...args)
}