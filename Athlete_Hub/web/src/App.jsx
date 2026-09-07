import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = 'http://localhost:5007'

const DOCUMENT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024

function getExtension(fileName) {
  return `.${fileName.split('.').pop().toLowerCase()}`
}

function formatEventDate(dateValue) {
  if (!dateValue) return 'Date not set'
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEventTime(timeValue) {
  if (!timeValue) return 'Time TBA'
  const [hours, minutes] = String(timeValue).split(':')
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes))
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function CoachScheduleModal({ teams, session, onClose, onCreated }) {
  const [form, setForm] = useState({ teamId: teams[0]?.teamId || '', title: '', trainingDate: '', startTime: '', endTime: '', location: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.teamId || !form.title.trim() || !form.trainingDate) {
      setError('Team, title, and training date are required.')
      return
    }
    if (form.endTime && form.startTime && form.endTime <= form.startTime) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Training/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ ...form, teamId: Number(form.teamId), title: form.title.trim() }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to add training schedule.')
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title"><div className="modal-heading"><div><h2 id="schedule-modal-title">Add Training Schedule</h2><p>Create a session for one of your assigned teams.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><form className="schedule-form" onSubmit={handleSubmit}><label>Team<select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })} required><option value="">Select a team</option>{teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Team practice" required /></label><div className="form-grid"><label>Date<input type="date" value={form.trainingDate} onChange={(event) => setForm({ ...form, trainingDate: event.target.value })} required /></label><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Gymnasium" /></label><label>Start time<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label>End time<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="3" placeholder="Optional details for athletes" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !teams.length}>{saving ? 'Saving...' : 'Add Schedule'}</button></div></form></section></div>
}

function DocumentsPage({ records, loading, session, onRefresh }) {
  const [documentType, setDocumentType] = useState('Medical Clearance')
  const [stagedFiles, setStagedFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const addFiles = (fileList) => {
    const nextFiles = Array.from(fileList).map((file) => {
      const extension = getExtension(file.name)
      const validationError = !DOCUMENT_EXTENSIONS.includes(extension)
        ? 'Unsupported file type.'
        : file.size > MAX_DOCUMENT_SIZE ? 'File exceeds the 10 MB limit.' : ''
      return { id: `${file.name}-${file.lastModified}-${Math.random()}`, file, error: validationError }
    })
    setStagedFiles((current) => [...current, ...nextFiles])
    setError('')
  }

  const handleUpload = async () => {
    const validFiles = stagedFiles.filter((item) => !item.error)
    if (!validFiles.length) {
      setError('Add at least one valid document before uploading.')
      return
    }
    setUploading(true)
    setError('')
    setMessage('Uploading documents...')
    try {
      for (const item of validFiles) {
        const body = new FormData()
        body.append('documentType', documentType)
        body.append('file', item.file)
        const response = await fetch(`${API_BASE_URL}/api/Documents`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body })
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.message || `Unable to upload ${item.file.name}.`)
      }
      setStagedFiles([])
      setMessage('Documents uploaded and awaiting review.')
      onRefresh()
    } catch (err) {
      setError(err.message)
      setMessage('')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (documentId) => {
    if (!window.confirm('Delete this document?')) return
    const response = await fetch(`${API_BASE_URL}/api/Documents/${documentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } })
    if (!response.ok) {
      setError('Unable to delete this document.')
      return
    }
    onRefresh()
  }

  return <PageSection title="Documents" subtitle="Upload and track your clearance documents"><div className="document-toolbar"><label>Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option>Medical Clearance</option><option>Consent Form</option><option>Enrollment Form</option><option>Athletic Eligibility Form</option><option>Other</option></select></label></div><label className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}><input type="file" multiple accept={DOCUMENT_EXTENSIONS.join(',')} onChange={(event) => addFiles(event.target.files)} /><strong>Drop documents here or click to browse</strong><span>PDF, PNG, JPG, DOC, or DOCX up to 10 MB each</span></label>{stagedFiles.length > 0 && <div className="staged-files"><div className="panel-heading"><div><h3>Ready to upload</h3><p>Remove any file before submitting.</p></div><button className="primary-button" type="button" onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload files'}</button></div>{stagedFiles.map((item) => <div className={`staged-file ${item.error ? 'invalid' : ''}`} key={item.id}><div><strong>{item.file.name}</strong><span>{(item.file.size / 1024 / 1024).toFixed(2)} MB {item.error && `· ${item.error}`}</span></div><button className="text-button" type="button" onClick={() => setStagedFiles((current) => current.filter((file) => file.id !== item.id))}>Remove</button></div>)}</div>}{message && <p className="success-message">{message}</p>}{error && <p className="form-error">{error}</p>}<div className="data-list document-list">{loading ? <p>Loading documents...</p> : records.length ? records.map((item) => <div className="data-row document-row" key={item.documentId}><div><strong>{item.documentName}</strong><span>{item.documentType} · {item.status} · {new Date(item.uploadedAt).toLocaleDateString()}</span></div><div className="row-actions"><a href={`${API_BASE_URL}${item.fileUrl}`} target="_blank" rel="noreferrer">Open</a><button className="text-button danger-text" type="button" onClick={() => handleDelete(item.documentId)}>Delete</button></div></div>) : <p>No documents uploaded yet.</p>}</div></PageSection>
}

function CalendarPage({ records, loading, trainingOnly = false, title = 'Schedule', subtitle = 'Track your training, academic, competition, and other events' }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [view, setView] = useState('calendar')
  const eventTypes = trainingOnly ? ['TRAINING'] : ['TRAINING', 'COMPETITION', 'ACADEMIC', 'MEETING', 'OTHER']
  const [types, setTypes] = useState(eventTypes)
  const events = records.map((item) => ({ ...item, type: String(item.type || 'OTHER').toUpperCase() })).filter((item) => types.includes(item.type)).sort((a, b) => `${a.startDate} ${a.startTime || ''}`.localeCompare(`${b.startDate} ${b.startTime || ''}`))
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay.getDay() + daysInMonth) / 7) * 7 }, (_, index) => { const day = index - firstDay.getDay() + 1; return day > 0 && day <= daysInMonth ? day : null })
  const eventsForDay = (day) => events.filter((item) => item.startDate === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  const toggleType = (type) => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])

  return <PageSection title={title} subtitle={subtitle}><div className="calendar-controls"><div className="calendar-navigation"><button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button><strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button></div><div className="segmented-control"><button className={view === 'calendar' ? 'active' : ''} type="button" onClick={() => setView('calendar')}>Calendar</button><button className={view === 'list' ? 'active' : ''} type="button" onClick={() => setView('list')}>List</button></div></div><div className="event-filters">{eventTypes.map((type) => <button className={`filter-button ${types.includes(type) ? 'active' : ''} type-${type.toLowerCase()}`} type="button" key={type} onClick={() => toggleType(type)}>{type}</button>)}</div>{loading ? <p>Loading schedule...</p> : view === 'list' ? <div className="event-list">{events.length ? events.map((item) => <article className={`event-card type-${item.type.toLowerCase()}`} key={item.id}><strong>{item.title}</strong><span>{item.type} · {formatEventDate(item.startDate)} · {formatEventTime(item.startTime)}{item.endTime ? `–${formatEventTime(item.endTime)}` : ''}</span><small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small></article>) : <p>No events match the selected filters.</p>}</div> : <div className="calendar-grid"><div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <strong key={day}>{day}</strong>)}</div><div className="calendar-days">{cells.map((day, index) => <div className={`calendar-day ${day ? '' : 'blank'}`} key={`${day || 'blank'}-${index}`}>{day && <><span className="day-number">{day}</span>{eventsForDay(day).map((item) => <div className={`calendar-event type-${item.type.toLowerCase()}`} title={item.title} key={item.id}>{item.title}</div>)}</>}</div>)}</div></div>}</PageSection>
}

function CoachAthletesPage({ dashboard, onViewPortfolio }) {
  const [search, setSearch] = useState('')
  const athletes = (dashboard?.teams || []).flatMap((team) =>
    (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))
  )
  const filteredAthletes = athletes.filter((athlete) =>
    `${athlete.firstName} ${athlete.lastName} ${athlete.studentNumber} ${athlete.sport}`.toLowerCase().includes(search.toLowerCase())
  )

  return <section className="coach-athletes-page"><div className="coach-list-header"><div><h2>All Student-Athletes</h2><p>Showing {filteredAthletes.length} of {athletes.length} athletes under your supervision</p></div><span className="role-chip">{athletes.length} Total</span></div><div className="athlete-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search athletes by name, sport, or ID..." /></div><div className="athlete-cards">{filteredAthletes.length ? filteredAthletes.map((athlete) => <article className="athlete-card" key={`${athlete.teamName}-${athlete.athleteId}`}><div className="athlete-card-top"><div className="athlete-avatar">{(athlete.firstName || 'A').slice(0, 1)}{(athlete.lastName || 'A').slice(0, 1)}</div><div><strong>{athlete.firstName} {athlete.lastName}</strong><small>{athlete.studentNumber}</small><span>🏆 {athlete.sport || 'Athlete'}</span></div></div><div className="athlete-card-meta"><div><strong>—</strong><small>GPA</small></div><div><strong>—</strong><small>Attendance</small></div></div><div className="athlete-card-footer"><span>{athlete.teamName || 'No team assigned'}</span><div><button type="button">View Profile</button><button type="button" onClick={() => onViewPortfolio(athlete)}>View Portfolio</button></div></div></article>) : <div className="dashboard-state"><p className="empty-copy">No athletes are assigned to this coach yet.</p></div>}</div></section>
}

function StaffPortfolioPanel({ portfolio, loading, error, onClose, onReview }) {
  return <section className="coach-panel staff-portfolio-panel"><div className="panel-heading"><div><h2>{portfolio ? `${portfolio.firstName} ${portfolio.lastName}'s Portfolio` : 'Student Portfolio'}</h2><p>{portfolio?.studentNumber || 'Verified and pending achievement submissions'}</p></div><button className="schedule-more-button" type="button" onClick={onClose}>Close</button></div>{loading ? <p>Loading portfolio...</p> : error ? <p className="error-message">{error}</p> : portfolio?.items?.length ? <div className="data-list">{portfolio.items.map((item) => <div className="data-row" key={item.portfolioItemId}><strong>{item.title}</strong><span>{item.description || 'Portfolio submission'} · {item.achievementStatus || 'Pending'}</span>{item.evidence?.length ? <div className="evidence-links">{item.evidence.map((evidence) => <a href={`${API_BASE_URL}${evidence.fileUrl}`} target="_blank" rel="noreferrer" key={evidence.documentId}>View {evidence.documentName}</a>)}</div> : <small>No evidence attached</small>}{item.achievementStatus !== 'VERIFIED' && item.achievementId && <div className="review-actions"><button className="review-button approve" type="button" onClick={() => onReview(item, 'VERIFIED')}>Approve</button><button className="review-button reject" type="button" onClick={() => onReview(item, 'REJECTED')}>Reject</button></div>}</div>)}</div> : <p className="empty-copy">No portfolio submissions found.</p>}</section>
}

function PortfolioPage({ fullName, session, profile, records, loading, actionLoading, title, description, evidenceFiles, onTitleChange, onDescriptionChange, onFilesChange, onSubmit, onDelete }) {
  const verifiedCount = records.filter((item) => item.achievementStatus === 'VERIFIED').length
  const pendingCount = records.filter((item) => item.achievementStatus === 'PENDING').length
  const rejectedCount = records.filter((item) => item.achievementStatus === 'REJECTED').length
  const initials = `${(session.firstName || 'S').slice(0, 1)}${(session.lastName || 'A').slice(0, 1)}`

  return <section className="portfolio-page">
    <div className="portfolio-heading"><h2>Athletic Portfolio</h2><p>Comprehensive digital portfolio for {fullName}</p></div>
    <section className="portfolio-identity"><div className="portfolio-top"><div className="portfolio-avatar">{initials}</div><div className="portfolio-name-block"><h3>{fullName}</h3><p>{profile?.course || 'Student-Athlete'} · Athlete-Hub portfolio</p><div className="portfolio-meta-row"><span>{session.email}</span><span>{profile?.studentNumber || 'Student ID pending'}</span></div></div></div><div className="portfolio-info-grid"><div><span>Student ID</span><strong>{profile?.studentNumber || '—'}</strong></div><div><span>Academic Year</span><strong>{profile?.yearLevel || '—'}</strong></div><div><span>Program</span><strong>{profile?.course || '—'}</strong></div><div><span>University</span><strong>{session.universityId || '—'}</strong></div></div></section>
    <section className="portfolio-summary"><div className="summary-box"><span className="summary-icon gold">★</span><strong>{records.length}</strong><small>Total submissions</small></div><div className="summary-box"><span className="summary-icon green">✓</span><strong>{verifiedCount}</strong><small>Verified achievements</small></div><div className="summary-box"><span className="summary-icon purple">◷</span><strong>{pendingCount}</strong><small>Awaiting review</small></div><div className="summary-box"><span className="summary-icon pink">!</span><strong>{rejectedCount}</strong><small>Needs changes</small></div></section>
    <section className="portfolio-workspace"><div className="portfolio-section-heading"><div><h3>Achievements &amp; Awards</h3><p>Submit your accomplishments for coach verification.</p></div><span className="portfolio-count">{records.length} entries</span></div>
      <form className="portfolio-submit-form" onSubmit={onSubmit}><div><label htmlFor="achievement-title">Achievement title</label><input id="achievement-title" value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="e.g. Regional Basketball Championship" required /></div><div><label htmlFor="achievement-description">Description or evidence notes</label><textarea id="achievement-description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Describe the achievement and supporting evidence" rows="3" /></div><div><label htmlFor="achievement-evidence">Evidence files</label><div className="file-picker"><input id="achievement-evidence" className="file-picker-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" multiple onChange={(event) => onFilesChange(Array.from(event.target.files || []))} /><label className="add-file-button" htmlFor="achievement-evidence"><span aria-hidden="true">+</span> Add files</label><small>{evidenceFiles.length ? `${evidenceFiles.length} file(s) selected` : 'Attach photos, certificates, or supporting files.'}</small></div></div><button type="submit" disabled={actionLoading}>{actionLoading ? 'Submitting...' : 'Submit for approval'}</button></form>
      <div className="portfolio-achievements">{loading ? <p>Loading portfolio...</p> : records.length ? records.map((item) => <article className="portfolio-achievement" key={item.portfolioItemId}><div className="achievement-mark">★</div><div className="achievement-copy"><div className="achievement-title-row"><h4>{item.title}</h4><span className={`achievement-status ${String(item.achievementStatus || 'PENDING').toLowerCase()}`}>{item.achievementStatus || 'PENDING'}</span></div><p>{item.description || 'Portfolio submission awaiting review.'}</p>{item.evidence?.length ? <div className="evidence-links">{item.evidence.map((evidence) => <a href={`${API_BASE_URL}${evidence.fileUrl}`} target="_blank" rel="noreferrer" key={evidence.documentId}>{evidence.documentName}</a>)}</div> : null}<small>{item.achievementDate ? formatEventDate(item.achievementDate) : 'Date not provided'}</small></div>{item.achievementStatus !== 'VERIFIED' && <button className="achievement-delete" type="button" disabled={actionLoading} onClick={() => onDelete(item)}>Delete</button>}</article>) : <p className="empty-copy">No portfolio submissions yet. Add your first achievement above.</p>}</div>
    </section>
  </section>
}

function CoachDashboard({ session, onLogout }) {
  const [dashboard, setDashboard] = useState(null)
  const [scheduleRecords, setScheduleRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [error, setError] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [view, setView] = useState('dashboard')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [portfolio, setPortfolio] = useState(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState('')

  const viewPortfolio = async (athlete) => {
    setPortfolioLoading(true)
    setPortfolioError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Portfolio/athlete/${athlete.athleteId}`, { headers: { Authorization: `Bearer ${session.token}` } })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to load portfolio.')
      setPortfolio(result)
    } catch (err) {
      setPortfolioError(err.message || 'Unable to load portfolio.')
    } finally {
      setPortfolioLoading(false)
    }
  }

  const reviewAchievement = async (item, status) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/Achievements/${item.achievementId}/verify?status=${status}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.token}` },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to review achievement.')
      setPortfolio((current) => {
        if (!current) return current
        const items = status === 'REJECTED'
          ? current.items.filter((entry) => entry.achievementId !== item.achievementId)
          : current.items.map((entry) => entry.achievementId === item.achievementId ? { ...entry, achievementStatus: result.verificationStatus } : entry)
        return { ...current, items }
      })
    } catch (err) {
      setPortfolioError(err.message || 'Unable to review achievement.')
    }
  }

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
  }, [session.token, refreshKey])

  useEffect(() => {
    const loadSchedule = async () => {
      setScheduleLoading(true)
      setScheduleError('')
      try {
        const from = new Date()
        const to = new Date(from)
        to.setDate(to.getDate() + 14)
        const formatQueryDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const query = view === 'schedule' ? '' : `?from=${formatQueryDate(from)}&to=${formatQueryDate(to)}`
        const response = await fetch(`${API_BASE_URL}/api/Training/sessions${query}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result?.message || 'Unable to load schedule.')
        setScheduleRecords(result.map((item) => ({
          id: `training-${item.trainingSessionId}`,
          type: 'TRAINING',
          title: item.title,
          description: item.description,
          startDate: item.trainingDate,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
          teamName: item.teamName,
        })))
      } catch (err) {
        setScheduleError(err.message || 'Unable to load schedule.')
      } finally {
        setScheduleLoading(false)
      }
    }

    loadSchedule()
  }, [session.token, view, refreshKey])

  const eligibleCount = dashboard?.eligibility?.find((item) =>
    String(item.status).toUpperCase().includes('ELIG')
  )?.count || 0
  const attentionCount = Math.max((dashboard?.athleteCount || 0) - eligibleCount, 0)
  const coachName = `${session.firstName || 'Coach'} ${session.lastName || ''}`.trim()
  const upcomingScheduleRecords = scheduleRecords

  return (
    <main className="coach-app">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" />
          <div><h1>Athlete-Hub</h1><small>Monitoring System</small></div>
        </div>

        <div className="profile-block">
          <div className="avatar coach-avatar">{(session.firstName || 'C').slice(0, 1)}{(session.lastName || 'D').slice(0, 1)}</div>
          <div className="profile-meta"><strong>{coachName}</strong><span>Coach</span></div>
        </div>

        <nav className="main-nav" aria-label="Coach navigation">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={`nav-item ${view === 'athletes' ? 'active' : ''}`} type="button" onClick={() => setView('athletes')}>Athletes</button>
          <button className={`nav-item ${view === 'schedule' ? 'active' : ''}`} type="button" onClick={() => setView('schedule')}>Schedule</button>
          <a className="nav-item" href="#">Performance</a>
          <a className="nav-item" href="#">Messages <span className="dot-badge">1</span></a>
          <a className="nav-item" href="#">Reports</a>
          <a className="nav-item" href="#">Profile</a>
        </nav>

        <button className="logout-button" type="button" onClick={onLogout}>Logout</button>
      </aside>

      <div className="coach-content">
        <header className="topbar"><div className="crumbs"><span>{String(session.role).toUpperCase() === 'DIRECTOR' ? 'Director Portal' : 'Coach Portal'}</span><span className="sep">›</span><strong>{view === 'athletes' ? 'All Athletes' : view === 'schedule' ? 'Schedule' : 'Coach Dashboard'}</strong></div><span className="role-chip">{session.role}</span></header>
        {view === 'athletes' ? <><CoachAthletesPage dashboard={dashboard} onViewPortfolio={viewPortfolio} />{(portfolio || portfolioLoading || portfolioError) && <StaffPortfolioPanel portfolio={portfolio} loading={portfolioLoading} error={portfolioError} onReview={reviewAchievement} onClose={() => { setPortfolio(null); setPortfolioError('') }} />}</> : view === 'schedule' ? <div className="coach-schedule-page"><section className="coach-heading"><div><h2>Schedule</h2><p>Full training schedule for your assigned teams</p></div><button className="coach-action" type="button" onClick={() => setShowScheduleModal(true)}>+ Add Training Schedule</button></section>{scheduleError && <div className="dashboard-state error-message">{scheduleError}</div>}<CalendarPage records={scheduleRecords} loading={scheduleLoading} trainingOnly title="Schedule" subtitle="Use calendar or list view to track every training session" /></div> : <>
        <section className="coach-heading"><div><h2>Good morning, {session.firstName || 'Coach'}! <span>👋</span></h2><p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div><button className="coach-action" type="button" onClick={() => setShowScheduleModal(true)}>+ Add Training Schedule</button></section>

        {loading && <div className="dashboard-state">Loading coach data from the database...</div>}
        {error && <div className="dashboard-state error-message">{error}</div>}

        {!loading && !error && <>
          <section className="coach-stats-grid">
            <article className="coach-stat red-accent"><span>Total Athletes</span><strong>{dashboard?.athleteCount || 0}</strong><small>Under supervision</small></article>
            <article className="coach-stat green-accent"><span>Eligible</span><strong>{eligibleCount}</strong><small>GPA ≤ 3.00</small></article>
            <article className="coach-stat alert-accent"><span>Need Attention</span><strong>{attentionCount}</strong><small>At risk / ineligible</small></article>
          </section>

          <section className="eligibility-panel">
            <div className="section-title"><strong>⚠ Academic Eligibility Alerts</strong></div>
            {dashboard?.teams?.length ? dashboard.teams.map((team) => <div className="team-row" key={team.teamId}><div><strong>{team.teamName}</strong><small>{team.sport} · {team.athleteCount} athletes</small></div><span className="team-status">View team</span></div>) : <p className="empty-copy">No teams are assigned to this coach yet.</p>}
          </section>

          <section className="coach-panel upcoming-schedules-panel">
            <div className="panel-heading schedule-panel-heading"><div><h3>Upcoming Schedules</h3><p>Upcoming schedule in the next two weeks</p></div><button className="schedule-more-button" type="button" onClick={() => setView('schedule')} aria-label="See full schedule">See more <span aria-hidden="true">→</span></button></div>
            <div className="session-list">{upcomingScheduleRecords.length ? upcomingScheduleRecords.map((sessionItem) => <div className="session-row" key={sessionItem.id}><strong>{sessionItem.title}</strong><small>{formatEventDate(sessionItem.startDate)} · {formatEventTime(sessionItem.startTime)}{sessionItem.endTime ? `–${formatEventTime(sessionItem.endTime)}` : ''}</small><span>{sessionItem.location || 'Location TBA'}</span></div>) : <p className="empty-copy">No upcoming training schedules in the next two weeks.</p>}</div>
          </section>

          <section className="coach-lower-grid">
            <div className="coach-panel"><div className="panel-heading"><div><h3>Team Overview</h3><p>Your assigned teams from Athlete-Hub</p></div></div><div className="team-cards">{dashboard?.teams?.map((team) => <article className="team-card" key={team.teamId}><span>{team.sport}</span><strong>{team.teamName}</strong><small>{team.athleteCount} athletes under supervision</small></article>)}</div></div>
          </section>
        </>}
        </>}
      </div>
      {showScheduleModal && <CoachScheduleModal teams={dashboard?.teams || []} session={session} onClose={() => setShowScheduleModal(false)} onCreated={() => { setShowScheduleModal(false); setRefreshKey((value) => value + 1) }} />}
    </main>
  )
}

function StudentPortal({ session, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [achievementTitle, setAchievementTitle] = useState('')
  const [achievementDescription, setAchievementDescription] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [portfolioActionLoading, setPortfolioActionLoading] = useState(false)
  const firstName = session.firstName || 'Student'
  const fullName = `${firstName} ${session.lastName || 'Athlete'}`.trim()

  const addAchievementToPortfolio = async (event) => {
    event.preventDefault()
    if (!evidenceFiles.length) {
      setError('Add at least one evidence file before submitting this achievement.')
      return
    }
    setPortfolioActionLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }
      const achievementResponse = await fetch(`${API_BASE_URL}/api/Achievements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: achievementTitle, description: achievementDescription }),
      })
      const achievement = await achievementResponse.json().catch(() => null)
      if (!achievementResponse.ok) throw new Error(achievement?.message || 'Unable to submit achievement.')
      for (const file of evidenceFiles) {
        const evidenceBody = new FormData()
        evidenceBody.append('documentType', 'Achievement Evidence')
        evidenceBody.append('achievementId', achievement.achievementId)
        evidenceBody.append('file', file)
        const evidenceResponse = await fetch(`${API_BASE_URL}/api/Documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
          body: evidenceBody,
        })
        const evidenceResult = await evidenceResponse.json().catch(() => null)
        if (!evidenceResponse.ok) throw new Error(evidenceResult?.message || `Unable to upload ${file.name}.`)
      }
      const portfolioResponse = await fetch(`${API_BASE_URL}/api/Portfolio`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ achievementId: achievement.achievementId, title: achievement.title, description: achievement.description }),
      })
      const portfolioResult = await portfolioResponse.json().catch(() => null)
      if (!portfolioResponse.ok) throw new Error(portfolioResult?.message || 'Unable to add achievement to portfolio.')
      setAchievementTitle('')
      setAchievementDescription('')
      setEvidenceFiles([])
      setData(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err.message || 'Unable to submit achievement.')
    } finally {
      setPortfolioActionLoading(false)
    }
  }

  const deletePortfolioAchievement = async (item) => {
    setPortfolioActionLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${session.token}` }
      const response = await fetch(`${API_BASE_URL}/api/Portfolio/${item.portfolioItemId}`, { method: 'DELETE', headers })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to remove portfolio submission.')
      if (item.achievementId) {
        const achievementResponse = await fetch(`${API_BASE_URL}/api/Achievements/${item.achievementId}`, { method: 'DELETE', headers })
        if (!achievementResponse.ok && achievementResponse.status !== 404) {
          const achievementResult = await achievementResponse.json().catch(() => null)
          throw new Error(achievementResult?.message || 'Portfolio removed, but achievement cleanup failed.')
        }
      }
      setData(null)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err.message || 'Unable to remove portfolio submission.')
    } finally {
      setPortfolioActionLoading(false)
    }
  }

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
      schedule: '/api/Schedules/athlete',
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
  }, [page, profile?.athleteId, session.token, refreshKey])

  const nav = [['dashboard', 'Dashboard'], ['grades', 'My Grades'], ['schedule', 'Schedule'], ['documents', 'Documents'], ['portfolio', 'Portfolio'], ['profile', 'Profile'], ['notifications', 'Notifications']]
  const records = data?.records || (Array.isArray(data) ? data : [])

  const content = {
    dashboard: <><div className="notice-banner"><span className="alert-icon">⚠</span><p>Keep your academic records and athletic documents updated to maintain eligibility.</p><button type="button" onClick={() => setPage('notifications')}>View All</button></div><section className="page-header"><h2>Welcome back, {firstName}! <span>☀️</span></h2><p>Your student-athlete overview</p></section><section className="stats-grid"><article className="stat-card danger"><div className="stat-label">Current GPA</div><div className="stat-value">{data?.averageGrade || '—'}</div><small>Academic performance</small></article><article className="stat-card blue"><div className="stat-label">Enrolled Units</div><div className="stat-value">{data?.totalUnits || '—'}</div><small>From your academic records</small></article><article className="stat-card green"><div className="stat-label">Next Training</div><div className="stat-subtitle">{data?.[0]?.title || 'No upcoming session'}</div><small>{data?.[0]?.trainingDate || 'Check your schedule'}</small></article><article className="stat-card orange"><div className="stat-label">Achievements</div><div className="stat-value">{data?.length || '—'}</div><small>Verified athletic records</small></article></section></>,
    grades: <PageSection title="My Grades" subtitle="Academic performance records from the registrar"><div className="data-list">{loading ? <p>Loading records...</p> : records.length ? records.map((item) => <div className="data-row" key={item.academicRecordId}><strong>{item.subjectCode} · {item.subjectName}</strong><span>Grade: {item.grade ?? 'Pending'} · {item.units || 0} units</span></div>) : <p>No academic records found.</p>}</div></PageSection>,
    schedule: <CalendarPage records={records} loading={loading} />,
    documents: <DocumentsPage records={records} loading={loading} session={session} onRefresh={() => { setData(null); setRefreshKey((value) => value + 1) }} />,
    portfolio: <PortfolioPage fullName={fullName} session={session} profile={profile} records={records} loading={loading} actionLoading={portfolioActionLoading} title={achievementTitle} description={achievementDescription} evidenceFiles={evidenceFiles} onTitleChange={setAchievementTitle} onDescriptionChange={setAchievementDescription} onFilesChange={setEvidenceFiles} onSubmit={addAchievementToPortfolio} onDelete={deletePortfolioAchievement} />,
    profile: <PageSection title="Profile" subtitle="Your personal and academic information"><div className="profile-details"><div><span>Name</span><strong>{fullName}</strong></div><div><span>Email</span><strong>{session.email}</strong></div><div><span>Student ID</span><strong>{profile?.studentNumber || '—'}</strong></div><div><span>Program</span><strong>{profile?.course || '—'}</strong></div><div><span>Year Level</span><strong>{profile?.yearLevel || '—'}</strong></div><div><span>University</span><strong>{session.universityId || '—'}</strong></div></div></PageSection>,
    notifications: <PageSection title="Notifications" subtitle="Your alerts and important messages"><div className="data-list"><div className="data-row"><strong>Academic eligibility updates</strong><span>Review your latest grades and documents to stay eligible.</span></div><div className="data-row"><strong>Profile connected</strong><span>Your student account is authenticated with Athlete-Hub.</span></div></div></PageSection>,
  }[page]

  return <main className="student-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><div className="profile-block"><div className="avatar">{firstName.slice(0, 1)}{(session.lastName || 'A').slice(0, 1)}</div><div className="profile-meta"><strong>{fullName}</strong><span>Student-Athlete</span></div></div><nav className="main-nav" aria-label="Student navigation">{nav.map(([key, label]) => <button className={`nav-item ${page === key ? 'active' : ''}`} key={key} type="button" onClick={() => { setPage(key); setData(null) }}>{label}{key === 'notifications' && <span className="dot-badge">3</span>}</button>)}</nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="content-panel"><header className="topbar"><div className="crumbs"><span>Athlete Portal</span><span className="sep">›</span><strong>{nav.find(([key]) => key === page)?.[1]}</strong></div></header>{error && <div className="dashboard-state error-message">{error}</div>}{content}</div></main>
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
  const isStaffRole = normalizedRole === 'COACH' || normalizedRole === 'DIRECTOR'

  if (session && isStudentRole) {
    return <StudentPortal session={session} onLogout={() => setSession(null)} />
  }

  return (
    <div className="athletehub-shell">
      {!session ? (
        <main className="login-shell">
          <section className="brand-panel">
            <div className="brand-header">
              <img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" />
              <h1>Athlete-Hub</h1>
            </div>
            <p className="tagline">Centralized Digital Portfolio & Monitoring System</p>
            <div className="hero-copy">
              Track academic and athletic performance on one platform — built for Filipino student-athletes, coaches, and administrators.
            </div>
            <div className="feature-pills">
              <span>Role-Based Access</span>
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
      ) : isStaffRole ? (
        <CoachDashboard session={session} onLogout={() => setSession(null)} />
      ) : isStudentRole ? (
        <main className="student-app">
          <aside className="sidebar">
            <div className="brand-block">
              <img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" />
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
              <img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" />
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
