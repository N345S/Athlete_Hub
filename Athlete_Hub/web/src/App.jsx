import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = 'http://localhost:5007'

function App() {
  const [email, setEmail] = useState('testathlete@example.com')
  const [password, setPassword] = useState('Password123!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('athletehub-session')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    if (session) {
      localStorage.setItem('athletehub-session', JSON.stringify(session))
    } else {
      localStorage.removeItem('athletehub-session')
    }
  }, [session])

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Login failed.')
      }

      const normalizedRole = String(data.role || '').toUpperCase()
      const nextSession = {
        email: data.email,
        role: data.role,
        token: data.token,
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        universityId: data.universityId,
      }

      setSession(nextSession)

      if (normalizedRole === 'ATHLETE' || normalizedRole === 'STUDENT') {
        console.log('Student login -> student dashboard')
      } else {
        console.log('Non-student login -> other dashboard')
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  const normalizedRole = String(session?.role || '').toUpperCase()
  const isStudentRole = normalizedRole === 'ATHLETE' || normalizedRole === 'STUDENT'

  return (
    <div className="athletehub-shell">
      {!session ? (
        <main className="login-shell">
          <section className="brand-panel">
            <div className="brand-header">
              <div className="crest">AH</div>
              <h1>Athlete-Hub</h1>
            </div>
            <p className="tagline">Centralized Digital Portfolio & Monitoring System</p>
            <div className="hero-copy">
              Track academic and athletic performance on one platform — built for Filipino student-athletes, coaches, and administrators.
            </div>
            <div className="feature-pills">
              <span>Role-Based Access</span>
              <span>PH Grading System</span>
              <span>Digital Portfolio</span>
              <span>Eligibility Tracking</span>
            </div>
          </section>

          <section className="form-panel">
            <div className="login-card">
              <h2>Welcome back</h2>
              <p>Sign in to access your Athlete-Hub portal</p>

              <form onSubmit={handleLogin} noValidate>
                <div className="field-block">
                  <label htmlFor="email">Email Address</label>
                  <div className="input-wrap">
                    <span className="input-icon">✉</span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@university.edu"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="field-block">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrap">
                    <span className="input-icon">🔒</span>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                <div className="helper-row">
                  <span className="status-pill">Secure access portal</span>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button className="submit-button" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'} <span>→</span>
                </button>
              </form>
            </div>
          </section>
        </main>
      ) : isStudentRole ? (
        <main className="student-app">
          <aside className="sidebar">
            <div className="brand-block">
              <div className="brand-mark">AH</div>
              <div>
                <h1>Athlete-Hub</h1>
                <small>Monitoring System</small>
              </div>
            </div>

            <div className="profile-block">
              <div className="avatar">{(session.firstName || 'A').slice(0, 1)}{(session.lastName || 'S').slice(0, 1)}</div>
              <div className="profile-meta">
                <strong>{session.firstName || 'Student'} {session.lastName || 'Athlete'}</strong>
                <span>Student-Athlete</span>
              </div>
            </div>

            <nav className="main-nav" aria-label="Main navigation">
              <a className="nav-item active" href="#">Dashboard</a>
              <a className="nav-item" href="#">My Grades</a>
              <a className="nav-item" href="#">My Sports</a>
              <a className="nav-item" href="#">Schedule</a>
              <a className="nav-item" href="#">Documents</a>
              <a className="nav-item" href="#">Portfolio</a>
              <a className="nav-item" href="#">Profile</a>
              <a className="nav-item" href="#">Notifications <span className="dot-badge">3</span></a>
            </nav>

            <button className="logout-button" type="button" onClick={() => setSession(null)}>Logout</button>
          </aside>

          <div className="content-panel">
            <header className="topbar">
              <div className="crumbs">
                <span>Athlete Portal</span>
                <span className="sep">›</span>
                <strong>My Dashboard</strong>
              </div>
            </header>

            <div className="notice-banner">
              <span className="alert-icon">⚠</span>
              <p>NSTP102 Grade Alert: Your NSTP 2 grade is 3.00 (Passing) — the minimum passing grade. Stay on track to maintain eligibility.</p>
            </div>

            <section className="page-header">
              <h2>Welcome back, {session.firstName || 'Marcus'}! <span>☀️</span></h2>
              <p>Tuesday, September 1, 2026 • 2nd Semester 2024-2025</p>
            </section>

            <section className="stats-grid">
              <article className="stat-card danger">
                <div className="stat-label">Current GPA</div>
                <div className="stat-value">1.80</div>
                <div className="stat-meta"><span className="status-pill good">Eligible</span></div>
                <small>Good • Scale: 1.00-5.00</small>
              </article>

              <article className="stat-card blue">
                <div className="stat-label">Enrolled Units</div>
                <div className="stat-value">21</div>
                <div className="stat-meta">2nd Semester 2024-2025</div>
                <small>6 Subjects</small>
              </article>

              <article className="stat-card green">
                <div className="stat-label">Next Game</div>
                <div className="stat-subtitle">Basketball Practice</div>
                <div className="stat-meta">Apr 7, 4:00 PM – 6:00 PM</div>
                <button className="chip-button" type="button">University Gymnasium</button>
              </article>
            </section>
          </div>
        </main>
      ) : (
        <main className="login-shell">
          <section className="brand-panel">
            <div className="brand-header">
              <div className="crest">AH</div>
              <h1>Athlete-Hub</h1>
            </div>
            <p className="tagline">Role access portal</p>
            <div className="hero-copy">
              You are logged in as {session.role}. This role dashboard is in progress.
            </div>
            <button className="submit-button" type="button" onClick={() => setSession(null)}>
              Back to login
            </button>
          </section>
        </main>
      )}
    </div>
  )
}

export default App
