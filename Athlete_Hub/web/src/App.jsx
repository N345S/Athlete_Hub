import { useCallback, useEffect, useState } from 'react'
import { UNAUTHORIZED_EVENT, getTokenExpiry } from './lib/api.js'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import LoginPage from './features/auth/LoginPage.jsx'
import StudentPortal from './features/student/StudentPortal.jsx'
import CoachPortal from './features/coach/CoachPortal.jsx'
import DirectorPortal from './features/director/DirectorPortal.jsx'
import RegistrarPortal from './features/registrar/RegistrarPortal.jsx'
import AdminPortal from './features/admin/AdminPortal.jsx'

const SESSION_KEY = 'athletehub-session'

const PORTALS = {
  ATHLETE: StudentPortal,
  STUDENT: StudentPortal,
  COACH: CoachPortal,
  DIRECTOR: DirectorPortal,
  REGISTRAR: RegistrarPortal,
  ADMIN: AdminPortal,
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
    window.addEventListener(UNAUTHORIZED_EVENT, expired)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(UNAUTHORIZED_EVENT, expired)
    }
  }, [session, signOut])

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
      <Portal session={session} onLogout={() => signOut()} />
    </ErrorBoundary>
  )
}
