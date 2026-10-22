import { useState } from 'react'
import { api } from '../../lib/api.js'
import { Alert } from '../../components/ui.jsx'
import InstallApp from '../../components/InstallApp.jsx'

// Seeded accounts (see database/TEST_ACCOUNTS.md) offered as one-click sign-ins during development
// and user-testing sessions. Hidden in production builds unless VITE_SHOW_TEST_ACCOUNTS=true.
const SHOW_TEST_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_SHOW_TEST_ACCOUNTS === 'true'
const TEST_PASSWORD = 'Seed123!'
// Phones open the keyboard for an autofocused field, covering the page before people have read it.
const TOUCH_SCREEN = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const TEST_ACCOUNTS = [
  { role: 'Student-athlete', name: 'Juan Dela Cruz', email: 'juan.delacruz@seed.athletehub.test' },
  { role: 'Coach', name: 'Maria Santos', email: 'maria.santos@seed.athletehub.test' },
  { role: 'Sports Director', name: 'Elena Navarro', email: 'elena.navarro@seed.athletehub.test' },
  { role: 'Parent', name: 'Rosario Dela Cruz', email: 'rosario.delacruz@seed.athletehub.test' },
]

export default function LoginPage({ notice, onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState({})
  const [loading, setLoading] = useState(false)

  const signIn = async (credentials) => {
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/api/Auth/login', credentials)
      onSignedIn({
        email: data.email,
        role: String(data.role || '').toUpperCase(),
        token: data.token,
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        universityId: data.universityId,
      })
    } catch (err) {
      // Keep the server's account-status message (suspended, inactive); reword only the generic one.
      setError(err.message === 'Invalid email or password.' ? 'That email and password do not match. Check both and try again.' : err.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    const missing = { email: !email.trim(), password: !password }
    setInvalid(missing)
    if (missing.email || missing.password) {
      setError(missing.email && missing.password ? 'Enter your email and password.' : missing.email ? 'Enter your email address.' : 'Enter your password.')
      return
    }
    signIn({ email: email.trim().toLowerCase(), password })
  }

  const signInAsTestAccount = (account) => {
    setEmail(account.email)
    setPassword(TEST_PASSWORD)
    setInvalid({})
    signIn({ email: account.email, password: TEST_PASSWORD })
  }

  const checkCaps = (event) => setCapsLock(Boolean(event.getModifierState?.('CapsLock')))

  return (
    <main className="login">
      <section className="login-brand">
        <div className="login-brand-header">
          <img src="/athletehub-logo.png" alt="" />
          <h1>Athlete-Hub</h1>
        </div>
        <p className="login-tagline">Centralized Digital Portfolio &amp; Monitoring System</p>
        <p className="login-copy">Track grades, training, and athletic achievements on one platform — built for Filipino student-athletes, coaches, parents, and school staff.</p>
        <ul className="login-features">
          <li>Role-based portals</li>
          <li>Verified digital portfolios</li>
          <li>ICTD grade records</li>
          <li>Parent monitoring</li>
        </ul>
      </section>

      <section className="login-form-panel">
        <div className="login-column">
          <form className="login-card" onSubmit={submit} noValidate>
            <div>
              <h2>Welcome back</h2>
              <p className="muted">Sign in with the email and password from your athletics office.</p>
            </div>
            <Alert tone="info">{notice}</Alert>
            <label className="field">
              <span className="field-label">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setInvalid((current) => ({ ...current, email: false })) }}
                placeholder="you@university.edu"
                autoComplete="email"
                aria-invalid={invalid.email || undefined}
                required
                autoFocus={!TOUCH_SCREEN}
              />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setInvalid((current) => ({ ...current, password: false })) }}
                  onKeyUp={checkCaps}
                  onKeyDown={checkCaps}
                  autoComplete="current-password"
                  aria-invalid={invalid.password || undefined}
                  aria-describedby={capsLock ? 'caps-warning' : undefined}
                  required
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
              </span>
              {capsLock && <small className="field-warning" id="caps-warning">Caps Lock is on.</small>}
            </label>
            <Alert>{error}</Alert>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="link-button login-help-toggle" aria-expanded={showHelp} onClick={() => setShowHelp((value) => !value)}>
              Forgot your password or can't sign in?
            </button>
            {showHelp && (
              <div className="login-help">
                <p>Accounts and passwords are managed by the <strong>Sports Director</strong>. Contact the athletics office to reset your password or to reactivate a suspended account.</p>
                <p className="muted">Parents: your account is created by the athletics office and linked to your child's University ID.</p>
              </div>
            )}
          </form>

          <InstallApp className="btn btn-secondary btn-block install-app-button" />

          {SHOW_TEST_ACCOUNTS && (
            <section className="test-accounts" aria-labelledby="test-accounts-title">
              <div>
                <h3 id="test-accounts-title">Test accounts</h3>
                <p className="muted">For user testing only. Choose a role to sign in instantly with seeded sample data.</p>
              </div>
              <div className="test-account-grid">
                {TEST_ACCOUNTS.map((account) => (
                  <button key={account.email} type="button" className="test-account" onClick={() => signInAsTestAccount(account)} disabled={loading}>
                    <strong>{account.role}</strong>
                    <small>{account.name}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}
