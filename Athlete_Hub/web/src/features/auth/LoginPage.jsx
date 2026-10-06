import { useState } from 'react'
import { api } from '../../lib/api.js'
import { Alert } from '../../components/ui.jsx'

export default function LoginPage({ notice, onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/api/Auth/login', { email: email.trim().toLowerCase(), password })
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
      setError(err.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <section className="login-brand">
        <div className="login-brand-header">
          <img src="/athletehub-logo.png" alt="" />
          <h1>Athlete-Hub</h1>
        </div>
        <p className="login-tagline">Centralized Digital Portfolio &amp; Monitoring System</p>
        <p className="login-copy">Track academic eligibility, training, and athletic achievements on one platform — built for Filipino student-athletes, coaches, and school staff.</p>
        <ul className="login-features">
          <li>Role-based portals</li>
          <li>Verified digital portfolios</li>
          <li>Registrar eligibility tracking</li>
        </ul>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={submit} noValidate>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your Athlete-Hub portal</p>
          <Alert tone="info">{notice}</Alert>
          <label className="field">
            <span className="field-label">Email address</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" autoComplete="email" required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <span className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <Alert>{error}</Alert>
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  )
}
