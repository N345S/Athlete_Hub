import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { UNAUTHORIZED_EVENT, getTokenExpiry } from './lib/api.js'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { useToast } from './components/toast.jsx'
import LoginPage from './features/auth/LoginPage.jsx'
import { Loading } from './components/ui.jsx'

// Each role downloads only its own portal, which keeps the sign-in page fast.
const StudentPortal = lazy(() => import('./features/student/StudentPortal.jsx'))
const CoachPortal = lazy(() => import('./features/coach/CoachPortal.jsx'))
const DirectorPortal = lazy(() => import('./features/director/DirectorPortal.jsx'))
const RegistrarPortal = lazy(() => import('./features/registrar/RegistrarPortal.jsx'))
const AdminPortal = lazy(() => import('./features/admin/AdminPortal.jsx'))
const ParentPortal = lazy(() => import('./features/parent/ParentPortal.jsx'))

const SESSION_KEY = 'athletehub-session'
const EXPIRY_WARNING_MS = 5 * 60 * 1000

const PORTALS = {
  ATHLETE: StudentPortal,
  STUDENT: StudentPortal,
  COACH: CoachPortal,
  DIRECTOR: DirectorPortal,
  REGISTRAR: RegistrarPortal,
  ADMIN: AdminPortal,
  PARENT: ParentPortal,
}

function isExpired(session) {
  const expiry = getTokenExpiry(session?.token)
  return !expiry || expiry <= Date.now()
}

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY))
    return saved && !isExpired(saved) ? saved : null
  } catch {
    return null
  }
}

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [notice, setNotice] = useState('')
  const toast = useToast()

  const signOut = useCallback((message = '') => {
    localStorage.removeItem(SESSION_KEY)
    window.location.hash = ''
    setNotice(message)
    setSession(null)
  }, [])

  const signIn = (next) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    window.location.hash = ''
    setNotice('')
    setSession(next)
  }

  // Sign out when the token expires or the API rejects it.
  useEffect(() => {
    if (!session) return undefined
    const expired = () => signOut('Your session has expired. Please sign in again.')
    const expiry = getTokenExpiry(session.token)
    const timer = expiry ? setTimeout(expired, Math.max(expiry - Date.now(), 0)) : null
    // Warn a few minutes ahead so nobody loses a half-filled form to a silent sign-out.
    const warnIn = expiry ? expiry - Date.now() - EXPIRY_WARNING_MS : -1
    const warning = warnIn > 0 ? setTimeout(() => toast.warning('Your session ends in 5 minutes. Save your work, then sign in again to continue.'), warnIn) : null
    window.addEventListener(UNAUTHORIZED_EVENT, expired)
    return () => {
      clearTimeout(timer)
      clearTimeout(warning)
      window.removeEventListener(UNAUTHORIZED_EVENT, expired)
    }
  }, [session, signOut, toast])

  if (!session) return <LoginPage notice={notice} onSignedIn={signIn} />

  const Portal = PORTALS[String(session.role).toUpperCase()]
  if (!Portal) {
    return (
      <main className="login">
        <section className="login-form-panel">
          <div className="login-card">
            <h2>No portal for this role</h2>
            <p className="muted">You are signed in as {session.role}, which does not have a portal yet.</p>
            <button className="btn btn-primary btn-block" type="button" onClick={() => signOut()}>Back to sign in</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="app-loading"><Loading label="Opening your portal…" /></div>}>
        <Portal session={session} onLogout={() => signOut()} />
      </Suspense>
    </ErrorBoundary>
  )
}
