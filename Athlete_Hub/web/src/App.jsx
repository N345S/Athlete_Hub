import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = 'http://localhost:5007'

function CoachAthletesPage({ dashboard }) {
  const [search, setSearch] = useState('')
  const athletes = (dashboard?.teams || []).flatMap((team) =>
    (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))
  )
  const filteredAthletes = athletes.filter((athlete) =>
    `${athlete.firstName} ${athlete.lastName} ${athlete.studentNumber} ${athlete.sport}`.toLowerCase().includes(search.toLowerCase())
  )

  return <section className="coach-athletes-page"><div className="coach-list-header"><div><h2>All Student-Athletes</h2><p>Showing {filteredAthletes.length} of {athletes.length} athletes under your supervision</p></div><span className="role-chip">{athletes.length} Total</span></div><div className="athlete-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search athletes by name, sport, or ID..." /></div><div className="athlete-cards">{filteredAthletes.length ? filteredAthletes.map((athlete) => <article className="athlete-card" key={`${athlete.teamName}-${athlete.athleteId}`}><div className="athlete-card-top"><div className="athlete-avatar">{(athlete.firstName || 'A').slice(0, 1)}{(athlete.lastName || 'A').slice(0, 1)}</div><div><strong>{athlete.firstName} {athlete.lastName}</strong><small>{athlete.studentNumber}</small><span>🏆 {athlete.sport}</span></div></div><div className="athlete-card-meta"><div><strong>—</strong><small>GPA</small></div><div><strong>—</strong><small>Attendance</small></div></div><div className="athlete-card-footer"><span>{athlete.teamName}</span><button type="button">View Profile</button></div></article>) : <div className="dashboard-state"><p className="empty-copy">No athletes are assigned to this coach yet.</p></div>}</div></section>
}

function CoachDashboard({ session, onLogout }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('dashboard')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/CoachDashboard`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.message || 'Unable to load coach dashboard.')
        setDashboard(data)
      } catch (err) {
        setError(err.message || 'Unable to load coach dashboard.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [session.token])

  const eligibleCount = dashboard?.eligibility?.find((item) =>
    String(item.status).toUpperCase().includes('ELIG')
  )?.count || 0
  const attentionCount = Math.max((dashboard?.athleteCount || 0) - eligibleCount, 0)
  const coachName = `${session.firstName || 'Coach'} ${session.lastName || ''}`.trim()

  return (
    <main className="coach-app">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/athletehub-logo.svg" alt="Athlete-Hub logo" />
          <div><h1>Athlete-Hub</h1><small>Monitoring System</small></div>
        </div>

        <div className="profile-block">
          <div className="avatar coach-avatar">{(session.firstName || 'C').slice(0, 1)}{(session.lastName || 'D').slice(0, 1)}</div>
          <div className="profile-meta"><strong>{coachName}</strong><span>Coach Director</span></div>
        </div>

        <nav className="main-nav" aria-label="Coach navigation">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={`nav-item ${view === 'athletes' ? 'active' : ''}`} type="button" onClick={() => setView('athletes')}>Athletes</button>
          <a className="nav-item" href="#">Schedule</a>
          <a className="nav-item" href="#">Performance</a>
          <a className="nav-item" href="#">Messages <span className="dot-badge">1</span></a>
          <a className="nav-item" href="#">Reports</a>
          <a className="nav-item" href="#">Profile</a>
        </nav>

        <div className="grade-scale">
          <small>PH GRADE SCALE</small>
          <div><span>1.00–1.25</span><strong>Excellent</strong></div>
          <div><span>1.50–1.75</span><strong>Very Good</strong></div>
          <div><span>2.00–2.25</span><strong>Good</strong></div>
          <div><span>2.50–3.00</span><strong>Passing</strong></div>
          <div><span>5.00</span><strong>Failed</strong></div>
        </div>
        <button className="logout-button" type="button" onClick={onLogout}>Logout</button>
      </aside>

      <div className="coach-content">
        <header className="topbar"><div className="crumbs"><span>Coach Portal</span><span className="sep">›</span><strong>{view === 'athletes' ? 'All Athletes' : 'Coach Dashboard'}</strong></div><span className="role-chip">Coach Director</span></header>
        {view === 'athletes' ? <CoachAthletesPage dashboard={dashboard} /> : <>
        <section className="coach-heading"><div><h2>Good morning, {session.firstName || 'Coach'}! <span>👋</span></h2><p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div><button className="coach-action" type="button">+ Add Schedule</button></section>

        {loading && <div className="dashboard-state">Loading coach data from the database...</div>}
        {error && <div className="dashboard-state error-message">{error}</div>}

        {!loading && !error && <>
          <section className="coach-stats-grid">
            <article className="coach-stat red-accent"><span>Total Athletes</span><strong>{dashboard?.athleteCount || 0}</strong><small>Under supervision</small></article>
            <article className="coach-stat blue-accent"><span>Avg GPA</span><strong>--</strong><small>Connect academic records</small></article>
            <article className="coach-stat green-accent"><span>Eligible</span><strong>{eligibleCount}</strong><small>GPA ≤ 3.00</small></article>
            <article className="coach-stat alert-accent"><span>Need Attention</span><strong>{attentionCount}</strong><small>At risk / ineligible</small></article>
          </section>

          <section className="eligibility-panel">
            <div className="section-title"><strong>⚠ Academic Eligibility Alerts</strong></div>
            {dashboard?.teams?.length ? dashboard.teams.map((team) => <div className="team-row" key={team.teamId}><div><strong>{team.teamName}</strong><small>{team.sport} · {team.athleteCount} athletes</small></div><span className="team-status">View team</span></div>) : <p className="empty-copy">No teams are assigned to this coach yet.</p>}
          </section>

          <section className="coach-lower-grid">
            <div className="coach-panel"><div className="panel-heading"><div><h3>Team Overview</h3><p>Your assigned teams from Athlete-Hub</p></div></div><div className="team-cards">{dashboard?.teams?.map((team) => <article className="team-card" key={team.teamId}><span>{team.sport}</span><strong>{team.teamName}</strong><small>{team.athleteCount} athletes under supervision</small></article>)}</div></div>
            <div className="coach-panel"><div className="panel-heading"><div><h3>Upcoming Sports Events</h3><p>Training sessions from the database</p></div></div><div className="session-list">{dashboard?.upcomingSessions?.length ? dashboard.upcomingSessions.slice(0, 4).map((sessionItem) => <div className="session-row" key={sessionItem.trainingSessionId}><strong>{sessionItem.title}</strong><small>{sessionItem.trainingDate} · {sessionItem.startTime}–{sessionItem.endTime}</small><span>{sessionItem.location || 'Location TBA'}</span></div>) : <p className="empty-copy">No upcoming training sessions.</p>}</div></div>
          </section>
        </>}
        </>}
      </div>
    </main>
  )
}

function StudentPortal({ session, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const firstName = session.firstName || 'Student'
  const fullName = `${firstName} ${session.lastName || 'Athlete'}`.trim()

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/AthleteProfile/me`, { headers: { Authorization: `Bearer ${session.token}` } })
        if (response.ok) setProfile(await response.json())
      } catch { /* dashboard still works with JWT name */ }
    }
    loadProfile()
  }, [session.token])

  useEffect(() => {
    const endpoints = {
      dashboard: profile?.athleteId ? `/api/AcademicRecords/dashboard/${profile.athleteId}` : null,
      grades: profile?.athleteId ? `/api/AcademicRecords/dashboard/${profile.athleteId}` : null,
      sports: '/api/Achievements/me',
      schedule: '/api/Training/sessions',
      documents: '/api/Documents/me',
      portfolio: '/api/Portfolio/me',
    }
    const endpoint = endpoints[page]
    if (!endpoint) return
    setLoading(true)
    setError('')
    fetch(`${API_BASE_URL}${endpoint}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.message || 'Unable to load this page.')
        setData(result)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, profile?.athleteId, session.token])

  const nav = [['dashboard', 'Dashboard'], ['grades', 'My Grades'], ['sports', 'My Sports'], ['schedule', 'Schedule'], ['documents', 'Documents'], ['portfolio', 'Portfolio'], ['profile', 'Profile'], ['notifications', 'Notifications']]
  const records = data?.records || (Array.isArray(data) ? data : [])

  const content = {
    dashboard: <><div className="notice-banner"><span className="alert-icon">⚠</span><p>Keep your academic records and athletic documents updated to maintain eligibility.</p><button type="button" onClick={() => setPage('notifications')}>View All</button></div><section className="page-header"><h2>Welcome back, {firstName}! <span>☀️</span></h2><p>Your student-athlete overview</p></section><section className="stats-grid"><article className="stat-card danger"><div className="stat-label">Current GPA</div><div className="stat-value">{data?.averageGrade || '—'}</div><small>Academic performance</small></article><article className="stat-card blue"><div className="stat-label">Enrolled Units</div><div className="stat-value">{data?.totalUnits || '—'}</div><small>From your academic records</small></article><article className="stat-card green"><div className="stat-label">Next Training</div><div className="stat-subtitle">{data?.[0]?.title || 'No upcoming session'}</div><small>{data?.[0]?.trainingDate || 'Check your schedule'}</small></article><article className="stat-card orange"><div className="stat-label">Achievements</div><div className="stat-value">{data?.length || '—'}</div><small>Verified athletic records</small></article></section></>,
    grades: <PageSection title="My Grades" subtitle="Academic performance records from the registrar"><div className="data-list">{loading ? <p>Loading records...</p> : records.length ? records.map((item) => <div className="data-row" key={item.academicRecordId}><strong>{item.subjectCode} · {item.subjectName}</strong><span>Grade: {item.grade ?? 'Pending'} · {item.units || 0} units</span></div>) : <p>No academic records found.</p>}</div></PageSection>,
    sports: <PageSection title="My Sports" subtitle="Your achievements and awards"><div className="data-list">{loading ? <p>Loading achievements...</p> : records.length ? records.map((item) => <div className="data-row" key={item.achievementId}><strong>{item.title}</strong><span>{item.category || 'Athletic achievement'} · {item.verificationStatus || 'Pending'}</span></div>) : <p>No achievements found.</p>}</div></PageSection>,
    schedule: <PageSection title="Schedule" subtitle="Your training sessions from Athlete-Hub"><div className="data-list">{loading ? <p>Loading schedule...</p> : records.length ? records.map((item) => <div className="data-row" key={item.trainingSessionId}><strong>{item.title}</strong><span>{item.trainingDate} · {item.location || 'Location TBA'}</span></div>) : <p>No upcoming training sessions.</p>}</div></PageSection>,
    documents: <PageSection title="Documents" subtitle="Upload and track your clearance documents"><div className="data-list">{loading ? <p>Loading documents...</p> : records.length ? records.map((item) => <div className="data-row" key={item.documentId}><strong>{item.documentName}</strong><span>{item.documentType} · {item.status}</span></div>) : <p>No documents uploaded yet.</p>}</div></PageSection>,
    portfolio: <PageSection title="Athletic Portfolio" subtitle={`Digital portfolio for ${fullName}`}><div className="data-list">{loading ? <p>Loading portfolio...</p> : records.length ? records.map((item) => <div className="data-row" key={item.portfolioItemId}><strong>{item.title}</strong><span>{item.description || 'Portfolio item'} · {item.isVisible ? 'Visible' : 'Hidden'}</span></div>) : <p>No portfolio items found.</p>}</div></PageSection>,
    profile: <PageSection title="Profile" subtitle="Your personal and academic information"><div className="profile-details"><div><span>Name</span><strong>{fullName}</strong></div><div><span>Email</span><strong>{session.email}</strong></div><div><span>Student ID</span><strong>{profile?.studentNumber || '—'}</strong></div><div><span>Program</span><strong>{profile?.course || '—'}</strong></div><div><span>Year Level</span><strong>{profile?.yearLevel || '—'}</strong></div><div><span>University</span><strong>{session.universityId || '—'}</strong></div></div></PageSection>,
    notifications: <PageSection title="Notifications" subtitle="Your alerts and important messages"><div className="data-list"><div className="data-row"><strong>Academic eligibility updates</strong><span>Review your latest grades and documents to stay eligible.</span></div><div className="data-row"><strong>Profile connected</strong><span>Your student account is authenticated with Athlete-Hub.</span></div></div></PageSection>,
  }[page]

  return <main className="student-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.svg" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><div className="profile-block"><div className="avatar">{firstName.slice(0, 1)}{(session.lastName || 'A').slice(0, 1)}</div><div className="profile-meta"><strong>{fullName}</strong><span>Student-Athlete</span></div></div><nav className="main-nav" aria-label="Student navigation">{nav.map(([key, label]) => <button className={`nav-item ${page === key ? 'active' : ''}`} key={key} type="button" onClick={() => { setPage(key); setData(null) }}>{label}{key === 'notifications' && <span className="dot-badge">3</span>}</button>)}</nav><div className="grade-scale"><small>PH GRADE SCALE</small><div><span>1.00–1.25</span><strong>Excellent</strong></div><div><span>1.50–1.75</span><strong>Very Good</strong></div><div><span>2.00–2.25</span><strong>Good</strong></div><div><span>2.50–3.00</span><strong>Passing</strong></div><div><span>5.00</span><strong>Failed</strong></div></div><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="content-panel"><header className="topbar"><div className="crumbs"><span>Athlete Portal</span><span className="sep">›</span><strong>{nav.find(([key]) => key === page)?.[1]}</strong></div></header>{error && <div className="dashboard-state error-message">{error}</div>}{content}</div></main>
}

function PageSection({ title, subtitle, children }) {
  return <section className="portal-page"><div className="page-header"><h2>{title}</h2><p>{subtitle}</p></div><div className="portal-panel">{children}</div></section>
}

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
  const isCoachRole = normalizedRole === 'COACH'

  if (session && isStudentRole) {
    return <StudentPortal session={session} onLogout={() => setSession(null)} />
  }

  return (
    <div className="athletehub-shell">
      {!session ? (
        <main className="login-shell">
          <section className="brand-panel">
            <div className="brand-header">
              <img className="brand-logo" src="/athletehub-logo.svg" alt="Athlete-Hub logo" />
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
      ) : isCoachRole ? (
        <CoachDashboard session={session} onLogout={() => setSession(null)} />
      ) : isStudentRole ? (
        <main className="student-app">
          <aside className="sidebar">
            <div className="brand-block">
              <img className="brand-logo" src="/athletehub-logo.svg" alt="Athlete-Hub logo" />
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
              <img className="brand-logo" src="/athletehub-logo.svg" alt="Athlete-Hub logo" />
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
