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
  const [form, setForm] = useState({ teamId: teams[0]?.teamId || '', title: '', trainingDates: [], pendingDate: '', startTime: '', endTime: '', location: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addDate = () => {
    if (!form.pendingDate) return
    setForm((current) => ({
      ...current,
      trainingDates: current.trainingDates.includes(form.pendingDate) ? current.trainingDates : [...current.trainingDates, form.pendingDate].sort(),
      pendingDate: '',
    }))
  }

  const removeDate = (date) => setForm((current) => ({ ...current, trainingDates: current.trainingDates.filter((item) => item !== date) }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.teamId || !form.title.trim() || form.trainingDates.length === 0) {
      setError('Team, title, and at least one training date are required.')
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
        body: JSON.stringify({ ...form, teamId: Number(form.teamId), title: form.title.trim(), trainingDates: form.trainingDates }),
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

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title"><div className="modal-heading"><div><h2 id="schedule-modal-title">Add Training Schedule</h2><p>Create a session for one of your assigned teams.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><form className="schedule-form" onSubmit={handleSubmit}><label>Team<select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })} required><option value="">Select a team</option>{teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Team practice" required /></label><div className="form-grid"><label>Dates<div className="date-picker-row"><input type="date" value={form.pendingDate} onChange={(event) => setForm({ ...form, pendingDate: event.target.value })} /><button className="secondary-button" type="button" onClick={addDate}>Add date</button></div>{form.trainingDates.length > 0 && <div className="date-chip-list">{form.trainingDates.map((date) => <span className="date-chip" key={date}>{formatEventDate(date)}<button type="button" onClick={() => removeDate(date)} aria-label={`Remove ${date}`}>×</button></span>)}</div>}</label><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Gymnasium" /></label><label>Start time<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label>End time<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="3" placeholder="Optional details for athletes" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !teams.length}>{saving ? 'Saving...' : 'Add Schedule'}</button></div></form></section></div>
}

function DirectorScheduleModal({ session, onClose, onCreated }) {
  const [form, setForm] = useState({ scheduleType: 'SPORTS_EVENT', title: '', dates: [], pendingDate: '', startTime: '', endTime: '', location: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addDate = () => {
    if (!form.pendingDate) return
    setForm((current) => ({
      ...current,
      dates: current.dates.includes(form.pendingDate) ? current.dates : [...current.dates, form.pendingDate].sort(),
      pendingDate: '',
    }))
  }

  const removeDate = (date) => setForm((current) => ({ ...current, dates: current.dates.filter((item) => item !== date) }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || form.dates.length === 0 || !form.startTime) {
      setError('Event title, at least one date, and start time are required.')
      return
    }
    if (form.endTime && form.endTime <= form.startTime) {
      setError('End time must be after the start time.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ ...form, title: form.title.trim(), dates: form.dates, endTime: form.endTime || null }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to add event.')
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="director-schedule-modal-title"><div className="modal-heading"><div><h2 id="director-schedule-modal-title">Add Sports Event</h2><p>Create an athlete-related event for teams and athletes.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><form className="schedule-form" onSubmit={handleSubmit}><label>Event type<select value={form.scheduleType} onChange={(event) => setForm({ ...form, scheduleType: event.target.value })}><option value="SPORTS_EVENT">Sports event</option></select></label><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Regional athletics meet" required /></label><div className="form-grid"><label>Dates<div className="date-picker-row"><input type="date" value={form.pendingDate} onChange={(event) => setForm({ ...form, pendingDate: event.target.value })} /><button className="secondary-button" type="button" onClick={addDate}>Add date</button></div>{form.dates.length > 0 && <div className="date-chip-list">{form.dates.map((date) => <span className="date-chip" key={date}>{formatEventDate(date)}<button type="button" onClick={() => removeDate(date)} aria-label={`Remove ${date}`}>×</button></span>)}</div>}</label><label>Start time<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></label><label>End time<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Athletics stadium" /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="3" placeholder="Optional event details" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add event'}</button></div></form></section></div>
}

function DirectorTrainingReviewPanel({ sessions, session, onReviewed }) {
  const [reviewingId, setReviewingId] = useState(null)
  const [error, setError] = useState('')

  const review = async (trainingSessionId, status) => {
    const rejectionReason = status === 'REJECTED' ? window.prompt('Reason for rejecting this training session:') || '' : ''
    setReviewingId(trainingSessionId)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Training/sessions/${trainingSessionId}/review?status=${status}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ rejectionReason }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to review training session.')
      onReviewed()
    } catch (err) {
      setError(err.message)
    } finally {
      setReviewingId(null)
    }
  }

  return <section className="coach-panel training-review-panel"><div className="panel-heading"><div><h3>Training approvals</h3><p>Review coach-submitted sessions before they are published to athletes.</p></div><span className="role-chip">{sessions.length} Pending</span></div>{error && <p className="form-error">{error}</p>}{sessions.length ? <div className="data-list">{sessions.map((item) => <div className="data-row training-review-row" key={item.trainingSessionId}><div><strong>{item.title}</strong><span>{item.teamName} · {item.sport} · Coach: {item.coachName}</span><small>{formatEventDate(item.trainingDate)} · {formatEventTime(item.startTime)}{item.endTime ? `–${formatEventTime(item.endTime)}` : ''} · {item.location || 'Location TBA'}</small>{item.description && <small>{item.description}</small>}</div><div className="review-actions"><button className="review-button approve" type="button" disabled={reviewingId === item.trainingSessionId} onClick={() => review(item.trainingSessionId, 'APPROVED')}>Approve</button><button className="review-button reject" type="button" disabled={reviewingId === item.trainingSessionId} onClick={() => review(item.trainingSessionId, 'REJECTED')}>Reject</button></div></div>)}</div> : <p className="empty-copy">No training sessions are waiting for approval.</p>}</section>
}

function DocumentsPage({ records, loading, session, onRefresh }) {
  const [documentType, setDocumentType] = useState('Medical Clearance')
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentDescription, setDocumentDescription] = useState('')
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
      const body = new FormData()
      body.append('documentType', documentType)
      body.append('title', documentTitle)
      body.append('description', documentDescription)
      validFiles.forEach((item) => body.append('files', item.file))
      const response = await fetch(`${API_BASE_URL}/api/Documents`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to upload documents.')
      setStagedFiles([])
      setDocumentTitle('')
      setDocumentDescription('')
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

  return <PageSection title="Documents" subtitle="Upload and track your clearance documents"><div className="document-toolbar"><label>Title<input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="e.g. PRISAA 2027 requirements" /></label><label>Description<textarea value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} rows="2" placeholder="What are these documents for?" /></label><label>Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option>Medical Clearance</option><option>Consent Form</option><option>Enrollment Form</option><option>Athletic Eligibility Form</option><option>Other</option></select></label></div><label className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}><input type="file" multiple accept={DOCUMENT_EXTENSIONS.join(',')} onChange={(event) => addFiles(event.target.files)} /><strong>Drop documents here or click to browse</strong><span>PDF, PNG, JPG, DOC, or DOCX up to 10 MB each</span></label>{stagedFiles.length > 0 && <div className="staged-files"><div className="panel-heading"><div><h3>Ready to upload</h3><p>Remove any file before submitting.</p></div><button className="primary-button" type="button" onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload files'}</button></div>{stagedFiles.map((item) => <div className={`staged-file ${item.error ? 'invalid' : ''}`} key={item.id}><div><strong>{item.file.name}</strong><span>{(item.file.size / 1024 / 1024).toFixed(2)} MB {item.error && `· ${item.error}`}</span></div><button className="text-button" type="button" onClick={() => setStagedFiles((current) => current.filter((file) => file.id !== item.id))}>Remove</button></div>)}</div>}{message && <p className="success-message">{message}</p>}{error && <p className="form-error">{error}</p>}<div className="data-list document-list">{loading ? <p>Loading documents...</p> : records.length ? records.map((item) => <div className="data-row document-row" key={item.documentId}><div><strong>{item.title || item.documentName}</strong><span>{item.documentType} · {item.status} · {new Date(item.uploadedAt).toLocaleDateString()}</span>{item.description && <small>{item.description}</small>}{item.title && item.documentName !== item.title && <small>File: {item.documentName}</small>}</div><div className="row-actions"><a href={`${API_BASE_URL}${item.fileUrl}`} target="_blank" rel="noreferrer">Open</a><button className="text-button danger-text" type="button" onClick={() => handleDelete(item.documentId)}>Delete</button></div></div>) : <p>No documents uploaded yet.</p>}</div></PageSection>
}

function CalendarPage({ records, loading, trainingOnly = false, title = null, subtitle = null }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [view, setView] = useState('calendar')
  const eventTypes = trainingOnly ? ['TRAINING'] : ['TRAINING', 'SPORTS_EVENT', 'COMPETITION']
  const [types, setTypes] = useState(eventTypes)
  const events = records.map((item) => ({ ...item, type: String(item.type || 'OTHER').toUpperCase() })).filter((item) => types.includes(item.type)).sort((a, b) => `${a.startDate} ${a.startTime || ''}`.localeCompare(`${b.startDate} ${b.startTime || ''}`))
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay.getDay() + daysInMonth) / 7) * 7 }, (_, index) => { const day = index - firstDay.getDay() + 1; return day > 0 && day <= daysInMonth ? day : null })
  const eventsForDay = (day) => events.filter((item) => item.startDate === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  const toggleType = (type) => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  const [selectedEvent, setSelectedEvent] = useState(null)

  const eventTimeLabel = (item) => {
    const start = formatEventTime(item.startTime)
    const end = item.endTime ? `–${formatEventTime(item.endTime)}` : ''
    return `${start}${end}`
  }

  const calendarContent = <><div className="calendar-controls"><div className="calendar-navigation"><button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button><strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button></div><div className="segmented-control"><button className={view === 'calendar' ? 'active' : ''} type="button" onClick={() => setView('calendar')}>Calendar</button><button className={view === 'list' ? 'active' : ''} type="button" onClick={() => setView('list')}>List</button></div></div><div className="event-filters">{eventTypes.map((type) => <button className={`filter-button ${types.includes(type) ? 'active' : ''} type-${type.toLowerCase()}`} type="button" key={type} onClick={() => toggleType(type)}>{type.replace('_', ' ')}</button>)}</div>{loading ? <p>Loading schedule...</p> : view === 'list' ? <div className="event-list">{events.length ? events.map((item) => <article className={`event-card type-${item.type.toLowerCase()}`} key={item.id} onClick={() => setSelectedEvent(item)} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && setSelectedEvent(item)}><strong>{item.title}</strong><span>{item.type.replace('_', ' ')} · {formatEventDate(item.startDate)} · {formatEventTime(item.startTime)}{item.endTime ? `–${formatEventTime(item.endTime)}` : ''}</span><small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small></article>) : <p>No events match the selected filters.</p>}</div> : <div className="calendar-grid"><div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <strong key={day}>{day}</strong>)}</div><div className="calendar-days">{cells.map((day, index) => <div className={`calendar-day ${day ? '' : 'blank'}`} key={`${day || 'blank'}-${index}`}>{day && <><span className="day-number">{day}</span>{eventsForDay(day).map((item) => <div className={`calendar-event type-${item.type.toLowerCase()}`} title={item.title} key={item.id} onClick={() => setSelectedEvent(item)} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && setSelectedEvent(item)}><span className="calendar-event-time">{eventTimeLabel(item)}</span> {item.title}</div>)}</>}</div>)}</div></div>}</>
  return <>{title ? <PageSection title={title} subtitle={subtitle}>{calendarContent}</PageSection> : calendarContent}{selectedEvent && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedEvent(null)}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="event-detail-title"><div className="modal-heading"><div><h2 id="event-detail-title">{selectedEvent.title}</h2><p>{selectedEvent.type.replace('_', ' ')}</p></div><button className="icon-button" type="button" onClick={() => setSelectedEvent(null)} aria-label="Close">×</button></div><div className="event-detail-body"><div className="event-detail-row"><span>Date</span><strong>{formatEventDate(selectedEvent.startDate)}</strong></div><div className="event-detail-row"><span>Time</span><strong>{eventTimeLabel(selectedEvent)}</strong></div>{selectedEvent.location && <div className="event-detail-row"><span>Location</span><strong>{selectedEvent.location}</strong></div>}{selectedEvent.teamName && <div className="event-detail-row"><span>Team</span><strong>{selectedEvent.teamName}</strong></div>}{selectedEvent.description && <div className="event-detail-row"><span>Description</span><strong>{selectedEvent.description}</strong></div>}</div><div className="modal-actions"><button className="primary-button" type="button" onClick={() => setSelectedEvent(null)}>Close</button></div></section></div>}</>
}

function CoachAthletesPage({ dashboard, onViewProfile, athletesOverride, observer = false }) {
  const [search, setSearch] = useState('')
  const assignedAthletes = (dashboard?.teams || []).flatMap((team) =>
    (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))
  )
  const athletes = athletesOverride || assignedAthletes
  const filteredAthletes = athletes.filter((athlete) =>
    `${athlete.firstName} ${athlete.lastName} ${athlete.studentNumber} ${athlete.sport}`.toLowerCase().includes(search.toLowerCase())
  )

  return <section className="coach-athletes-page"><div className="coach-list-header"><div><h2>{observer ? 'All Athletes' : 'All Student-Athletes'}</h2><p>Showing {filteredAthletes.length} of {athletes.length} {observer ? 'athletes available for observation' : 'athletes under your supervision'}</p></div><span className="role-chip">{athletes.length} Total</span></div><div className="athlete-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search athletes by name, sport, or ID..." /></div><div className="athlete-cards">{filteredAthletes.length ? filteredAthletes.map((athlete) => <article className="athlete-card" key={`${athlete.teamName || 'unassigned'}-${athlete.athleteId}`}><div className="athlete-card-top"><div className="athlete-avatar">{(athlete.firstName || 'A').slice(0, 1)}{(athlete.lastName || 'A').slice(0, 1)}</div><div><strong>{athlete.firstName} {athlete.lastName}</strong><small>{athlete.studentNumber}</small><span>🏆 {athlete.sport || 'Athlete'}</span></div></div><div className="athlete-card-meta"><div><strong>—</strong><small>GPA</small></div><div><strong>—</strong><small>Attendance</small></div></div><div className="athlete-card-footer"><span>{athlete.teamName || 'No team assigned'}</span><div><button type="button" onClick={() => onViewProfile(athlete)}>View Profile</button></div></div></article>) : <div className="dashboard-state"><p className="empty-copy">No athletes found.</p></div>}</div></section>
}

function AthleteProfilePage({ athlete, portfolio, loading, error, canReview, onBack, onReview }) {
  return <section className="athlete-profile-page"><button className="schedule-more-button" type="button" onClick={onBack}>← Back to athletes</button><section className="athlete-profile-hero"><div className="portfolio-avatar">{(athlete?.firstName || 'A').slice(0, 1)}{(athlete?.lastName || 'A').slice(0, 1)}</div><div><h2>{athlete?.firstName} {athlete?.lastName}</h2><p>{athlete?.studentNumber || 'Student ID pending'} · {athlete?.sport || 'Athlete'}</p></div></section><section className="athlete-profile-details"><div><span>Program</span><strong>{athlete?.course || '—'}</strong></div><div><span>Year level</span><strong>{athlete?.yearLevel || '—'}</strong></div><div><span>Team</span><strong>{athlete?.teamName || 'No team assigned'}</strong></div><div><span>Sport</span><strong>{athlete?.sport || '—'}</strong></div></section><section className="coach-panel profile-portfolio-section"><div className="panel-heading"><div><h3>Complete portfolio</h3><p>Achievements, descriptions, statuses, dates, and evidence.</p></div></div>{loading ? <p>Loading portfolio...</p> : error ? <p className="error-message">{error}</p> : portfolio?.items?.length ? <div className="data-list">{portfolio.items.map((item) => <article className="data-row" key={item.portfolioItemId}><strong>{item.title}</strong><span>{item.description || 'No description provided.'}</span><small>{item.achievementStatus || 'Pending'} · {item.achievementDate ? formatEventDate(item.achievementDate) : 'Date not provided'}</small>{item.evidence?.length ? <div className="evidence-links">{item.evidence.map((evidence) => <a href={`${API_BASE_URL}${evidence.fileUrl}`} target="_blank" rel="noreferrer" key={evidence.documentId}>{evidence.documentName}</a>)}</div> : <small>No evidence attached</small>}{canReview && item.achievementStatus !== 'VERIFIED' && item.achievementId && <div className="review-actions"><button className="review-button approve" type="button" onClick={() => onReview(item, 'VERIFIED')}>Approve</button><button className="review-button reject" type="button" onClick={() => onReview(item, 'REJECTED')}>Reject</button></div>}</article>)}</div> : <p className="empty-copy">No portfolio submissions found.</p>}</section></section>
}

function PerformancePage({ athletes, session, canEdit }) {
  const [metrics, setMetrics] = useState([])
  const [selectedAthleteId, setSelectedAthleteId] = useState(athletes[0]?.athleteId || '')
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState([])
  const [form, setForm] = useState({ metricId: '', recordedValue: '', recordedDate: new Date().toISOString().slice(0, 10), notes: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/Performance/metrics`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => [])
        if (!response.ok) throw new Error(result?.message || 'Unable to load performance metrics.')
        setMetrics(result)
        setForm((current) => ({ ...current, metricId: current.metricId || String(result[0]?.metricId || '') }))
      })
      .catch((err) => setError(err.message))
  }, [session.token])

  useEffect(() => {
    if (!selectedAthleteId) {
      setRecords([])
      return
    }
    setLoading(true)
    fetch(`${API_BASE_URL}/api/Performance/athlete/${selectedAthleteId}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.message || 'Unable to load performance records.')
        setRecords(result.records || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedAthleteId, session.token])

  const addRecord = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Performance/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ ...form, athleteId: Number(selectedAthleteId), metricId: Number(form.metricId), recordedValue: Number(form.recordedValue) }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to save performance record.')
      setForm((current) => ({ ...current, recordedValue: '', notes: '' }))
      setSelectedAthleteId(String(selectedAthleteId))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredAthletes = athletes.filter((athlete) => `${athlete.firstName} ${athlete.lastName} ${athlete.studentNumber} ${athlete.sport || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="performance-page"><div className="coach-heading"><div><h2>Performance</h2><p>{canEdit ? 'Select an athlete to record performance results.' : 'Select an athlete to view performance results.'}</p></div></div>{error && <div className="dashboard-state error-message">{error}</div>}<div className="performance-toolbar"><label>Search athletes<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, sport, or ID..." /></label><div className="performance-athlete-cards">{filteredAthletes.length ? filteredAthletes.map((athlete) => <button className={`performance-athlete-card ${String(selectedAthleteId) === String(athlete.athleteId) ? 'selected' : ''}`} type="button" key={athlete.athleteId} onClick={() => setSelectedAthleteId(String(athlete.athleteId))}><span className="athlete-avatar">{(athlete.firstName || 'A').slice(0, 1)}{(athlete.lastName || 'A').slice(0, 1)}</span><strong>{athlete.firstName} {athlete.lastName}</strong><small>{athlete.studentNumber} · {athlete.sport || 'Athlete'}</small></button>) : <p className="empty-copy">No athletes found.</p>}</div></div>{canEdit && selectedAthleteId && <form className="performance-entry-form" onSubmit={addRecord}><label>Metric<select value={form.metricId} onChange={(event) => setForm({ ...form, metricId: event.target.value })} required><option value="">Select metric</option>{metrics.map((metric) => <option key={metric.metricId} value={metric.metricId}>{metric.metricName} ({metric.unit || 'value'})</option>)}</select></label><label>Value<input type="number" min="0" step="0.01" value={form.recordedValue} onChange={(event) => setForm({ ...form, recordedValue: event.target.value })} required /></label><label>Date<input type="date" value={form.recordedDate} onChange={(event) => setForm({ ...form, recordedDate: event.target.value })} required /></label><label>Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional observation" /></label><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add performance'}</button></form>}{loading ? <p>Loading performance records...</p> : selectedAthleteId ? <div className="data-list performance-record-list">{records.length ? records.map((record) => <div className="data-row" key={record.performanceRecordId}><strong>{record.metric.metricName}: {record.recordedValue} {record.metric.unit || ''}</strong><span>{record.recordedDate} · {record.notes || 'No notes'}</span></div>) : <p>No performance records found.</p>}</div> : <p className="empty-copy">Select an athlete to view performance.</p>}</section>
}

function GradeEntryPage({ students, session }) {
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [form, setForm] = useState({ academicYear: '', semester: '', subjectCode: '', subjectName: '', units: '', grade: '', remarks: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const filteredStudents = students.filter((student) => `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.course || ''}`.toLowerCase().includes(search.toLowerCase()))
  const gradeLabel = (grade) => grade == null ? 'Pending' : grade <= 1.25 ? 'Excellent' : grade <= 1.75 ? 'Very Good' : grade <= 2.25 ? 'Good' : grade <= 3 ? 'Passing' : 'Failed'

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!form.academicYear.trim() || !form.semester.trim() || !form.subjectCode.trim() || !form.subjectName.trim()) {
      setError('Academic year, semester, subject code, and subject name are required.')
      return
    }
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/GradeEvaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          athleteId: selectedStudent.athleteId,
          academicYear: form.academicYear.trim(),
          semester: form.semester.trim(),
          records: [{
            subjectCode: form.subjectCode.trim(),
            subjectName: form.subjectName.trim(),
            units: form.units ? Number(form.units) : null,
            grade: form.grade ? Number(form.grade) : null,
            remarks: form.remarks.trim() || null,
          }],
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to upload grade.')
      setMessage('Grade uploaded successfully.')
      setForm({ academicYear: '', semester: '', subjectCode: '', subjectName: '', units: '', grade: '', remarks: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (selectedStudent) {
    return <section className="grade-entry-page"><div className="registrar-heading"><div><h2>Grade Entry</h2><p>Encode and review student grades using the Philippine Grading System</p></div></div><button className="schedule-more-button" type="button" onClick={() => setSelectedStudent(null)}>← Back to students</button><section className="athlete-profile-hero"><div className="portfolio-avatar">{(selectedStudent.firstName || 'A').slice(0, 1)}{(selectedStudent.lastName || 'A').slice(0, 1)}</div><div><h2>{selectedStudent.firstName} {selectedStudent.lastName}</h2><p>{selectedStudent.studentNumber || 'Student ID pending'} · {selectedStudent.course || 'Program not set'} · Year {selectedStudent.yearLevel || '—'}</p></div></section><section className="coach-panel"><div className="panel-heading"><div><h3>Grade Entries</h3><p>Academic records for this student</p></div><span className="role-chip">{selectedStudent.records?.length || 0} Records</span></div>{selectedStudent.records?.length ? <div className="data-list">{selectedStudent.records.map((record) => <div className="data-row" key={record.academicRecordId}><strong>{record.subjectCode} · {record.subjectName}</strong><span>Grade: {record.grade ?? 'Pending'} · {record.units || 0} units</span><small>{gradeLabel(record.grade)}</small></div>)}</div> : <p className="empty-copy">No academic records encoded yet.</p>}</section><section className="coach-panel"><div className="panel-heading"><div><h3>Upload Grade</h3><p>Add a new grade entry for this student</p></div></div>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}<form className="portfolio-submit-form" onSubmit={handleUpload}><div><label htmlFor="grade-academic-year">Academic year</label><input id="grade-academic-year" value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} placeholder="e.g. 2025-2026" required /></div><div><label htmlFor="grade-semester">Semester</label><input id="grade-semester" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} placeholder="e.g. 1st Semester" required /></div><div><label htmlFor="grade-subject-code">Subject code</label><input id="grade-subject-code" value={form.subjectCode} onChange={(event) => setForm({ ...form, subjectCode: event.target.value })} placeholder="e.g. MATH 101" required /></div><div><label htmlFor="grade-subject-name">Subject name</label><input id="grade-subject-name" value={form.subjectName} onChange={(event) => setForm({ ...form, subjectName: event.target.value })} placeholder="e.g. College Algebra" required /></div><div className="form-grid"><div><label htmlFor="grade-units">Units</label><input id="grade-units" type="number" min="0" step="0.5" value={form.units} onChange={(event) => setForm({ ...form, units: event.target.value })} placeholder="3" /></div><div><label htmlFor="grade-value">Grade (1.00–5.00)</label><input id="grade-value" type="number" min="1" max="5" step="0.25" value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} placeholder="1.75" /></div></div><div><label htmlFor="grade-remarks">Remarks</label><input id="grade-remarks" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Optional remarks" /></div><button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Grade'}</button></form></section></section>
  }

  return <section className="grade-entry-page"><div className="registrar-heading"><div><h2>Grade Entry</h2><p>Encode and review student grades using the Philippine Grading System</p></div></div><div className="grade-entry-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, student ID, or program..." /><button type="button" onClick={() => setSearch('')}>Clear</button></div><div className="athlete-cards">{filteredStudents.length ? filteredStudents.map((student) => <article className="athlete-card" key={student.athleteId}><div className="athlete-card-top"><div className="athlete-avatar">{(student.firstName || 'A').slice(0, 1)}{(student.lastName || 'A').slice(0, 1)}</div><div><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber}</small><span>🎓 {student.course || 'Program not set'}</span></div></div><div className="athlete-card-meta"><div><strong>{student.averageGrade ?? '—'}</strong><small>GWA</small></div><div><strong>{student.records?.length || 0}</strong><small>Entries</small></div></div><div className="athlete-card-footer"><span className={student.eligibilityStatus === 'ELIGIBLE' ? 'eligible-label' : 'attention-label'}>{student.eligibilityStatus}</span><div><button type="button" onClick={() => setSelectedStudent(student)}>View Entries</button></div></div></article>) : <div className="dashboard-state"><p className="empty-copy">No students match your search.</p></div>}</div></section>
}

function AcademicRecordsPage({ students }) {
  const [search, setSearch] = useState('')
  const filteredStudents = students.filter((student) => `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.course || ''}`.toLowerCase().includes(search.toLowerCase()))

  return <section className="academic-records-page"><div className="registrar-heading"><div><h2>Academic Records</h2><p>Upload academic records and update GWA</p></div></div><section className="academic-upload-panel"><span className="upload-icon">⇧</span><strong>Upload Academic Records</strong><small>Supports PDF, Excel (.xlsx), or CSV files. Max 10MB per file.</small><div><button className="coach-action" type="button">⇧ Upload Batch Grades</button><button className="template-button" type="button">Download Template</button></div></section><section className="gwa-panel"><div className="panel-heading"><div><h3>Update GWA (General Weighted Average)</h3><p>Review each student’s latest academic average from the database.</p></div></div><div className="academic-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, ID, or program..." /><button type="button" onClick={() => setSearch('')}>Clear</button></div><div className="gwa-grid">{filteredStudents.length ? filteredStudents.map((student) => <article className="gwa-card" key={student.athleteId}><div><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber} · {student.course || 'Program not set'}</small></div><b>{student.averageGrade ?? '—'}</b><select defaultValue={student.averageGrade ?? ''} aria-label={`GWA for ${student.firstName} ${student.lastName}`}><option value="">Select GWA</option><option value="1.00">1.00 – Excellent</option><option value="1.25">1.25 – Excellent</option><option value="1.50">1.50 – Very Good</option><option value="1.75">1.75 – Very Good</option><option value="2.00">2.00 – Good</option><option value="2.25">2.25 – Good</option><option value="2.50">2.50 – Passing</option><option value="3.00">3.00 – Passing</option><option value="5.00">5.00 – Failed</option></select><button className="save-gwa-button" type="button" aria-label={`Save GWA for ${student.firstName} ${student.lastName}`}>▣</button></article>) : <p className="empty-copy">No students match your search.</p>}</div></section></section>
}

function EligibilityPage({ students }) {
  const eligibleStudents = students.filter((student) => student.eligibilityStatus === 'ELIGIBLE')
  const attentionStudents = students.filter((student) => student.eligibilityStatus !== 'ELIGIBLE')
  const personRow = (student, eligible) => <div className={`eligibility-student-row ${eligible ? 'eligible-row' : 'attention-row'}`} key={student.athleteId}><div><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber} · {student.course || 'Program not set'}</small></div><span>{student.averageGrade ?? '—'}</span><em>{eligible ? '✓ Eligible' : '⚠ At Risk'}</em><button type="button">{eligible ? 'Issue Clearance' : 'Edit Grades'}</button></div>

  return <section className="eligibility-page"><div className="registrar-heading"><div><h2>Eligibility Verification</h2><p>Verify athletic eligibility based on academic standing</p></div><button className="template-button" type="button">⟳ Refresh Status</button></div><div className="eligibility-rule"><strong>ⓘ Eligibility Rule:</strong> A student-athlete is eligible if their GPA is <b>3.00 or below</b> and they have <b>no failing grades (5.00)</b> in the current semester.</div><section className="eligibility-group eligible-group"><h3>✓ Eligible Athletes ({eligibleStudents.length})</h3>{eligibleStudents.length ? eligibleStudents.map((student) => personRow(student, true)) : <p className="empty-copy">No eligible athletes found.</p>}</section><section className="eligibility-group attention-group"><h3>⚠ At Risk ({attentionStudents.length}) — GPA 2.75–3.00</h3>{attentionStudents.length ? attentionStudents.map((student) => personRow(student, false)) : <p className="empty-copy">No students currently need attention.</p>}</section></section>
}

function RegistrarDashboard({ session, onLogout }) {
  const [dashboard, setDashboard] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/RegistrarDashboard`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.message || 'Unable to load registrar dashboard.')
        setDashboard(result)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session.token])

  const students = (dashboard?.students || []).filter((student) => `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.course || ''}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const navButtons = Array.from(document.querySelectorAll('.registrar-app .nav-item'))
    const gradeEntryButton = navButtons.find((button) => button.textContent.trim() === 'Grade Entry')
    const academicRecordsButton = navButtons.find((button) => button.textContent.trim() === 'Academic Records')
    const eligibilityButton = navButtons.find((button) => button.textContent.trim() === 'Eligibility')
    if (!gradeEntryButton && !academicRecordsButton && !eligibilityButton) return undefined
    const handleGradeEntryClick = () => setView('grades')
    const handleAcademicRecordsClick = () => setView('academic-records')
    const handleEligibilityClick = () => setView('eligibility')
    gradeEntryButton?.addEventListener('click', handleGradeEntryClick)
    academicRecordsButton?.addEventListener('click', handleAcademicRecordsClick)
    eligibilityButton?.addEventListener('click', handleEligibilityClick)
    return () => {
      gradeEntryButton?.removeEventListener('click', handleGradeEntryClick)
      academicRecordsButton?.removeEventListener('click', handleAcademicRecordsClick)
      eligibilityButton?.removeEventListener('click', handleEligibilityClick)
    }
  }, [dashboard, view])

  if (view === 'grades' && dashboard) {
    return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Dashboard</button><button className="nav-item active" type="button">Grade Entry</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Academic Records</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Eligibility</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Reports</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Grade Entry</strong></div><span className="role-chip">Registrar</span></header><GradeEntryPage students={dashboard.students || []} /></div></main>
  }

  if (view === 'academic-records' && dashboard) {
    return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Dashboard</button><button className="nav-item" type="button" onClick={() => setView('grades')}>Grade Entry</button><button className="nav-item active" type="button">Academic Records</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Eligibility</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Reports</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Academic Records</strong></div><span className="role-chip">Registrar</span></header><AcademicRecordsPage students={dashboard.students || []} /></div></main>
  }

  if (view === 'eligibility' && dashboard) {
    return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Dashboard</button><button className="nav-item" type="button" onClick={() => setView('grades')}>Grade Entry</button><button className="nav-item" type="button" onClick={() => setView('academic-records')}>Academic Records</button><button className="nav-item active" type="button">Eligibility</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Reports</button><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Eligibility Verification</strong></div><span className="role-chip">Registrar</span></header><EligibilityPage students={dashboard.students || []} /></div></main>
  }

  return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><div className="profile-block"><div className="avatar">{(session.firstName || 'R').slice(0, 1)}{(session.lastName || 'G').slice(0, 1)}</div><div className="profile-meta"><strong>{session.firstName} {session.lastName}</strong><span>Registrar</span></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item active" type="button">Dashboard</button><button className="nav-item" type="button">Grade Entry</button><button className="nav-item" type="button">Academic Records</button><button className="nav-item" type="button">Eligibility</button><button className="nav-item" type="button">Reports</button><button className="nav-item" type="button">Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Registrar Dashboard</strong></div><span className="role-chip">Registrar</span></header><section className="registrar-heading"><div><h2>Academic Records Overview</h2><p>Philippine Grading System (1.00–5.00) · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div><button className="coach-action" type="button">Encode Grades</button></section>{loading && <div className="dashboard-state">Loading academic records from the database...</div>}{error && <div className="dashboard-state error-message">{error}</div>}{!loading && !error && <><section className="registrar-stats"><article className="registrar-stat red-accent"><span>Total Students</span><strong>{dashboard.totalStudents}</strong><small>Registered athletes</small></article><article className="registrar-stat purple-accent"><span>Avg GPA</span><strong>{dashboard.averageGpa ?? '—'}</strong><small>Overall average</small></article><article className="registrar-stat green-accent"><span>Eligible</span><strong>{dashboard.eligibleCount}</strong><small>GPA ≤ 3.00</small></article><article className="registrar-stat orange-accent"><span>Need Attention</span><strong>{dashboard.attentionCount}</strong><small>At risk / ineligible</small></article></section><section className="grading-reference"><strong>ⓘ Philippine Grading System — Registrar Reference</strong><div><span>1.00–1.25 = Excellent</span><span>1.50–1.75 = Very Good</span><span>2.00–2.25 = Good</span><span>2.50–3.00 = Passing</span><span>5.00 = Failed</span></div></section><section className="registrar-alerts"><div className="section-title"><strong>⚠ Academic Alerts — Students Needing Attention</strong></div>{dashboard.attentionStudents.length ? dashboard.attentionStudents.map((student) => <div className="registrar-student-row" key={student.athleteId}><div><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber} · {student.course || 'Program not set'}</small></div><span>{student.averageGrade ?? '—'}</span><em>{student.eligibilityStatus}</em><button type="button">Edit Grades</button></div>) : <p className="empty-copy">No students currently need attention.</p>}</section><section className="registrar-panel"><div className="panel-heading"><div><h3>All Academic Records</h3><p>Student records loaded from Athlete-Hub database</p></div><span className="role-chip">{students.length} shown</span></div><input className="registrar-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students by name, course, or ID..." /><div className="registrar-table">{students.map((student) => <div className="registrar-table-row" key={student.athleteId}><strong>{student.firstName} {student.lastName}</strong><span>{student.studentNumber}</span><span>{student.course || '—'}</span><span>{student.averageGrade ?? '—'}</span><span className={student.eligibilityStatus === 'ELIGIBLE' ? 'eligible-label' : 'attention-label'}>{student.eligibilityStatus}</span></div>)}</div></section></>}</div></main>
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
  const [showDirectorScheduleModal, setShowDirectorScheduleModal] = useState(false)
  const [pendingTrainingSessions, setPendingTrainingSessions] = useState([])
  const [pendingTrainingError, setPendingTrainingError] = useState('')
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const isDirector = String(session.role).toUpperCase() === 'DIRECTOR'
  const directorAthletes = (dashboard?.athletes || []).flatMap((athlete) => athlete.teams?.length
    ? athlete.teams.map((team) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))
    : [{ ...athlete }])

  const viewProfile = async (athlete) => {
    setSelectedAthlete(athlete)
    setPortfolio(null)
    setPortfolioError('')
    setPortfolioLoading(true)
    setView('profile')
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
        const response = await fetch(`${API_BASE_URL}/api/${isDirector ? 'DirectorDashboard' : 'CoachDashboard'}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.message || 'Unable to load coach dashboard.')
        setDashboard(data)
      } catch (err) {
        setError(err.message || `Unable to load ${isDirector ? 'director' : 'coach'} dashboard.`)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [session.token, refreshKey, isDirector])

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
        const response = await fetch(`${API_BASE_URL}/api/Schedules/staff${query}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result?.message || 'Unable to load schedule.')
        setScheduleRecords(result.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          description: item.description,
          startDate: item.startDate,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
          teamName: item.teamName,
          approvalStatus: item.approvalStatus,
          rejectionReason: item.rejectionReason,
        })))
      } catch (err) {
        setScheduleError(err.message || 'Unable to load schedule.')
      } finally {
        setScheduleLoading(false)
      }
    }

    loadSchedule()
  }, [session.token, view, refreshKey, isDirector])

  useEffect(() => {
    if (!isDirector) return
    const loadPendingTraining = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/Training/pending`, { headers: { Authorization: `Bearer ${session.token}` } })
        const result = await response.json().catch(() => [])
        if (!response.ok) throw new Error(result?.message || 'Unable to load training approvals.')
        setPendingTrainingSessions(result)
      } catch (err) {
        setPendingTrainingError(err.message)
      }
    }
    loadPendingTraining()
  }, [isDirector, session.token, refreshKey])

  const eligibleCount = dashboard?.eligibility?.find((item) =>
    String(item.status).toUpperCase().includes('ELIG')
  )?.count || 0
  const attentionCount = Math.max((dashboard?.athleteCount || 0) - eligibleCount, 0)
  const coachName = `${session.firstName || (isDirector ? 'Director' : 'Coach')} ${session.lastName || ''}`.trim()
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
          <div className="profile-meta"><strong>{coachName}</strong><span>{isDirector ? 'Director' : 'Coach'}</span></div>
        </div>

        <nav className="main-nav" aria-label={`${isDirector ? 'Director' : 'Coach'} navigation`}>
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={`nav-item ${view === 'athletes' ? 'active' : ''}`} type="button" onClick={() => setView('athletes')}>Athletes</button>
          <button className={`nav-item ${view === 'schedule' ? 'active' : ''}`} type="button" onClick={() => setView('schedule')}>Schedule</button>
          <button className={`nav-item ${view === 'performance' ? 'active' : ''}`} type="button" onClick={() => setView('performance')}>Performance</button>
          <a className="nav-item" href="#">Messages <span className="dot-badge">1</span></a>
          <a className="nav-item" href="#">Reports</a>
          <a className="nav-item" href="#">Profile</a>
        </nav>

        <button className="logout-button" type="button" onClick={onLogout}>Logout</button>
      </aside>

      <div className="coach-content">
        <header className="topbar"><div className="crumbs"><span>{isDirector ? 'Director Portal' : 'Coach Portal'}</span><span className="sep">›</span><strong>{view === 'athletes' ? 'All Athletes' : view === 'schedule' ? 'Schedule' : view === 'performance' ? 'Performance' : `${isDirector ? 'Director' : 'Coach'} Dashboard`}</strong></div><span className="role-chip">{session.role}</span></header>
        {view === 'athletes' ? <CoachAthletesPage dashboard={dashboard} athletesOverride={isDirector ? directorAthletes : undefined} observer={isDirector} onViewProfile={viewProfile} /> : view === 'profile' ? <AthleteProfilePage athlete={selectedAthlete} portfolio={portfolio} loading={portfolioLoading} error={portfolioError} canReview={!isDirector} onBack={() => { setSelectedAthlete(null); setPortfolio(null); setView('athletes') }} onReview={reviewAchievement} /> : view === 'performance' ? <PerformancePage athletes={isDirector ? directorAthletes : (dashboard?.teams || []).flatMap((team) => (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport })))} session={session} canEdit={!isDirector} /> : view === 'schedule' ? <div className="coach-schedule-page"><section className="coach-heading"><div><h2>Schedule</h2><p>{isDirector ? 'Sports events for all athletes' : 'Training, sports events, and competitions for your assigned teams'}</p></div>{isDirector ? <button className="coach-action" type="button" onClick={() => setShowDirectorScheduleModal(true)}>+ Add Sports Event</button> : <button className="coach-action" type="button" onClick={() => setShowScheduleModal(true)}>+ Add Training Schedule</button>}</section>{scheduleError && <div className="dashboard-state error-message">{scheduleError}</div>}<CalendarPage records={scheduleRecords} loading={scheduleLoading} /></div> : <>
        <section className="coach-heading"><div><h2>Good morning, {session.firstName || 'Coach'}! <span>👋</span></h2><p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div>{!isDirector && <button className="coach-action" type="button" onClick={() => setShowScheduleModal(true)}>+ Add Training Schedule</button>}</section>

        {loading && <div className="dashboard-state">Loading coach data from the database...</div>}
        {error && <div className="dashboard-state error-message">{error}</div>}

        {!loading && !error && <>
          <section className="coach-stats-grid">
            <article className="coach-stat red-accent"><span>Total Athletes</span><strong>{dashboard?.athleteCount || 0}</strong><small>Under supervision</small></article>
            <article className="coach-stat green-accent"><span>Eligible</span><strong>{eligibleCount}</strong><small>GPA ≤ 3.00</small></article>
            <article className="coach-stat alert-accent"><span>Need Attention</span><strong>{attentionCount}</strong><small>At risk / ineligible</small></article>
          </section>

          {isDirector && pendingTrainingError && <div className="dashboard-state error-message">{pendingTrainingError}</div>}
          {isDirector && <DirectorTrainingReviewPanel sessions={pendingTrainingSessions} session={session} onReviewed={() => setRefreshKey((value) => value + 1)} />}

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
      {showDirectorScheduleModal && <DirectorScheduleModal session={session} onClose={() => setShowDirectorScheduleModal(false)} onCreated={() => { setShowDirectorScheduleModal(false); setRefreshKey((value) => value + 1) }} />}
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
      notifications: '/api/Notifications/me',
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
    notifications: <PageSection title="Notifications" subtitle="Your alerts and important messages"><div className="data-list">{loading ? <p>Loading notifications...</p> : records.length ? records.map((item) => <div className={`data-row notification-row ${item.isRead ? 'read' : 'unread'}`} key={item.notificationId}><div><strong>{item.title}</strong><span>{item.message}</span><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}</small></div></div>) : <p>No notifications yet.</p>}</div></PageSection>,
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
  const isRegistrarRole = normalizedRole === 'REGISTRAR'

  if (session && isStudentRole) {
    return <StudentPortal session={session} onLogout={() => setSession(null)} />
  }

  if (session && isRegistrarRole) {
    return <RegistrarDashboard session={session} onLogout={() => setSession(null)} />
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
