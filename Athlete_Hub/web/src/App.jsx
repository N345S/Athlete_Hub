import { useCallback, useEffect, useLayoutEffect, useRef, useState, Component } from 'react'
import './App.css'
import { apiPost, apiDelete, apiGet, apiUpload } from './api.js'
import PerformanceTrendChart from './PerformanceTrendChart.jsx'

const API_BASE_URL = 'http://localhost:5007'

// Chart error boundary - catches Chart.js canvas reuse errors
class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ChartErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const { data, title } = this.props
      return (
        <div className="performance-trend-chart fallback">
          <div className="chart-fallback-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Chart unavailable - showing data table</span>
          </div>
          {data && data.labels?.length && (
            <div className="chart-fallback-table">
              <table>
                <thead>
                  <tr>
                    <th>Session</th>
                    {data.datasets?.map((ds, i) => <th key={i}>{ds.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.labels.map((label, idx) => (
                    <tr key={idx}>
                      <td>{label}</td>
                      {data.datasets?.map((ds, dIdx) => (
                        <td key={dIdx}>
                          {ds.data[idx] !== null && ds.data[idx] !== undefined ? ds.data[idx] : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel performance-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Something went wrong</h3>
          <p>Unable to load the performance page. Please try refreshing or contact support.</p>
          <pre style={{marginTop: 16, padding: 12, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#b91c1c', overflow: 'auto', textAlign: 'left', maxHeight: 200}}>
            {this.state.error?.message}
            {this.state.error?.stack}
          </pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      )
    }
    return this.props.children
  }
}

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

function getWorkoutUnit(workoutName) {
  const normalizedName = String(workoutName || '').trim().toLowerCase().replace(/[-_]+/g, ' ')
  if (normalizedName.includes('sprint') || normalizedName.includes('speed') || normalizedName.includes('balance')) return 'SECONDS'
  if (normalizedName.includes('shoot') || normalizedName.includes('accuracy')) return 'PERCENT'
  if (normalizedName.includes('push up') || normalizedName.includes('repetition') || normalizedName.includes('rep')) return 'NUMBER'
  return ''
}

function CoachScheduleModal({ teams, session, onClose, onCreated }) {
  const [form, setForm] = useState({ teamId: teams[0]?.teamId || '', title: '', trainingDates: [], pendingDate: '', startTime: '', endTime: '', location: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addDate = () => {
    if (!form.pendingDate) return
    if (form.pendingDate < new Date().toISOString().slice(0, 10)) {
      setError('Training dates cannot be in the past.')
      return
    }
    setForm((current) => ({
      ...current,
      trainingDates: current.trainingDates.includes(form.pendingDate) ? current.trainingDates : [...current.trainingDates, form.pendingDate].sort(),
      pendingDate: '',
    }))
    setError('')
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

function SingleDateDirectorScheduleModal({ session, onClose, onCreated }) {
  const [form, setForm] = useState({ scheduleType: 'SPORTS_EVENT', title: '', date: '', startTime: '', endTime: '', location: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.date || !form.startTime) {
      setError('Event type, title, date, and start time are required.')
      return
    }
    if (form.endTime && form.endTime <= form.startTime) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ ...form, title: form.title.trim(), dates: [form.date], endTime: form.endTime || null }),
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

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="director-schedule-title"><div className="modal-heading"><div><h2 id="director-schedule-title">Add Schedule Event</h2><p>Create a sports event or competition for athletes.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><form className="schedule-form" onSubmit={handleSubmit}><label>Event type<select value={form.scheduleType} onChange={(event) => setForm({ ...form, scheduleType: event.target.value })}><option value="SPORTS_EVENT">Sports event</option><option value="COMPETITION">Competition</option></select></label><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Regional athletics meet" required /></label><div className="form-grid"><label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label>Start time<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></label><label>End time<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Athletics stadium" /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="3" placeholder="Optional event details" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add event'}</button></div></form></section></div>
}

function DirectorScheduleModal({ session, onClose, onCreated }) {
  const [form, setForm] = useState({ scheduleType: 'SPORTS_EVENT', title: '', dates: [], pendingDate: '', startTime: '', endTime: '', location: '', description: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addDate = () => {
    if (!form.pendingDate || form.dates.includes(form.pendingDate)) return
    if (form.pendingDate < new Date().toISOString().slice(0, 10)) {
      setError('Event dates cannot be in the past.')
      return
    }
    setForm((current) => ({ ...current, dates: [...current.dates, current.pendingDate].sort(), pendingDate: '' }))
    setError('')
  }

  const removeDate = (date) => setForm((current) => ({ ...current, dates: current.dates.filter((item) => item !== date) }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || form.dates.length === 0 || !form.startTime) {
      setError('Event type, title, at least one date, and start time are required.')
      return
    }
    if (form.endTime && form.endTime <= form.startTime) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ ...form, title: form.title.trim(), startDate: form.dates[0], dates: form.dates, endTime: form.endTime || null }),
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

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="director-schedule-title"><div className="modal-heading"><div><h2 id="director-schedule-title">Add Schedule Event</h2><p>Create a sports event or competition on one or more dates.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><form className="schedule-form" onSubmit={handleSubmit}><label>Event type<select value={form.scheduleType} onChange={(event) => setForm({ ...form, scheduleType: event.target.value })}><option value="SPORTS_EVENT">Sports event</option><option value="COMPETITION">Competition</option></select></label><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Regional athletics meet" required /></label><div className="form-grid"><label>Dates<div className="date-picker-row"><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.pendingDate} onChange={(event) => setForm({ ...form, pendingDate: event.target.value })} /><button className="secondary-button" type="button" onClick={addDate} disabled={!form.pendingDate || form.dates.includes(form.pendingDate)}>Add date</button></div>{form.dates.length > 0 && <div className="date-chip-list">{form.dates.map((date) => <span className="date-chip" key={date}>{formatEventDate(date)}<button type="button" onClick={() => removeDate(date)} aria-label={`Remove ${date}`}>×</button></span>)}</div>}</label><label>Start time<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></label><label>End time<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Athletics stadium" /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="3" placeholder="Optional event details" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !form.dates.length}>{saving ? 'Saving...' : 'Add event'}</button></div></form></section></div>
}

function LegacyDirectorScheduleModal({ session, onClose, onCreated }) {
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
      await apiUpload('/api/Documents', body, session.token)
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
    try {
      await apiDelete(`/api/Documents/${documentId}`, session.token)
      onRefresh()
    } catch (err) {
      setError(err.message || 'Unable to delete this document.')
    }
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

function AcademicEvaluationPanel({ athlete, session }) {
  const [evaluations, setEvaluations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [academicYear, setAcademicYear] = useState('')
  const [semester, setSemester] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/Eligibility/athlete/${athlete.athleteId}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.message || 'Unable to load academic eligibility.')
        setEvaluations(result.records || [])
      })
      .catch((err) => setError(err.message || 'Unable to load academic eligibility.'))
      .finally(() => setLoading(false))
  }, [athlete.athleteId, session.token])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const latest = evaluations[0]
  const requestEvaluation = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Eligibility/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ athleteId: athlete.athleteId, academicYear, semester }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to request Grade Evaluation.')
      if (result.evaluation) {
        setEvaluations((current) => [result.evaluation, ...current.filter((item) => item.eligibilityId !== result.evaluation.eligibilityId)])
      }
      setMessage(result.message || 'Grade Evaluation request sent to the Registrar.')
      setShowRequestForm(false)
    } catch (err) {
      setError(err.message || 'Unable to request Grade Evaluation.')
    } finally {
      setSaving(false)
    }
  }

  const openPdf = async (evaluation) => {
    if (!evaluation.document?.fileUrl) return
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}${evaluation.document.fileUrl}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
      if (!response.ok) throw new Error('Grade Evaluation PDF is not available.')
      const objectUrl = URL.createObjectURL(await response.blob())
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return objectUrl
      })
    } catch (err) {
      setError(err.message || 'Unable to open Grade Evaluation PDF.')
    }
  }

  return <><section className="coach-panel academic-evaluation-panel"><div className="panel-heading"><div><h3>Academic Eligibility</h3><p>Official Grade Evaluation and Registrar review</p></div>{!showRequestForm && latest?.academicStatus !== 'PENDING' && <button className="template-button" type="button" onClick={() => setShowRequestForm(true)}>Request Grade Evaluation</button>}</div>{loading ? <p>Loading eligibility information...</p> : error && !evaluations.length ? <p className="error-message">{error}</p> : evaluations.length ? <div className="evaluation-history">{evaluations.map((item) => <article className="evaluation-history-row" key={item.eligibilityId}><div className="evaluation-history-heading"><strong>{item.term.semester} {item.term.academicYear}</strong><span className={`admin-status ${String(item.academicStatus).toLowerCase()}`}>{item.academicStatus === 'AT_RISK' ? 'Monitored' : item.academicStatus === 'INELIGIBLE' ? 'Ineligible' : item.academicStatus === 'ELIGIBLE' ? 'Eligible' : 'Pending'}</span></div>{item.document ? <div className="evaluation-actions"><span>{item.document.documentName}</span>{item.academicStatus !== 'PENDING' && <button className="template-button" type="button" onClick={() => openPdf(item)}>View Grade Evaluation PDF</button>}</div> : <p className="empty-copy">Waiting for the Registrar to upload the official Grade Evaluation PDF.</p>}{item.reasons?.length > 0 && <div><strong>Reasons</strong><ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}{item.remarks && <p><strong>Registrar Remark:</strong> {item.remarks}</p>}{item.reviewedAt && <small>Reviewed {new Date(item.reviewedAt).toLocaleDateString()}</small>}</article>)}</div> : <p className="empty-copy">No Grade Evaluation or eligibility decision is available.</p>}{message && <p className="success-message">{message}</p>}{error && evaluations.length > 0 && <p className="form-error">{error}</p>}{showRequestForm && <form className="evaluation-request-form" onSubmit={requestEvaluation}><label>Academic year<input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="e.g. 2026-2027" required /></label><label>Academic term<input value={semester} onChange={(event) => setSemester(event.target.value)} placeholder="e.g. 1st Semester" required /></label><div className="evaluation-actions"><button className="secondary-button" type="button" onClick={() => setShowRequestForm(false)}>Cancel</button><button className="coach-action" type="submit" disabled={saving}>{saving ? 'Sending...' : 'Send Request'}</button></div>{error && <p className="form-error">{error}</p>}</form>}</section>{previewUrl && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreviewUrl('')}><section className="modal-card evaluation-pdf-modal" role="dialog" aria-modal="true" aria-label="Grade Evaluation PDF"><div className="modal-heading"><h2>Grade Evaluation PDF</h2><button className="icon-button" type="button" onClick={() => setPreviewUrl('')} aria-label="Close PDF preview">×</button></div><iframe title="Grade Evaluation PDF" src={previewUrl} /></section></div>}</>
}

function AthleteProfilePage({ athlete, portfolio, loading, error, canReview, onBack, onReview, onReject }) {
  return <section className="athlete-profile-page"><button className="schedule-more-button" type="button" onClick={onBack}>← Back to athletes</button><section className="athlete-profile-hero"><div className="portfolio-avatar">{(athlete?.firstName || 'A').slice(0, 1)}{(athlete?.lastName || 'A').slice(0, 1)}</div><div><h2>{athlete?.firstName} {athlete?.lastName}</h2><p>{athlete?.studentNumber || 'Student ID pending'} · {athlete?.sport || 'Athlete'}</p></div></section><section className="athlete-profile-details"><div><span>Program</span><strong>{athlete?.course || '—'}</strong></div><div><span>Year level</span><strong>{athlete?.yearLevel || '—'}</strong></div><div><span>Team</span><strong>{athlete?.teamName || 'No team assigned'}</strong></div><div><span>Sport</span><strong>{athlete?.sport || '—'}</strong></div></section><section className="coach-panel profile-portfolio-section"><div className="panel-heading"><div><h3>Complete portfolio</h3><p>Achievements, descriptions, statuses, dates, and evidence.</p></div></div>{loading ? <p>Loading portfolio...</p> : error ? <p className="error-message">{error}</p> : portfolio?.items?.length ? <div className="data-list">{portfolio.items.map((item) => { const rawStatus = item.achievementStatus || 'PENDING'; const status = String(rawStatus).toUpperCase(); const isVerified = status === 'VERIFIED' || status === 'APPROVED'; const isRejected = status === 'REJECTED'; const displayStatus = isVerified ? 'Verified' : isRejected ? 'Rejected' : 'Pending'; return <article className="data-row" key={item.portfolioItemId}><strong>{item.title}</strong><span>{item.description || 'No description provided.'}</span><small>{displayStatus} · {item.achievementDate ? formatEventDate(item.achievementDate) : 'Date not provided'}</small>{item.evidence?.length ? <div className="evidence-links">{item.evidence.map((evidence) => <a href={`${API_BASE_URL}${evidence.fileUrl}`} target="_blank" rel="noreferrer" key={evidence.documentId}>{evidence.documentName}</a>)}</div> : <small>No evidence attached</small>}{canReview && !isVerified && !isRejected && item.achievementId && <div className="review-actions"><button className="review-button approve" type="button" onClick={() => onReview(item, 'APPROVED')}>Approve</button><button className="review-button reject" type="button" onClick={() => onReject(item)}>Reject</button></div>}</article> })}</div> : <p className="empty-copy">No portfolio submissions found.</p>}</section></section>
}

function PerformancePage({ athletes = [], session, canEdit }) {
  const [trainingSessions, setTrainingSessions] = useState([])
  const [selectedAthleteId, setSelectedAthleteId] = useState('')
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState([])
  const [form, setForm] = useState({ metricId: '', recordedValue: '', recordedDate: new Date().toISOString().slice(0, 10), notes: '', dataType: '', unit: 'NUMBER', sessionId: 0 })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [trendTimeRange, setTrendTimeRange] = useState('overall')
  const [trendData, setTrendData] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const addFormRef = useRef(null)

  useLayoutEffect(() => {
    if (!showAddForm) return
    let firstFrame
    let secondFrame
    const scrollToAddForm = () => {
      const addForm = addFormRef.current
      if (!addForm) return
      addForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    firstFrame = requestAnimationFrame(() => {
      scrollToAddForm()
      secondFrame = requestAnimationFrame(scrollToAddForm)
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [showAddForm])

  useEffect(() => {
    if (!session?.token || !canEdit) return
    fetch(`${API_BASE_URL}/api/Training/sessions`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => [])
        if (!response.ok) throw new Error(result?.message || 'Unable to load training sessions.')
        setTrainingSessions(result)
      })
      .catch(() => setTrainingSessions([]))
  }, [session.token, canEdit])

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

  useEffect(() => {
    if (!selectedAthleteId || !session?.token) return
    const loadTrend = async () => {
      setTrendLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/Performance/athlete/${selectedAthleteId}/trend?timeRange=${trendTimeRange}`, {
          headers: { Authorization: `Bearer ${session.token}` }
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.message || 'Failed to load trend')
        setTrendData(data)
      } catch (err) {
        console.error('Trend load error:', err)
      } finally {
        setTrendLoading(false)
      }
    }
    loadTrend()
  }, [selectedAthleteId, trendTimeRange, session.token])

  const completedSessions = trainingSessions.filter((item) => {
    if (String(item.approvalStatus || '').toUpperCase() !== 'APPROVED') return false
    const end = item.endTime ? new Date(`${item.trainingDate}T${item.endTime}`) : new Date(`${item.trainingDate}T23:59:59`)
    return !Number.isNaN(end.getTime()) && end <= new Date()
  })
  const recentCompletedSession = [...completedSessions].sort((first, second) => {
    const firstEnd = new Date(`${first.trainingDate}T${first.endTime || '23:59:59'}`).getTime()
    const secondEnd = new Date(`${second.trainingDate}T${second.endTime || '23:59:59'}`).getTime()
    return secondEnd - firstEnd
  })[0]
  const selectedCompletedSession = completedSessions.find((item) => item.trainingSessionId === Number(form.sessionId)) || recentCompletedSession
  const savedWorkoutNames = [...new Set(records.flatMap((record) => [record.dataType, record.metric?.metricName]).filter(Boolean))]

  useEffect(() => {
    setForm((current) => ({
      ...current,
      sessionId: recentCompletedSession?.trainingSessionId || 0,
      recordedDate: selectedCompletedSession?.trainingDate || current.recordedDate,
    }))
  }, [recentCompletedSession?.trainingSessionId, recentCompletedSession?.trainingDate, selectedCompletedSession?.trainingDate])

  const addRecord = async (event) => {
    event.preventDefault()
    if (!form.sessionId) {
      setError('Select a completed training session before recording performance.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Performance/record`, {
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

  const selectedAthlete = athletes.find(a => a.athleteId === Number(selectedAthleteId))
  const filteredAthletes = (athletes || []).filter((athlete) => `${athlete.firstName} ${athlete.lastName} ${athlete.studentNumber} ${athlete.sport || ''}`.toLowerCase().includes(search.toLowerCase()))

  const formatDataTypeLabel = (type) => {
    const labels = {
      'PUSH_UP': 'Push-ups',
      'BALANCE': 'Balance (sec)',
      'SPRINT_10M': 'Sprint 10m (sec)',
      'SPRINT_40M': 'Sprint 40m (sec)',
      'VELOCITY': 'Velocity'
    }
    return labels[type] || type
  }

  return (
    <section className="performance-page">
      <div className="performance-header">
        {selectedAthlete ? <div className="performance-detail-header"><button className="schedule-more-button performance-back-button" type="button" onClick={() => { setSelectedAthleteId(''); setShowAddForm(false) }}>← All Athletes</button><div className="performance-detail-title"><div><h2>Performance Tracking</h2><p>{canEdit ? 'Record and visualize athlete performance over time' : 'View athlete performance over time'}</p></div></div>{canEdit && <button className="coach-action performance-add-action" type="button" onClick={() => setShowAddForm((current) => !current)}>{showAddForm ? 'Close' : '+ Add Performance'}</button>}</div> : <div className="performance-browse-header"><div><h2>Performance Tracking</h2><p>{canEdit ? 'Record and visualize athlete performance over time' : 'View athlete performance records and trends'}</p></div><div className="performance-athlete-search">
            <input
              type="text"
              placeholder="Search athletes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div></div>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!athletes.length && (
        <div className="panel performance-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3>No athletes assigned</h3>
          <p>You don't have any athletes assigned to your teams yet. Contact your director to get team assignments.</p>
        </div>
      )}

      {athletes.length && !selectedAthlete && (
        <section className="performance-athlete-selection"><div className="coach-list-header"><div><h3>Select an athlete</h3><p>Open an athlete to view performance records and trends.</p></div><span className="role-chip">{filteredAthletes.length} Available</span></div><div className="performance-athlete-cards">{filteredAthletes.length ? filteredAthletes.map((athlete) => <button className="performance-athlete-card" type="button" key={athlete.athleteId} onClick={() => { setSelectedAthleteId(String(athlete.athleteId)); setShowAddForm(false) }}><div className="athlete-avatar">{(athlete.firstName || 'A').slice(0, 1)}{(athlete.lastName || 'A').slice(0, 1)}</div><strong>{athlete.firstName} {athlete.lastName}</strong><small>{athlete.studentNumber || 'Student ID pending'}</small><span>{athlete.sport || 'Athlete'}{athlete.teamName ? ` · ${athlete.teamName}` : ''}</span></button>) : <p className="empty-copy">No athletes match your search.</p>}</div></section>
      )}

      {selectedAthlete && (
        <div className={`performance-grid ${showAddForm ? 'performance-grid-with-form' : 'performance-grid-full'}`}>
          {canEdit && <section ref={addFormRef} className={`panel performance-form-panel ${showAddForm ? 'performance-add-modal' : 'performance-form-hidden'}`}>
            <div className="panel-header">
              <div>
                <h3>Record Performance</h3>
                <p>{selectedAthlete.firstName} {selectedAthlete.lastName}</p>
              </div>
              <div className="athlete-avatar-small">
                {(selectedAthlete.firstName || 'A')[0]}{(selectedAthlete.lastName || 'A')[0]}
              </div>
              <button className="icon-button" type="button" onClick={() => setShowAddForm(false)} aria-label="Close add performance form">×</button>
            </div>

            <form className="performance-form" onSubmit={addRecord}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Workout / performance name</label>
                  <input
                    list="saved-workout-names"
                    value={form.dataType}
                    onChange={(e) => setForm({ ...form, dataType: e.target.value, unit: getWorkoutUnit(e.target.value) || form.unit })}
                    placeholder="e.g. Push-ups, Sprint, Shooting, Balance"
                    required
                  />
                  <datalist id="saved-workout-names">{savedWorkoutNames.map((name) => <option key={name} value={name} />)}</datalist>
                </div>

                <div className="form-field">
                  <label>Value <span className="required">*</span></label>
                  <input
                    type="number"
                    step="any"
                    value={form.recordedValue}
                    onChange={(e) => setForm({ ...form, recordedValue: e.target.value })}
                    placeholder="Enter value"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Value type</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required>
                    <option value="NUMBER">Number / repetitions</option>
                    <option value="SECONDS">Seconds</option>
                    <option value="METERS_PER_SECOND">Meters per second</option>
                    <option value="PERCENT">Percent</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Session date</label>
                  <input
                    type="date"
                    value={form.recordedDate}
                    readOnly
                    disabled={!recentCompletedSession}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="performance-session">Completed training session</label>
                  <select
                    id="performance-session"
                    value={form.sessionId || ''}
                    onChange={(event) => {
                      const selectedSession = completedSessions.find((item) => item.trainingSessionId === Number(event.target.value))
                      setForm({
                        ...form,
                        sessionId: Number(event.target.value),
                        recordedDate: selectedSession?.trainingDate || form.recordedDate,
                      })
                    }}
                    disabled={!completedSessions.length}
                    required
                  >
                    {!completedSessions.length && <option value="">No completed training session available</option>}
                    {completedSessions.map((item) => (
                      <option key={item.trainingSessionId} value={item.trainingSessionId}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field full-width">
                  <label>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes about this performance entry"
                    rows="3"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving || !canEdit || !recentCompletedSession}>
                  {saving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </section>}

          <section className="panel performance-trend-panel">
            <div className="panel-header">
              <div>
                <h3>Performance Trend</h3>
                <p>{selectedAthlete.firstName} {selectedAthlete.lastName}</p>
              </div>
            </div>

            <div className="time-range-selector" role="group" aria-label="Time range">
              <button
                className={trendTimeRange === 'overall' ? 'active' : ''}
                onClick={() => setTrendTimeRange('overall')}
                aria-pressed={trendTimeRange === 'overall'}
              >
                Overall
              </button>
              <button
                className={trendTimeRange === 'monthly' ? 'active' : ''}
                onClick={() => setTrendTimeRange('monthly')}
                aria-pressed={trendTimeRange === 'monthly'}
              >
                Monthly
              </button>
              <button
                className={trendTimeRange === 'weekly' ? 'active' : ''}
                onClick={() => setTrendTimeRange('weekly')}
                aria-pressed={trendTimeRange === 'weekly'}
              >
                Weekly
              </button>
            </div>

            <div className="chart-wrapper">
              {trendLoading ? (
                <div className="chart-loading">
                  <div className="spinner"></div>
                  <p>Loading trend data...</p>
                </div>
              ) : trendData && trendData.labels?.length ? (
                <ChartErrorBoundary data={trendData} title={`${selectedAthlete.firstName} ${selectedAthlete.lastName} - ${trendTimeRange.charAt(0).toUpperCase() + trendTimeRange.slice(1)} Performance`}>
                  <PerformanceTrendChart
                    data={trendData}
                    title={`${selectedAthlete.firstName} ${selectedAthlete.lastName} - ${trendTimeRange.charAt(0).toUpperCase() + trendTimeRange.slice(1)} Performance`}
                  />
                </ChartErrorBoundary>
              ) : (
                <div className="chart-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
                  </svg>
                  <p>No performance data available</p>
                  <span>Record some performance entries to see trends</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {selectedAthlete && <section className="panel performance-records-panel">
        <div className="panel-header">
          <h3>Performance Records</h3>
          {selectedAthlete && <p>History for {selectedAthlete.firstName} {selectedAthlete.lastName}</p>}
        </div>
        <div className="records-table-container">
          {loading ? (
            <div className="table-loading">Loading records...</div>
          ) : records.length ? (
            <table className="records-table">
              <thead>
                <tr>
                  <th>Workout</th>
                  <th>Value</th>
                  <th>Date</th>
                  <th>Session</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.PerformanceRecordId || record.performanceRecordId}>
                    <td>
                      <span className="data-type-badge" data-type={record.DataType || record.metric?.DataType || record.metric?.dataType}>{record.DataType || record.metric?.DataType || record.metric?.dataType || '—'}</span>
                    </td>
                    <td>
                      <span className="value-cell">
                        {record.RecordedValue || record.recordedValue} {record.Unit || record.unit || record.metric?.Unit || record.metric?.unit || ''}
                      </span>
                    </td>
                    <td>{record.recordedDate || record.RecordedDate}</td>
                    <td>
                      {record.SessionId ? (
                        <span className="session-badge">Session {record.SessionId}</span>
                      ) : (
                        <span className="no-session">—</span>
                      )}
                    </td>
                    <td>
                      {record.Notes ? (
                        <span className="notes-text">{record.Notes}</span>
                      ) : (
                        <span className="no-notes">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="records-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p>No performance records found</p>
              <span>Start recording performance data to build history</span>
            </div>
          )}
        </div>
      </section>}
    </section>
  )
}

function GradeEntryPage({ students, session }) {
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [form, setForm] = useState({ academicYear: '', semester: '', academicStatus: 'ELIGIBLE', remarks: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const filteredStudents = students.filter((student) => `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.course || ''}`.toLowerCase().includes(search.toLowerCase()))

  const saveReview = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Eligibility/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ athleteId: selectedStudent.athleteId, academicYear: form.academicYear.trim(), semester: form.semester.trim(), academicStatus: form.academicStatus, remarks: form.remarks.trim() || null }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to save eligibility review.')
      setMessage('Eligibility remark saved successfully.')
      setSelectedStudent(null)
      setForm({ academicYear: '', semester: '', academicStatus: 'ELIGIBLE', remarks: '' })
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  if (selectedStudent) return <section className="grade-entry-page">
    <div className="registrar-heading"><div><h2>Eligibility Review</h2><p>Record whether this athlete is eligible and leave a registrar remark</p></div></div>
    <button className="schedule-more-button" type="button" onClick={() => setSelectedStudent(null)}>? Back to athletes</button>
    <section className="athlete-profile-hero"><div className="portfolio-avatar">{(selectedStudent.firstName || 'A').slice(0, 1)}{(selectedStudent.lastName || 'A').slice(0, 1)}</div><div><h2>{selectedStudent.firstName} {selectedStudent.lastName}</h2><p>{selectedStudent.studentNumber || 'Student ID pending'} ? {selectedStudent.course || 'Program not set'} ? Year {selectedStudent.yearLevel || '?'}</p></div></section>
    <section className="coach-panel"><div className="panel-heading"><div><h3>Eligibility decision</h3><p>Choose a status and add any supporting remark</p></div></div>{error && <p className="form-error">{error}</p>}<form className="portfolio-submit-form" onSubmit={saveReview}><div><label htmlFor="review-year">Academic year</label><input id="review-year" value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} placeholder="e.g. 2026-2027" required /></div><div><label htmlFor="review-semester">Semester</label><input id="review-semester" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} placeholder="e.g. 1st Semester" required /></div><div><label htmlFor="review-status">Eligibility</label><select id="review-status" value={form.academicStatus} onChange={(event) => setForm({ ...form, academicStatus: event.target.value })}><option value="ELIGIBLE">Eligible</option><option value="INELIGIBLE">Not eligible</option></select></div><div><label htmlFor="review-remarks">Registrar remark</label><textarea id="review-remarks" rows="3" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Add a note about this eligibility decision" /></div><button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Eligibility Remark'}</button></form></section>
  </section>

  return <section className="grade-entry-page"><div className="registrar-heading"><div><h2>Eligibility Review</h2><p>Record an eligible or not eligible decision with a registrar remark</p></div></div>{message && <p className="success-message">{message}</p>}<div className="grade-entry-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, student ID, or program..." /><button type="button" onClick={() => setSearch('')}>Clear</button></div><div className="athlete-cards">{filteredStudents.length ? filteredStudents.map((student) => <article className="athlete-card" key={student.athleteId}><div className="athlete-card-top"><div className="athlete-avatar">{(student.firstName || 'A').slice(0, 1)}{(student.lastName || 'A').slice(0, 1)}</div><div><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber}</small><span>{student.course || 'Program not set'}</span></div></div><div className="athlete-card-footer"><span className={student.eligibilityStatus === 'ELIGIBLE' ? 'eligible-label' : 'attention-label'}>{student.eligibilityStatus || 'PENDING'}</span><div><button type="button" onClick={() => { setSelectedStudent(student); setForm({ ...form, academicStatus: student.eligibilityStatus === 'ELIGIBLE' ? 'ELIGIBLE' : 'INELIGIBLE' }); setError(''); setMessage('') }}>Review eligibility</button></div></div></article>) : <div className="dashboard-state"><p className="empty-copy">No students match your search.</p></div>}</div></section>
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

const ELIGIBILITY_REASONS = [
  'Failing Grades',
  'Academic Requirement Not Met',
  'Incomplete Academic Requirement',
  'Other',
]

function RegistrarDashboard({ session, onLogout }) {
  const [students, setStudents] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [view, setView] = useState('dashboard')
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reviewStatus, setReviewStatus] = useState('ELIGIBLE')
  const [selectedReasons, setSelectedReasons] = useState([])
  const [remarks, setRemarks] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${session.token}` }
      const [studentsResponse, evaluationsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/RegistrarDashboard`, { headers }),
        fetch(`${API_BASE_URL}/api/Eligibility/registrar`, { headers }),
      ])
      const studentsResult = await studentsResponse.json().catch(() => null)
      const evaluationsResult = await evaluationsResponse.json().catch(() => null)
      if (!studentsResponse.ok) throw new Error(studentsResult?.message || 'Unable to load students.')
      if (!evaluationsResponse.ok) throw new Error(evaluationsResult?.message || 'Unable to load evaluations.')
      setStudents(studentsResult.students || [])
      setEvaluations(evaluationsResult.evaluations || [])
    } catch (err) {
      setError(err.message || 'Unable to load Registrar data.')
    } finally {
      setLoading(false)
    }
  }, [session.token])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const pendingEvaluations = evaluations.filter((item) => item.academicStatus === 'PENDING')
  const awaitingReview = pendingEvaluations.filter((item) => item.document)
  const gradeRequests = pendingEvaluations.filter((item) => !item.document)
  const completedEvaluations = evaluations.filter((item) => item.academicStatus !== 'PENDING')
  const selectedEvaluation = evaluations.find((item) => item.eligibilityId === selectedEvaluationId)
  const filteredStudents = students.filter((student) =>
    `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.course || ''}`.toLowerCase().includes(search.toLowerCase())
  )
  const filteredRequests = gradeRequests.filter((item) =>
    `${item.student.firstName} ${item.student.lastName} ${item.student.studentNumber}`.toLowerCase().includes(search.toLowerCase())
  )
  const filteredAwaiting = awaitingReview.filter((item) =>
    `${item.student.firstName} ${item.student.lastName} ${item.student.studentNumber}`.toLowerCase().includes(search.toLowerCase())
  )
  const filteredCompleted = completedEvaluations.filter((item) =>
    `${item.student.firstName} ${item.student.lastName} ${item.student.studentNumber}`.toLowerCase().includes(search.toLowerCase())
  )

  const openReview = (item) => {
    setSelectedEvaluationId(item.eligibilityId)
    setReviewStatus(item.academicStatus === 'INELIGIBLE' ? 'INELIGIBLE' : 'ELIGIBLE')
    setSelectedReasons(item.academicStatus === 'INELIGIBLE' ? item.reasons || [] : [])
    setRemarks(item.remarks || '')
    setUploadFile(null)
    setError('')
    setView('review')
  }

  const uploadEvaluation = async () => {
    if (!selectedEvaluation || !uploadFile) return
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const response = await fetch(`${API_BASE_URL}/api/Eligibility/${selectedEvaluation.eligibilityId}/document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: formData,
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to upload Grade Evaluation PDF.')
      setEvaluations((current) => current.map((item) => item.eligibilityId === selectedEvaluation.eligibilityId
        ? { ...item, document: result }
        : item))
      setUploadFile(null)
    } catch (err) {
      setError(err.message || 'Unable to upload Grade Evaluation PDF.')
    } finally {
      setSaving(false)
    }
  }

  const submitReview = async (event) => {
    event.preventDefault()
    if (!selectedEvaluation) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Eligibility/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          athleteId: selectedEvaluation.athleteId,
          academicYear: selectedEvaluation.term.academicYear,
          semester: selectedEvaluation.term.semester,
          academicStatus: reviewStatus,
          reasons: selectedReasons,
          remarks,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to submit eligibility review.')
      setEvaluations((current) => current.map((item) => item.eligibilityId === selectedEvaluation.eligibilityId
        ? { ...item, academicStatus: result.academicStatus, reasons: result.reasons, remarks: result.remarks, reviewedAt: result.reviewedAt }
        : item))
      setView('evaluations')
    } catch (err) {
      setError(err.message || 'Unable to submit eligibility review.')
    } finally {
      setSaving(false)
    }
  }

  const openPdf = async (item) => {
    if (!item?.document?.fileUrl) return
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}${item.document.fileUrl}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
      if (!response.ok) throw new Error('Unable to open Grade Evaluation PDF.')
      const objectUrl = URL.createObjectURL(await response.blob())
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return objectUrl
      })
    } catch (err) {
      setError(err.message || 'Unable to open Grade Evaluation PDF.')
    }
  }

  const toggleReason = (reason) => setSelectedReasons((current) =>
    current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
  )

  const formatStatus = (status) => status === 'AT_RISK' ? 'Monitored' : status === 'PENDING' ? 'Pending' : status === 'INELIGIBLE' ? 'Ineligible' : 'Eligible'
  const navItems = [
    ['dashboard', 'Dashboard'],
    ['students', 'Students'],
    ['requests', 'Eligibility Requests'],
    ['evaluations', 'Evaluations'],
  ]

  let pageContent
  if (view === 'review' && selectedEvaluation) {
    pageContent = <>
      <div className="registrar-heading"><div><h2>Academic Eligibility Review</h2><p>Review the official evaluation and record the Registrar decision.</p></div><button className="template-button" type="button" onClick={() => setView(selectedEvaluation.academicStatus === 'PENDING' ? 'requests' : 'evaluations')}>Back</button></div>
      <section className="athlete-profile-hero"><div className="portfolio-avatar">{selectedEvaluation.student.firstName.slice(0, 1)}{selectedEvaluation.student.lastName.slice(0, 1)}</div><div><h2>{selectedEvaluation.student.firstName} {selectedEvaluation.student.lastName}</h2><p>Student ID: {selectedEvaluation.student.studentNumber} · {selectedEvaluation.student.course || 'Program not set'}</p></div></section>
      <div className="evaluation-source-grid"><section className="admin-panel"><h3>Academic Evaluation</h3>{selectedEvaluation.document ? <><p>{selectedEvaluation.document.documentName}</p><small>Uploaded {selectedEvaluation.document.uploadedAt ? new Date(selectedEvaluation.document.uploadedAt).toLocaleString() : 'date unavailable'}</small><div className="evaluation-actions"><button className="template-button" type="button" onClick={() => openPdf(selectedEvaluation)}>View PDF</button></div></> : <><p>No Grade Evaluation PDF is attached to this request.</p><label className="evaluation-file-label">Upload official Grade Evaluation PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} /></label><button className="coach-action" type="button" onClick={uploadEvaluation} disabled={!uploadFile || saving}>{saving ? 'Uploading...' : 'Upload PDF'}</button></>}</section><section className="admin-panel"><h3>Current Term</h3><strong>{selectedEvaluation.term.semester} {selectedEvaluation.term.academicYear}</strong><p>{selectedEvaluation.document ? 'Official record available for review.' : 'Waiting for the official evaluation document.'}</p><span className={`admin-status ${selectedEvaluation.academicStatus.toLowerCase()}`}>{formatStatus(selectedEvaluation.academicStatus)}</span></section></div>
      <form className="admin-panel evaluation-review-form" onSubmit={submitReview}>
        <div className="panel-heading"><div><h3>Eligibility Decision</h3><p>Record the result from the official academic record; do not enter individual grades.</p></div></div>
        <fieldset className="evaluation-status-options">
          <legend>Eligibility</legend>
          <label><input type="radio" name="eligibility" value="ELIGIBLE" checked={reviewStatus === 'ELIGIBLE'} onChange={() => { setReviewStatus('ELIGIBLE'); setSelectedReasons([]) }} /> Eligible</label>
          <label><input type="radio" name="eligibility" value="INELIGIBLE" checked={reviewStatus === 'INELIGIBLE'} onChange={() => setReviewStatus('INELIGIBLE')} /> Ineligible</label>
        </fieldset>
        {reviewStatus === 'INELIGIBLE' && <div className="evaluation-reasons"><strong>Eligibility reasons</strong><div className="evaluation-reason-options">{ELIGIBILITY_REASONS.map((reason) => <label key={reason}><input type="checkbox" checked={selectedReasons.includes(reason)} onChange={() => toggleReason(reason)} /> {reason}</label>)}</div>{selectedReasons.length > 0 && <div className="evaluation-reason-chips">{selectedReasons.map((reason) => <button type="button" key={reason} onClick={() => toggleReason(reason)} aria-label={`Remove ${reason}`}>{reason} <span aria-hidden="true">×</span></button>)}</div>}</div>}
        {!selectedEvaluation.document && <p className="form-error">Upload the official Grade Evaluation PDF before submitting this review.</p>}
        {reviewStatus === 'INELIGIBLE' && selectedReasons.length === 0 && <p className="form-error">Select at least one eligibility reason for an Ineligible decision.</p>}
        <label className="evaluation-remarks">Additional Registrar Remark<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows="4" placeholder="Add optional context for the Coach and Sports Director." /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="evaluation-actions"><button className="primary-button" type="submit" disabled={saving || !selectedEvaluation.document || (reviewStatus === 'INELIGIBLE' && selectedReasons.length === 0)}>{saving ? 'Submitting...' : 'Submit Review'}</button></div>
      </form>
    </>
  } else if (view === 'students') {
    pageContent = <><div className="registrar-heading"><div><h2>Students</h2><p>Student-athlete roster</p></div><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." /></div><section className="admin-panel evaluation-table-wrap"><table className="evaluation-table"><thead><tr><th>Student</th><th>Student ID</th><th>Program</th><th>Academic Evaluation</th></tr></thead><tbody>{filteredStudents.map((student) => { const latest = evaluations.find((item) => item.athleteId === student.athleteId); return <tr key={student.athleteId}><td>{student.firstName} {student.lastName}</td><td>{student.studentNumber}</td><td>{student.course || '—'}</td><td>{latest ? <button className="template-button" type="button" onClick={() => openReview(latest)}>{formatStatus(latest.academicStatus)}</button> : <span>Not requested</span>}</td></tr> })}</tbody></table>{!loading && filteredStudents.length === 0 && <p className="empty-copy">No students found.</p>}</section></>
  } else if (view === 'requests') {
    pageContent = <><div className="registrar-heading"><div><h2>Eligibility Requests</h2><p>Coach and Director requests awaiting an official academic evaluation document.</p></div><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." /></div><section className="admin-panel evaluation-table-wrap"><table className="evaluation-table"><thead><tr><th>Student</th><th>Student ID</th><th>Term</th><th>Academic Evaluation</th><th>Action</th></tr></thead><tbody>{filteredRequests.map((item) => <tr key={item.eligibilityId}><td>{item.student.firstName} {item.student.lastName}</td><td>{item.student.studentNumber}</td><td>{item.term.semester} {item.term.academicYear}</td><td>{item.document ? 'Available' : 'Requested'}</td><td><button className="template-button" type="button" onClick={() => openReview(item)}>{item.document ? 'Review' : 'Upload PDF'}</button></td></tr>)}</tbody></table>{!loading && filteredRequests.length === 0 && <p className="empty-copy">No pending eligibility requests.</p>}</section></>
  } else if (view === 'evaluations') {
    pageContent = <><div className="registrar-heading"><div><h2>Evaluations</h2><p>Registrar eligibility decisions</p></div><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." /></div><section className="admin-panel evaluation-table-wrap"><table className="evaluation-table"><thead><tr><th>Student</th><th>Student ID</th><th>Term</th><th>Status</th><th>Reasons</th><th>Action</th></tr></thead><tbody>{filteredCompleted.map((item) => <tr key={item.eligibilityId}><td>{item.student.firstName} {item.student.lastName}</td><td>{item.student.studentNumber}</td><td>{item.term.semester} {item.term.academicYear}</td><td><span className={`admin-status ${item.academicStatus.toLowerCase()}`}>{formatStatus(item.academicStatus)}</span></td><td>{(item.reasons || []).join(', ') || '—'}</td><td><button className="template-button" type="button" onClick={() => openReview(item)}>View</button></td></tr>)}</tbody></table>{!loading && filteredCompleted.length === 0 && <p className="empty-copy">No completed evaluations yet.</p>}</section></>
  } else {
    pageContent = <><div className="registrar-heading"><div><h2>Registrar Dashboard</h2><p>Academic eligibility and evaluation</p></div><button className="coach-action" type="button" onClick={loadData} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh data'}</button></div><section className="evaluation-stats"><article className="evaluation-stat"><span>Ready for Eligibility Review</span><strong>{awaitingReview.length}</strong></article><article className="evaluation-stat request-accent"><span>Pending Eligibility Requests</span><strong>{gradeRequests.length}</strong></article><article className="evaluation-stat reviewed-accent"><span>Evaluated</span><strong>{completedEvaluations.length}</strong></article></section><section className="admin-panel evaluation-table-wrap"><div className="panel-heading"><div><h3>Evaluations Ready for Review</h3><p>Official academic evaluation PDF received</p></div><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." /></div><table className="evaluation-table"><thead><tr><th>Student</th><th>Student ID</th><th>Term</th><th>Academic Evaluation</th><th>Action</th></tr></thead><tbody>{filteredAwaiting.map((item) => <tr key={item.eligibilityId}><td>{item.student.firstName} {item.student.lastName}</td><td>{item.student.studentNumber}</td><td>{item.term.semester} {item.term.academicYear}</td><td>PDF received</td><td><button className="primary-button compact-button" type="button" onClick={() => openReview(item)}>Review eligibility</button></td></tr>)}</tbody></table>{!loading && filteredAwaiting.length === 0 && <p className="empty-copy">No evaluations are ready for review. Requests without a PDF are listed under Eligibility Requests.</p>}</section></>
  }

  const activeNav = view === 'review' ? (selectedEvaluation?.academicStatus === 'PENDING' ? 'requests' : 'evaluations') : view
  return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Registrar Portal</small></div></div><div className="profile-block"><div className="avatar">{(session.firstName || 'R').slice(0, 1)}{(session.lastName || 'G').slice(0, 1)}</div><div className="profile-meta"><strong>{session.firstName} {session.lastName}</strong><span>Registrar</span></div></div><nav className="main-nav" aria-label="Registrar navigation">{navItems.map(([key, label]) => <button className={`nav-item ${activeNav === key ? 'active' : ''}`} type="button" key={key} onClick={() => { setView(key); setSearch(''); setError('') }}>{label}</button>)}</nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>{view === 'review' ? 'Evaluation Review' : navItems.find(([key]) => key === view)?.[1] || 'Dashboard'}</strong></div><span className="role-chip">Registrar</span></header>{loading && <div className="dashboard-state">Loading Registrar data...</div>}{error && view !== 'review' && <div className="dashboard-state error-message">{error}</div>}{!loading && pageContent}</div>{previewUrl && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreviewUrl('')}><section className="modal-card evaluation-pdf-modal" role="dialog" aria-modal="true" aria-label="Grade Evaluation PDF"><div className="modal-heading"><h2>Grade Evaluation PDF</h2><button className="icon-button" type="button" onClick={() => setPreviewUrl('')} aria-label="Close PDF preview">×</button></div><iframe title="Grade Evaluation PDF" src={previewUrl} /></section></div>}</main>
}

function LegacyRegistrarDashboard({ session, onLogout }) {
  const [dashboard, setDashboard] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('athletes')
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
    const gradeEntryButton = navButtons.find((button) => button.textContent.trim() === 'Eligibility Review')
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

  if (view === 'athletes') {
    return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><div className="profile-block"><div className="avatar">{(session.firstName || 'R').slice(0, 1)}{(session.lastName || 'G').slice(0, 1)}</div><div className="profile-meta"><strong>{session.firstName} {session.lastName}</strong><span>Registrar</span></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item active" type="button">Athletes</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Athletes</strong></div><span className="role-chip">Registrar</span></header><section className="registrar-heading"><div><h2>Athletes</h2><p>{students.length} athletes</p></div></section><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, student ID, or program..." />{loading && <div className="dashboard-state">Loading athletes...</div>}{error && <div className="dashboard-state error-message">{error}</div>}{!loading && !error && <div className="data-list">{students.length ? students.map((student) => <article className="data-row" key={student.athleteId}><strong>{student.firstName} {student.lastName}</strong><span>{student.studentNumber || 'Student ID pending'} · {student.course || 'Program not set'}</span><small>Year {student.yearLevel || '—'}</small></article>) : <p className="empty-copy">No athletes found.</p>}</div>}</div></main>
  }

  if (view === 'grades' && dashboard) {
    return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Dashboard</button><button className="nav-item active" type="button">Eligibility Review</button><button className="nav-item" type="button" onClick={() => setView('academic-records')}>Academic Records</button><button className="nav-item" type="button" onClick={() => setView('eligibility')}>Eligibility</button><button className="nav-item" type="button" disabled>Reports</button><button className="nav-item" type="button" disabled>Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Eligibility Review</strong></div><span className="role-chip">Registrar</span></header><GradeEntryPage students={dashboard.students || []} session={session} /></div></main>
  }

  if (view === 'academic-records' && dashboard) {
    return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Dashboard</button><button className="nav-item" type="button" onClick={() => setView('grades')}>Eligibility Review</button><button className="nav-item active" type="button">Academic Records</button><button className="nav-item" type="button" onClick={() => setView('eligibility')}>Eligibility</button><button className="nav-item" type="button" disabled>Reports</button><button className="nav-item" type="button" disabled>Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Academic Records</strong></div><span className="role-chip">Registrar</span></header><AcademicRecordsPage students={dashboard.students || []} /></div></main>
  }

  if (view === 'eligibility' && dashboard) {
    return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item" type="button" onClick={() => setView('dashboard')}>Dashboard</button><button className="nav-item" type="button" onClick={() => setView('grades')}>Eligibility Review</button><button className="nav-item" type="button" onClick={() => setView('academic-records')}>Academic Records</button><button className="nav-item active" type="button">Eligibility</button><button className="nav-item" type="button" disabled>Reports</button><button className="nav-item" type="button" disabled>Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Eligibility Verification</strong></div><span className="role-chip">Registrar</span></header><EligibilityPage students={dashboard.students || []} /></div></main>
  }

  return <main className="registrar-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>Monitoring System</small></div></div><div className="profile-block"><div className="avatar">{(session.firstName || 'R').slice(0, 1)}{(session.lastName || 'G').slice(0, 1)}</div><div className="profile-meta"><strong>{session.firstName} {session.lastName}</strong><span>Registrar</span></div></div><nav className="main-nav" aria-label="Registrar navigation"><button className="nav-item active" type="button" onClick={() => setView('dashboard')}>Dashboard</button><button className="nav-item" type="button" onClick={() => setView('grades')}>Eligibility Review</button><button className="nav-item" type="button" onClick={() => setView('academic-records')}>Academic Records</button><button className="nav-item" type="button" onClick={() => setView('eligibility')}>Eligibility</button><button className="nav-item" type="button" disabled>Reports</button><button className="nav-item" type="button" disabled>Profile</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="registrar-content"><header className="topbar"><div className="crumbs"><span>Registrar Portal</span><span className="sep">›</span><strong>Registrar Dashboard</strong></div><span className="role-chip">Registrar</span></header><section className="registrar-heading"><div><h2>Academic Records Overview</h2><p>Philippine Grading System (1.00–5.00) · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div><button className="coach-action" type="button" onClick={() => setView('grades')}>Review Eligibility</button></section>{loading && <div className="dashboard-state">Loading academic records from the database...</div>}{error && <div className="dashboard-state error-message">{error}</div>}{!loading && !error && <><section className="registrar-stats"><article className="registrar-stat red-accent"><span>Total Students</span><strong>{dashboard.totalStudents}</strong><small>Registered athletes</small></article><article className="registrar-stat purple-accent"><span>Avg GPA</span><strong>{dashboard.averageGpa ?? '—'}</strong><small>Overall average</small></article><article className="registrar-stat green-accent"><span>Eligible</span><strong>{dashboard.eligibleCount}</strong><small>GPA ≤ 3.00</small></article><article className="registrar-stat orange-accent"><span>Need Attention</span><strong>{dashboard.attentionCount}</strong><small>At risk / ineligible</small></article></section><section className="grading-reference"><strong>ⓘ Philippine Grading System — Registrar Reference</strong><div><span>1.00–1.25 = Excellent</span><span>1.50–1.75 = Very Good</span><span>2.00–2.25 = Good</span><span>2.50–3.00 = Passing</span><span>5.00 = Failed</span></div></section><section className="registrar-alerts"><div className="section-title"><strong>⚠ Academic Alerts — Students Needing Attention</strong></div>{dashboard.attentionStudents.length ? dashboard.attentionStudents.map((student) => <div className="registrar-student-row" key={student.athleteId}><div><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber} · {student.course || 'Program not set'}</small></div><span>{student.averageGrade ?? '—'}</span><em>{student.eligibilityStatus}</em><button type="button">Edit Grades</button></div>) : <p className="empty-copy">No students currently need attention.</p>}</section><section className="registrar-panel"><div className="panel-heading"><div><h3>All Academic Records</h3><p>Student records loaded from Athlete-Hub database</p></div><span className="role-chip">{students.length} shown</span></div><input className="registrar-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students by name, course, or ID..." /><div className="registrar-table">{students.map((student) => <div className="registrar-table-row" key={student.athleteId}><strong>{student.firstName} {student.lastName}</strong><span>{student.studentNumber}</span><span>{student.course || '—'}</span><span>{student.averageGrade ?? '—'}</span><span className={student.eligibilityStatus === 'ELIGIBLE' ? 'eligible-label' : 'attention-label'}>{student.eligibilityStatus}</span></div>)}</div></section></>}</div></main>
}

function PortfolioPage({ fullName, session, profile, records, loading, actionLoading, title, description, evidenceFiles, onTitleChange, onDescriptionChange, onFilesChange, onSubmit, onDelete }) {
  const verifiedCount = records.filter((item) => item.achievementStatus === 'VERIFIED' || item.achievementStatus === 'APPROVED').length
  const pendingCount = records.filter((item) => item.achievementStatus === 'PENDING').length
  const rejectedCount = records.filter((item) => item.achievementStatus === 'REJECTED').length
  const initials = `${(session.firstName || 'S').slice(0, 1)}${(session.lastName || 'A').slice(0, 1)}`

  const renderAchievement = (item) => {
    const rawStatus = item.verificationStatus || item.achievementStatus || 'PENDING'
    const status = String(rawStatus).toUpperCase()
    const isVerified = status === 'VERIFIED' || status === 'APPROVED'
    const isRejected = status === 'REJECTED'
    const displayStatus = isVerified ? 'Verified' : isRejected ? 'Rejected' : 'Pending'
    return (
      <article className="portfolio-achievement" key={item.portfolioItemId}>
        <div className="achievement-mark">★</div>
        <div className="achievement-copy">
          <div className="achievement-title-row">
            <h4>{item.title}</h4>
            <span className={`achievement-status ${displayStatus.toLowerCase()}`}>{displayStatus}</span>
          </div>
          <p>{item.description || 'Portfolio submission awaiting review.'}</p>
          {item.evidence?.length ? (
            <div className="evidence-links">
              {item.evidence.map((evidence) => (
                <a
                  key={evidence.documentId}
                  href={`${API_BASE_URL}${evidence.fileUrl}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {evidence.documentName}
                </a>
              ))}
            </div>
          ) : null}
          <small>{item.achievementDate ? formatEventDate(item.achievementDate) : 'Date not provided'}</small>
        </div>
        {!isVerified && !isRejected && (
          <button className="achievement-delete" type="button" disabled={actionLoading} onClick={() => onDelete(item)}>
            Delete
          </button>
        )}
      </article>
    )
  }

  return <section className="portfolio-page">
    <div className="portfolio-heading"><h2>Athletic Portfolio</h2><p>Comprehensive digital portfolio for {fullName}</p></div>
    <section className="portfolio-identity"><div className="portfolio-top"><div className="portfolio-avatar">{initials}</div><div className="portfolio-name-block"><h3>{fullName}</h3><p>{profile?.course || 'Student-Athlete'} · Athlete-Hub portfolio</p><div className="portfolio-meta-row"><span>{session.email}</span><span>{profile?.studentNumber || 'Student ID pending'}</span></div></div></div><div className="portfolio-info-grid"><div><span>Student ID</span><strong>{profile?.studentNumber || '—'}</strong></div><div><span>Academic Year</span><strong>{profile?.yearLevel || '—'}</strong></div><div><span>Program</span><strong>{profile?.course || '—'}</strong></div><div><span>University</span><strong>{session.universityId || '—'}</strong></div></div></section>
    <section className="portfolio-summary"><div className="summary-box"><span className="summary-icon gold">★</span><strong>{records.length}</strong><small>Total submissions</small></div><div className="summary-box"><span className="summary-icon green">✓</span><strong>{verifiedCount}</strong><small>Verified achievements</small></div><div className="summary-box"><span className="summary-icon purple">◷</span><strong>{pendingCount}</strong><small>Awaiting review</small></div><div className="summary-box"><span className="summary-icon pink">!</span><strong>{rejectedCount}</strong><small>Needs changes</small></div></section>
    <section className="portfolio-workspace"><div className="portfolio-section-heading"><div><h3>Achievements &amp; Awards</h3><p>Submit your accomplishments for coach verification.</p></div><span className="portfolio-count">{records.length} entries</span></div>
      <form className="portfolio-submit-form" onSubmit={onSubmit}><div><label htmlFor="achievement-title">Achievement title</label><input id="achievement-title" value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="e.g. Regional Basketball Championship" required /></div><div><label htmlFor="achievement-description">Description or evidence notes</label><textarea id="achievement-description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Describe the achievement and supporting evidence" rows="3" /></div><div><label htmlFor="achievement-evidence">Evidence files</label><div className="file-picker"><input id="achievement-evidence" className="file-picker-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" multiple onChange={(event) => { onFilesChange([...evidenceFiles, ...Array.from(event.target.files || [])]); event.target.value = '' }} /><label className="add-file-button" htmlFor="achievement-evidence"><span aria-hidden="true">+</span> Add files</label><small>{evidenceFiles.length ? `${evidenceFiles.length} file(s) selected` : 'Attach photos, certificates, or supporting files.'}</small></div>{evidenceFiles.length > 0 && <div className="staged-files">{evidenceFiles.map((file, index) => <div className="staged-file" key={`${file.name}-${file.lastModified}-${index}`}><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div><button className="text-button" type="button" onClick={() => onFilesChange(evidenceFiles.filter((_, fileIndex) => fileIndex !== index))}>Remove</button></div>)}</div>}</div><button type="submit" disabled={actionLoading}>{actionLoading ? 'Submitting...' : 'Submit for approval'}</button></form>
      <div className="portfolio-achievements">{loading ? <p>Loading portfolio...</p> : records.length ? records.map(renderAchievement) : <p className="empty-copy">No portfolio submissions yet. Add your first achievement above.</p>}</div>
    </section>
  </section>
}

function AttendancePage({ teams = [], session }) {
  const [trainingSessions, setTrainingSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingAthleteId, setSavingAthleteId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/Training/sessions`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => [])
        if (!response.ok) throw new Error(result?.message || 'Unable to load training sessions.')
        setTrainingSessions(result)
        if (result.length) setSelectedSessionId(String(result[0].trainingSessionId))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session.token])

  useEffect(() => {
    if (!selectedSessionId) return
    setError('')
    fetch(`${API_BASE_URL}/api/Training/sessions/${selectedSessionId}/attendance`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => [])
        if (!response.ok) throw new Error(result?.message || 'Unable to load attendance.')
        setAttendance(Object.fromEntries(result.map((item) => [item.athleteId, item.attendanceStatus])))
      })
      .catch((err) => setError(err.message))
  }, [selectedSessionId, session.token])

  const selectedSession = trainingSessions.find((item) => String(item.trainingSessionId) === String(selectedSessionId))
  const athletes = teams.find((team) => team.teamId === selectedSession?.teamId)?.athletes || []

  const markAttendance = async (athleteId, status) => {
    setSavingAthleteId(athleteId)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Training/sessions/${selectedSessionId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ athleteId, attendanceStatus: status }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to save attendance.')
      setAttendance((current) => ({ ...current, [athleteId]: status }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingAthleteId(null)
    }
  }

  return <section className="attendance-page">
    <section className="attendance-heading"><div><h2>Attendance</h2><p>Mark athletes present, late, or absent for a training session.</p></div><span className="role-chip">{athletes.length} Athletes</span></section>
    <section className="coach-panel attendance-panel">
      <label className="attendance-session-select">Training session<select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} disabled={loading}><option value="">Select a training session</option>{trainingSessions.map((item) => <option key={item.trainingSessionId} value={item.trainingSessionId}>{item.title} · {item.trainingDate}</option>)}</select></label>
      {error && <p className="form-error">{error}</p>}
      {selectedSession && <div className="attendance-session-meta"><strong>{selectedSession.title}</strong><span>{selectedSession.teamName} · {selectedSession.trainingDate}</span></div>}
      {!loading && selectedSession && (athletes.length ? <div className="attendance-list">{athletes.map((athlete) => { const status = attendance[athlete.athleteId]; return <div className="attendance-row" key={athlete.athleteId}><div className="attendance-athlete"><div className="athlete-avatar">{(athlete.firstName || 'A').slice(0, 1)}{(athlete.lastName || 'A').slice(0, 1)}</div><div><strong>{athlete.firstName} {athlete.lastName}</strong><small>{athlete.studentNumber || 'Student ID pending'}</small></div></div><div className="attendance-actions"><button className={`attendance-button present ${status === 'PRESENT' ? 'selected' : ''}`} type="button" onClick={() => markAttendance(athlete.athleteId, 'PRESENT')} disabled={savingAthleteId === athlete.athleteId} aria-label={`Mark ${athlete.firstName} present`}>✓</button><button className={`attendance-button late ${status === 'LATE' ? 'selected' : ''}`} type="button" onClick={() => markAttendance(athlete.athleteId, 'LATE')} disabled={savingAthleteId === athlete.athleteId} aria-label={`Mark ${athlete.firstName} late`}>L</button><button className={`attendance-button absent ${status === 'ABSENT' ? 'selected' : ''}`} type="button" onClick={() => markAttendance(athlete.athleteId, 'ABSENT')} disabled={savingAthleteId === athlete.athleteId} aria-label={`Mark ${athlete.firstName} absent`}>×</button></div></div> })}</div> : <p className="empty-copy">No active athletes are assigned to this session’s team.</p>)}
      {!loading && !selectedSession && <p className="empty-copy">No training sessions found.</p>}
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
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectItem, setRejectItem] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
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

  const reviewAchievement = async (item, status, reason = '') => {
    try {
      // API endpoint is /verify so it likely expects VERIFIED/REJECTED
      const apiStatus = status === 'APPROVED' ? 'VERIFIED' : status
      const response = await fetch(`${API_BASE_URL}/api/Portfolio/${item.portfolioItemId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ status: apiStatus, rejectionReason: status === 'REJECTED' ? reason : null }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to review achievement.')
      // FORCE correct status: REJECTED always wins, otherwise trust API or default to VERIFIED
      const newStatus = status === 'REJECTED' ? 'REJECTED' : (result?.status || result?.verificationStatus || 'VERIFIED')
      setPortfolio((current) => {
        if (!current) return current
        const items = current.items.map((entry) =>
          entry.portfolioItemId === item.portfolioItemId ? { ...entry, verificationStatus: newStatus, achievementStatus: newStatus } : entry
        )
        return { ...current, items }
      })
      setRefreshKey((value) => value + 1)
      setShowRejectModal(false)
      setRejectItem(null)
      setRejectReason('')
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
    String(item.status).toUpperCase() === 'ELIGIBLE'
  )?.count || 0
  const attentionCount = Math.max((dashboard?.athleteCount || 0) - eligibleCount, 0)
  const coachName = `${session.firstName || (isDirector ? 'Director' : 'Coach')} ${session.lastName || ''}`.trim()
  const upcomingScheduleRecords = scheduleRecords
  const pendingPortfolioItems = (dashboard?.portfolioItems || []).filter((item) =>
    item && String(item.verificationStatus || item.achievementStatus || 'PENDING').toUpperCase() === 'PENDING'
  )

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
          {!isDirector && <button className={`nav-item ${view === 'attendance' ? 'active' : ''}`} type="button" onClick={() => setView('attendance')}>Attendance</button>}
          <button className={`nav-item ${view === 'performance' ? 'active' : ''}`} type="button" onClick={() => setView('performance')}>Performance</button>
        </nav>

        <button className="logout-button" type="button" onClick={onLogout}>Logout</button>
      </aside>

      <div className="coach-content">
        <header className="topbar"><div className="crumbs"><span>{isDirector ? 'Director Portal' : 'Coach Portal'}</span><span className="sep">›</span><strong>{view === 'athletes' ? 'All Athletes' : view === 'schedule' ? 'Schedule' : view === 'attendance' ? 'Attendance' : view === 'performance' ? 'Performance' : `${isDirector ? 'Director' : 'Coach'} Dashboard`}</strong></div><span className="role-chip">{session.role}</span></header>
        {view === 'profile' && <AcademicEvaluationPanel athlete={selectedAthlete} session={session} />}
        {view === 'athletes' ? <CoachAthletesPage dashboard={dashboard} athletesOverride={isDirector ? directorAthletes : undefined} observer={isDirector} onViewProfile={viewProfile} /> : view === 'profile' ? <AthleteProfilePage athlete={selectedAthlete} portfolio={portfolio} loading={portfolioLoading} error={portfolioError} canReview={!isDirector} onBack={() => { setSelectedAthlete(null); setPortfolio(null); setView('athletes') }} onReview={reviewAchievement} onReject={(item) => { setRejectItem(item); setRejectReason(''); setShowRejectModal(true); }} /> : view === 'attendance' ? <AttendancePage teams={dashboard?.teams || []} session={session} /> : view === 'performance' ? <ErrorBoundary><PerformancePage athletes={isDirector ? (directorAthletes || []) : (dashboard?.teams || []).flatMap((team) => (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport })))} session={session} canEdit={!isDirector} /></ErrorBoundary> : view === 'schedule' ? <div className="coach-schedule-page"><section className="coach-heading"><div><h2>Schedule</h2><p>{isDirector ? 'Sports events for all athletes' : 'Training, sports events, and competitions for your assigned teams'}</p></div>{isDirector ? <button className="coach-action" type="button" onClick={() => setShowDirectorScheduleModal(true)}>+ Add Sports Event</button> : <button className="coach-action" type="button" onClick={() => setShowScheduleModal(true)}>+ Add Training Schedule</button>}</section>{scheduleError && <div className="dashboard-state error-message">{scheduleError}</div>}<CalendarPage records={scheduleRecords} loading={scheduleLoading} /></div> : <>
        <section className="coach-heading"><div><h2>Good morning, {session.firstName || 'Coach'}! <span>👋</span></h2><p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div>{!isDirector && <button className="coach-action" type="button" onClick={() => setShowScheduleModal(true)}>+ Add Training Schedule</button>}</section>

        {loading && <div className="dashboard-state">Loading coach data from the database...</div>}
        {error && <div className="dashboard-state error-message">{error}</div>}

        {!loading && !error && <>
          <section className="coach-stats-grid">
            <article className="coach-stat red-accent"><span>Total Athletes</span><strong>{dashboard?.athleteCount || 0}</strong><small>Under supervision</small></article>
            <article className="coach-stat green-accent"><span>Eligible</span><strong>{eligibleCount}</strong><small>GPA ≤ 3.00</small></article>
            <article className="coach-stat alert-accent"><span>Need Attention</span><strong>{attentionCount}</strong><small>Pending / at risk / ineligible</small></article>
          </section>

          {isDirector && pendingTrainingError && <div className="dashboard-state error-message">{pendingTrainingError}</div>}
          {isDirector && <DirectorTrainingReviewPanel sessions={pendingTrainingSessions} session={session} onReviewed={() => setRefreshKey((value) => value + 1)} />}

          <section className="eligibility-panel">
            <div className="section-title"><strong>⚠ Academic Eligibility Alerts</strong></div>
            {dashboard?.teams?.length ? dashboard.teams.map((team) => <div className="team-row" key={team.teamId}><div><strong>{team.teamName}</strong><small>{team.sport} · {team.athleteCount} athletes</small></div><span className="team-status">View team</span></div>) : <p className="empty-copy">No teams are assigned to this coach yet.</p>}
          </section>

          {!isDirector && <section className="coach-panel portfolio-quick-view">
            <div className="panel-heading schedule-panel-heading"><div><h3>Portfolio Verification</h3><p>Recent student submissions awaiting your review</p></div><span className="portfolio-count">{pendingPortfolioItems.length} pending</span></div>
            <div className="data-list">{pendingPortfolioItems.length ? pendingPortfolioItems.slice(0, 5).map((item) => <div className="portfolio-review-row" key={item.portfolioItemId}><div><strong className="portfolio-athlete-name">{item.athleteName || 'Student-athlete'}</strong><span className="portfolio-title">{item.title || 'Untitled portfolio submission'}</span><small>{item.studentNumber ? `${item.studentNumber} · ` : ''}{item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()) ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently submitted'}</small></div>{item.athleteId ? <button className="schedule-more-button" type="button" onClick={() => viewProfile({ athleteId: item.athleteId, firstName: item.athleteName || 'Student', lastName: '', studentNumber: item.studentNumber || '' })}>Review <span aria-hidden="true">→</span></button> : <span className="portfolio-missing-action">Unavailable</span>}</div>) : <p className="empty-copy">No portfolio submissions are waiting for review.</p>}</div>
          </section>}

          <section className="coach-panel upcoming-schedules-panel">
            <div className="panel-heading schedule-panel-heading"><div><h3>Upcoming Schedules</h3><p>Upcoming schedule in the next two weeks</p></div><button className="schedule-more-button" type="button" onClick={() => setView('schedule')} aria-label="See full schedule">See more <span aria-hidden="true">→</span></button></div>
            <div className="session-list">{upcomingScheduleRecords.length ? upcomingScheduleRecords.map((sessionItem) => <div className="session-row" key={sessionItem.id}><strong>{sessionItem.title}</strong>{sessionItem.approvalStatus && sessionItem.approvalStatus !== 'APPROVED' && <span className={`session-approval-status ${sessionItem.approvalStatus.toLowerCase()}`}>{sessionItem.approvalStatus === 'PENDING' ? 'Awaiting approval' : 'Rejected'}</span>}<small>{formatEventDate(sessionItem.startDate)} · {formatEventTime(sessionItem.startTime)}{sessionItem.endTime ? `–${formatEventTime(sessionItem.endTime)}` : ''}</small><span>{sessionItem.location || 'Location TBA'}</span>{sessionItem.rejectionReason && <small>Reason: {sessionItem.rejectionReason}</small>}</div>) : <p className="empty-copy">No upcoming training schedules in the next two weeks.</p>}</div>
          </section>

          <section className="coach-lower-grid">
            <div className="coach-panel"><div className="panel-heading"><div><h3>Team Overview</h3><p>Your assigned teams from Athlete-Hub</p></div></div><div className="team-cards">{dashboard?.teams?.map((team) => <article className="team-card" key={team.teamId}><span>{team.sport}</span><strong>{team.teamName}</strong><small>{team.athleteCount} athletes under supervision</small></article>)}</div></div>
          </section>
        </>}
        </>}
      </div>
      {showScheduleModal && <CoachScheduleModal teams={dashboard?.teams || []} session={session} onClose={() => setShowScheduleModal(false)} onCreated={() => { setShowScheduleModal(false); setRefreshKey((value) => value + 1) }} />}
      {showDirectorScheduleModal && <DirectorScheduleModal session={session} onClose={() => setShowDirectorScheduleModal(false)} onCreated={() => { setShowDirectorScheduleModal(false); setRefreshKey((value) => value + 1) }} />}
      {showRejectModal && rejectItem && (
        <div className="modal-backdrop" onClick={() => { setShowRejectModal(false); setRejectItem(null); setRejectReason(''); }}>
          <section className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>Reject Portfolio Submission</h2>
                <p>Are you sure you want to reject <strong>{rejectItem.title}</strong>?</p>
              </div>
            </div>
            <div className="schedule-form" style={{ paddingTop: 16 }}>
              <label>
                Rejection Reason <span className="required">*</span>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows="4"
                  required
                  style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #dce2ea', font: 'inherit', boxSizing: 'border-box' }}
                />
              </label>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => { setShowRejectModal(false); setRejectItem(null); setRejectReason(''); }}>Cancel</button>
                <button className="primary-button" type="button" onClick={() => reviewAchievement(rejectItem, 'REJECTED', rejectReason)} disabled={!rejectReason.trim()}>Reject Submission</button>
              </div>
            </div>
          </section>
        </div>
      )}
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
    const validEvidenceFiles = evidenceFiles.filter((file) => DOCUMENT_EXTENSIONS.includes(getExtension(file.name)) && file.size <= MAX_DOCUMENT_SIZE)
    if (!validEvidenceFiles.length) {
      setError('Add at least one evidence file before submitting this achievement.')
      return
    }
    if (validEvidenceFiles.length !== evidenceFiles.length) {
      setError('Remove unsupported or oversized evidence files before submitting.')
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
      const evidenceBody = new FormData()
      evidenceBody.append('documentType', 'Achievement Evidence')
      evidenceBody.append('achievementId', achievement.achievementId)
      validEvidenceFiles.forEach((file) => evidenceBody.append('files', file))
      const evidenceResponse = await fetch(`${API_BASE_URL}/api/Documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: evidenceBody,
      })
      const evidenceResult = await evidenceResponse.json().catch(() => null)
      if (!evidenceResponse.ok) throw new Error(evidenceResult?.message || 'Unable to upload evidence files.')
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

function AdminDashboard({ session, onLogout }) {
  const emptyForm = { roleId: '1', universityId: '', email: '', password: '', firstName: '', middleName: '', lastName: '', phone: '', accountStatus: 'ACTIVE' }
  const [dashboard] = useState(null)
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingUser, setEditingUser] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState(null)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${session.token}` }
      const usersResponse = await fetch(`${API_BASE_URL}/api/Admin/users`, { headers })
      const usersResult = await usersResponse.json().catch(() => null)
      if (!usersResponse.ok) throw new Error(usersResult?.message || 'Unable to load users.')
      setUsers(usersResult.users || [])
    } catch (err) {
      setError(err.message || 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }, [session.token])

  useEffect(() => { loadData() }, [loadData])

  const openCreate = () => { setEditingUser(null); setForm(emptyForm); setError(''); setShowForm(true) }
  const openEdit = (user) => {
    setEditingUser(user)
    setForm({ roleId: String({ ATHLETE: 1, COACH: 2, DIRECTOR: 3, ADMIN: 4, REGISTRAR: 5 }[user.role] || 1), universityId: user.universityId || '', email: user.email || '', password: '', firstName: user.firstName || '', middleName: user.middleName || '', lastName: user.lastName || '', phone: user.phone || '', accountStatus: user.accountStatus || 'ACTIVE' })
    setError('')
    setShowForm(true)
  }

  const saveUser = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const isEditing = Boolean(editingUser)
      const body = isEditing
        ? { roleId: Number(form.roleId), universityId: form.universityId, email: form.email, password: form.password || null, firstName: form.firstName, middleName: form.middleName || null, lastName: form.lastName, phone: form.phone || null, accountStatus: form.accountStatus }
        : { roleId: Number(form.roleId), universityId: form.universityId, email: form.email, password: form.password, firstName: form.firstName, middleName: form.middleName || null, lastName: form.lastName, phone: form.phone || null }
      const response = await fetch(`${API_BASE_URL}/api/Admin/users${isEditing ? `/${editingUser.userId}` : ''}`, { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || `Unable to ${isEditing ? 'update' : 'create'} user.`)
      setShowForm(false)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete the account for ${user.firstName} ${user.lastName}?`)) return
    setDeletingUserId(user.userId)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Admin/users/${user.userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to delete user.')
      setUsers((current) => current.filter((item) => item.userId !== user.userId))
    } catch (err) {
      setError(err.message || 'Unable to delete user.')
    } finally {
      setDeletingUserId(null)
    }
  }

  const filteredUsers = users.filter((user) => `${user.firstName} ${user.lastName} ${user.email} ${user.universityId} ${user.role}`.toLowerCase().includes(search.toLowerCase()))

  if (String(session.role || '').toUpperCase() === 'ADMIN') {
    return <main className="admin-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>System Administration</small></div></div><div className="profile-block"><div className="avatar">{(session.firstName || 'A').slice(0, 1)}{(session.lastName || 'D').slice(0, 1)}</div><div className="profile-meta"><strong>{session.firstName} {session.lastName}</strong><span>Administrator</span></div></div><nav className="main-nav" aria-label="Admin navigation"><button className="nav-item active" type="button">Accounts</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="admin-content"><header className="topbar"><div className="crumbs"><span>Admin Portal</span><span className="sep">›</span><strong>Accounts</strong></div><span className="role-chip">ADMIN</span></header><section className="admin-heading"><div><h2>User Accounts</h2><p>Monitor and manage platform accounts.</p></div><button className="coach-action" type="button" onClick={openCreate}>+ Create User</button></section>{error && <div className="dashboard-state error-message">{error}</div>}{loading ? <div className="dashboard-state">Loading accounts...</div> : <section className="admin-panel"><div className="panel-heading"><div><h3>Accounts</h3><p>Search, edit, create, or delete user accounts.</p></div><span className="role-chip">{filteredUsers.length} shown</span></div><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users by name, email, ID, or role..." /><div className="admin-user-list">{filteredUsers.length ? filteredUsers.map((user) => <div className="admin-user-row" key={user.userId}><div><strong>{user.firstName} {user.lastName}</strong><small>{user.email} · {user.universityId}</small></div><span className={`admin-role ${String(user.role).toLowerCase()}`}>{user.role}</span><span className={`admin-status ${String(user.accountStatus).toLowerCase()}`}>{user.accountStatus}</span><div><button className="template-button" type="button" onClick={() => openEdit(user)}>Edit</button><button className="template-button" type="button" onClick={() => deleteUser(user)} disabled={deletingUserId === user.userId}>{deletingUserId === user.userId ? 'Deleting...' : 'Delete'}</button></div></div>) : <p className="empty-copy">No accounts found.</p>}</div></section>}</div>{showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><section className="modal-card admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-title"><div className="modal-heading"><div><h2 id="admin-user-title">{editingUser ? 'Edit User' : 'Create User'}</h2><p>{editingUser ? 'Update this account.' : 'Add a platform account.'}</p></div><button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label="Close">×</button></div><form className="admin-user-form" onSubmit={saveUser}><label>First name<input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label><label>Last name<input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label>University ID<input value={form.universityId} onChange={(event) => setForm({ ...form, universityId: event.target.value })} required /></label><label>Role<select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}><option value="1">ATHLETE</option><option value="2">COACH</option><option value="3">DIRECTOR</option><option value="4">ADMIN</option><option value="5">REGISTRAR</option></select></label><label>Status<select value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select></label><label className="full-width">Password{editingUser && <small> Leave blank to keep the current password.</small>}<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingUser} minLength="8" /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}</button></div></form></section></div>}</main>
  }
  const overview = dashboard?.overview || {}

  return <main className="admin-app"><aside className="sidebar"><div className="brand-block"><img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" /><div><h1>Athlete-Hub</h1><small>System Administration</small></div></div><div className="profile-block"><div className="avatar">{(session.firstName || 'A').slice(0, 1)}{(session.lastName || 'D').slice(0, 1)}</div><div className="profile-meta"><strong>{session.firstName} {session.lastName}</strong><span>Administrator</span></div></div><nav className="main-nav" aria-label="Admin navigation"><button className="nav-item active" type="button">Dashboard</button></nav><button className="logout-button" type="button" onClick={onLogout}>Logout</button></aside><div className="admin-content"><header className="topbar"><div className="crumbs"><span>Admin Portal</span><span className="sep">›</span><strong>Dashboard</strong></div><span className="role-chip">ADMIN</span></header><section className="admin-heading"><div><h2>System Administration</h2><p>Manage platform users and monitor system activity.</p></div><button className="coach-action" type="button" onClick={openCreate}>+ Create User</button></section>{error && <div className="dashboard-state error-message">{error}</div>}{loading ? <div className="dashboard-state">Loading administration data...</div> : <><section className="admin-stats"><article><span>Athletes</span><strong>{overview.totalAthletes || 0}</strong></article><article><span>Coaches</span><strong>{overview.totalCoaches || 0}</strong></article><article><span>Teams</span><strong>{overview.totalTeams || 0}</strong></article><article><span>Documents</span><strong>{overview.totalDocuments || 0}</strong></article><article><span>Achievements</span><strong>{overview.totalAchievements || 0}</strong></article></section><section className="admin-grid"><section className="admin-panel"><div className="panel-heading"><div><h3>User Accounts</h3><p>Manage roles, contact details, and account status.</p></div><span className="role-chip">{filteredUsers.length} shown</span></div><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users by name, email, ID, or role..." /><div className="admin-user-list">{filteredUsers.map((user) => <div className="admin-user-row" key={user.userId}><div><strong>{user.firstName} {user.lastName}</strong><small>{user.email} · {user.universityId}</small></div><span className={`admin-role ${String(user.role).toLowerCase()}`}>{user.role}</span><span className={`admin-status ${String(user.accountStatus).toLowerCase()}`}>{user.accountStatus}</span><button className="template-button" type="button" onClick={() => openEdit(user)}>Edit</button></div>)}</div></section><section className="admin-panel"><div className="panel-heading"><div><h3>Recent Activity</h3><p>Latest portfolio and achievement updates.</p></div></div><div className="admin-activity-list">{(dashboard?.recentActivities || []).map((item) => <div key={item.portfolioItemId}><strong>{item.title}</strong><span>{item.athleteName} · {item.achievementStatus}</span></div>)}</div></section></section></>}</div>{showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><section className="modal-card admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-title"><div className="modal-heading"><div><h2 id="admin-user-title">{editingUser ? 'Edit User' : 'Create User'}</h2><p>{editingUser ? 'Update this account.' : 'Add a platform account.'}</p></div><button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label="Close">×</button></div><form className="admin-user-form" onSubmit={saveUser}><label>First name<input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label><label>Last name<input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label>University ID<input value={form.universityId} onChange={(event) => setForm({ ...form, universityId: event.target.value })} required /></label><label>Role<select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}><option value="1">ATHLETE</option><option value="2">COACH</option><option value="3">DIRECTOR</option><option value="4">ADMIN</option><option value="5">REGISTRAR</option></select></label><label>Status<select value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select></label><label className="full-width">Password{editingUser && <small> Leave blank to keep the current password.</small>}<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingUser} minLength="8" /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}</button></div></form></section></div>}</main>
}

function renderDashboard({ session, isStudentRole, isDirectorRole, isCoachRole, isRegistrarRole, isAdminRole, email, password, error, loading, handleLogin, setSession, setEmail, setPassword }) {
  if (!session) {
    return (
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
    )
  }

  if (isStudentRole) {
    return <StudentPortal session={session} onLogout={() => setSession(null)} />
  }

  if (isDirectorRole) {
    return <DirectorDashboard session={session} onLogout={() => setSession(null)} />
  }

  if (isCoachRole) {
    return <CoachDashboard session={session} onLogout={() => setSession(null)} />
  }

  if (isRegistrarRole) {
    return <RegistrarDashboard session={session} onLogout={() => setSession(null)} />
  }

  if (isAdminRole) {
    return <AdminDashboard session={session} onLogout={() => setSession(null)} />
  }

  return (
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
  )
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
  const isDirectorRole = normalizedRole === 'DIRECTOR'
  const isCoachRole = normalizedRole === 'COACH'
  const isRegistrarRole = normalizedRole === 'REGISTRAR'
  const isAdminRole = normalizedRole === 'ADMIN'

  return (
    <div className="athletehub-shell">
      {renderDashboard({ session, isStudentRole, isDirectorRole, isCoachRole, isRegistrarRole, isAdminRole, email, password, error, loading, handleLogin, setSession, setEmail, setPassword })}
    </div>
  )
}

function AssignAthleteModal({ coach, session, onClose, onAssigned }) {
  const [athletes, setAthletes] = useState([])
  const [athleteId, setAthleteId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/Director/athletes`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.message || 'Unable to load athletes.')
        setAthletes(result?.athletes || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session.token])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!athleteId) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Director/coaches/${coach.coachId}/assign-athlete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ athleteId: Number(athleteId) }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to assign athlete.')
      onAssigned()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="assign-athlete-title"><div className="modal-heading"><div><h2 id="assign-athlete-title">Assign Athlete</h2><p>Add an athlete to {coach.firstName} {coach.lastName}.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><form className="schedule-form" onSubmit={handleSubmit}><label>Athlete<select value={athleteId} onChange={(event) => setAthleteId(event.target.value)} disabled={loading || saving} required><option value="">{loading ? 'Loading athletes...' : 'Select an athlete'}</option>{athletes.map((athlete) => <option key={athlete.athleteId} value={athlete.athleteId}>{athlete.firstName} {athlete.lastName} · {athlete.studentNumber}{athlete.currentCoach ? ` · ${athlete.currentCoach.teamName}` : ''}</option>)}</select></label>{error && <p className="error-message">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={loading || saving || !athleteId}>{saving ? 'Assigning...' : 'Assign Athlete'}</button></div></form></section></div>
}

function CoachProfilePage({ coach, profile, loading, error, onBack, onAssign }) {
  return <section className="athlete-profile-page"><div className="profile-page-heading"><button className="schedule-more-button" type="button" onClick={onBack}>← Back to coaches</button><button className="coach-action" type="button" onClick={onAssign}>+ Assign Athlete</button></div><section className="athlete-profile-hero"><div className="portfolio-avatar">{(coach?.firstName || 'C').slice(0, 1)}{(coach?.lastName || 'A').slice(0, 1)}</div><div><h2>{coach?.firstName} {coach?.lastName}</h2><p>{coach?.specialization || 'Coach'} · {coach?.email || 'Email unavailable'}</p></div></section><section className="athlete-profile-details"><div><span>Specialization</span><strong>{profile?.specialization || coach?.specialization || '—'}</strong></div><div><span>Phone</span><strong>{profile?.phone || coach?.phone || '—'}</strong></div><div><span>Assigned athletes</span><strong>{profile?.totalAssignedAthletes ?? coach?.assignedAthletesCount ?? 0}</strong></div><div><span>Teams</span><strong>{profile?.teams?.length || coach?.teams?.length || 0}</strong></div></section>{loading ? <section className="coach-panel"><p>Loading coach profile...</p></section> : error ? <section className="coach-panel"><p className="error-message">{error}</p></section> : <><section className="coach-panel"><div className="panel-heading"><div><h3>Assigned Teams</h3><p>Teams currently managed by this coach.</p></div></div><div className="team-cards">{profile?.teams?.length ? profile.teams.map((team) => <article className="team-card" key={team.teamId}><span>{team.status || 'Active'}</span><strong>{team.teamName}</strong><small>{team.athletesCount || 0} athletes</small></article>) : <p className="empty-copy">No teams assigned.</p>}</div></section><section className="coach-panel"><div className="panel-heading"><div><h3>Assigned Athletes</h3><p>Athletes currently assigned to this coach.</p></div></div><div className="data-list">{profile?.assignedAthletes?.length ? profile.assignedAthletes.map((athlete) => <div className="data-row" key={athlete.athleteId}><strong>{athlete.firstName} {athlete.lastName}</strong><span>{athlete.studentNumber || 'Student ID pending'} · {athlete.teamName || 'No team'}</span><small>{athlete.course || 'Program unavailable'}{athlete.yearLevel ? ` · Year ${athlete.yearLevel}` : ''}</small></div>) : <p className="empty-copy">No athletes assigned yet.</p>}</div></section></>}</section>
}

function DirectorDashboard({ session, onLogout }) {
  const [view, setView] = useState('dashboard')
  const [coaches, setCoaches] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState('')
  const [selectedCoach, setSelectedCoach] = useState(null)
  const [coachProfile, setCoachProfile] = useState(null)
  const [coachProfileLoading, setCoachProfileLoading] = useState(false)
  const [coachProfileError, setCoachProfileError] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scheduleRecords, setScheduleRecords] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [pendingTrainingSessions, setPendingTrainingSessions] = useState([])
  const [pendingTrainingError, setPendingTrainingError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showDirectorScheduleModal, setShowDirectorScheduleModal] = useState(false)

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

  const viewCoachProfile = async (coach) => {
    setSelectedCoach(coach)
    setCoachProfile(null)
    setCoachProfileError('')
    setCoachProfileLoading(true)
    setView('coach-profile')
    try {
      const response = await fetch(`${API_BASE_URL}/api/Director/coaches/${coach.coachId}`, { headers: { Authorization: `Bearer ${session.token}` } })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.message || 'Unable to load coach profile.')
      setCoachProfile(result)
    } catch (err) {
      setCoachProfileError(err.message || 'Unable to load coach profile.')
    } finally {
      setCoachProfileLoading(false)
    }
  }

  useEffect(() => {
    const loadCoaches = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/Director/coaches`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.message || 'Unable to load coaches.')
        setCoaches(data.coaches || [])
        const dashboardResponse = await fetch(`${API_BASE_URL}/api/DirectorDashboard`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        const dashboardData = await dashboardResponse.json().catch(() => null)
        if (!dashboardResponse.ok) throw new Error(dashboardData?.message || 'Unable to load director dashboard.')
        setDashboard(dashboardData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadCoaches()
  }, [session.token, refreshKey])

  useEffect(() => {
    const loadSchedule = async () => {
      setScheduleLoading(true)
      setScheduleError('')
      try {
        const response = await fetch(`${API_BASE_URL}/api/Schedules/staff`, { headers: { Authorization: `Bearer ${session.token}` } })
        const result = await response.json().catch(() => [])
        if (!response.ok) throw new Error(result?.message || 'Unable to load schedule.')
        setScheduleRecords(result.map((item) => ({ id: item.id, type: item.type, title: item.title, description: item.description, startDate: item.startDate, startTime: item.startTime, endTime: item.endTime, location: item.location, teamName: item.teamName })))
      } catch (err) {
        setScheduleError(err.message || 'Unable to load schedule.')
      } finally {
        setScheduleLoading(false)
      }
    }
    loadSchedule()
  }, [session.token, refreshKey])

  useEffect(() => {
    const loadPendingTraining = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/Training/pending`, { headers: { Authorization: `Bearer ${session.token}` } })
        const result = await response.json().catch(() => [])
        if (!response.ok) throw new Error(result?.message || 'Unable to load training approvals.')
        setPendingTrainingSessions(result)
      } catch (err) {
        setPendingTrainingError(err.message || 'Unable to load training approvals.')
      }
    }
    loadPendingTraining()
  }, [session.token, refreshKey])

  return (
    <main className="coach-app">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/athletehub-logo.png" alt="Athlete-Hub logo" />
          <div><h1>Athlete-Hub</h1><small>Monitoring System</small></div>
        </div>
        <div className="profile-block">
          <div className="avatar coach-avatar">{(session.firstName || 'D').slice(0, 1)}{(session.lastName || 'R').slice(0, 1)}</div>
          <div className="profile-meta"><strong>{session.firstName || 'Director'} {session.lastName || ''}</strong><span>Director</span></div>
        </div>
        <nav className="main-nav" aria-label="Director navigation">
          <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={`nav-item ${view === 'coaches' || view === 'coach-profile' ? 'active' : ''}`} type="button" onClick={() => setView('coaches')}>Coaches</button>
          <button className={`nav-item ${view === 'athletes' || view === 'profile' ? 'active' : ''}`} type="button" onClick={() => setView('athletes')}>All Athletes</button>
          <button className={`nav-item ${view === 'schedule' ? 'active' : ''}`} type="button" onClick={() => setView('schedule')}>Schedule</button>
          <button className={`nav-item ${view === 'performance' ? 'active' : ''}`} type="button" onClick={() => setView('performance')}>Performance</button>
          <a className="nav-item" href="#">Messages <span className="dot-badge">1</span></a>
          <a className="nav-item" href="#">Reports</a>
          <a className="nav-item" href="#">Profile</a>
        </nav>
        <button className="logout-button" type="button" onClick={onLogout}>Logout</button>
      </aside>
      <div className="coach-content">
        <header className="topbar"><div className="crumbs"><span>Director Portal</span><span className="sep">›</span><strong>{view === 'athletes' ? 'All Athletes' : view === 'profile' ? 'Athlete Profile' : view === 'coach-profile' ? 'Coach Profile' : view === 'schedule' ? 'Schedule' : view === 'performance' ? 'Performance' : 'Dashboard'}</strong></div><span className="role-chip">{session.role}</span></header>
        {view === 'profile' && <AcademicEvaluationPanel athlete={selectedAthlete} session={session} />}
        {view === 'athletes' ? <CoachAthletesPage dashboard={dashboard} athletesOverride={directorAthletes} observer onViewProfile={viewProfile} /> : view === 'profile' ? <AthleteProfilePage athlete={selectedAthlete} portfolio={portfolio} loading={portfolioLoading} error={portfolioError} canReview={false} onBack={() => { setSelectedAthlete(null); setPortfolio(null); setView('athletes') }} /> : view === 'coach-profile' ? <CoachProfilePage coach={selectedCoach} profile={coachProfile} loading={coachProfileLoading} error={coachProfileError} onBack={() => { setSelectedCoach(null); setCoachProfile(null); setView('coaches') }} onAssign={() => setShowAssignModal(true)} /> : view === 'schedule' ? <div className="coach-schedule-page"><section className="coach-heading"><div><h2>Schedule</h2><p>Sports events, competitions, and approved training sessions</p></div><button className="coach-action" type="button" onClick={() => setShowDirectorScheduleModal(true)}>+ Add Sports Event</button></section>{scheduleError && <div className="dashboard-state error-message">{scheduleError}</div>}<DirectorTrainingReviewPanel sessions={pendingTrainingSessions} session={session} onReviewed={() => setRefreshKey((value) => value + 1)} /><CalendarPage records={scheduleRecords} loading={scheduleLoading} /></div> : view === 'performance' ? <ErrorBoundary><PerformancePage athletes={directorAthletes} session={session} canEdit={false} /></ErrorBoundary> : view === 'dashboard' ? <><section className="coach-heading"><div><h2>Director Dashboard</h2><p>Monitor athletes, schedules, coaches, and training approvals.</p></div></section><section className="coach-stats-grid"><article className="coach-stat red-accent"><span>Total Athletes</span><strong>{dashboard?.athleteCount || 0}</strong><small>Across all teams</small></article><article className="coach-stat green-accent"><span>Coaches</span><strong>{coaches.length}</strong><small>Coach accounts</small></article><article className="coach-stat alert-accent"><span>Training Approvals</span><strong>{pendingTrainingSessions.length}</strong><small>Awaiting review</small></article></section><section className="coach-panel"><div className="panel-heading"><div><h3>Training approvals</h3><p>Coach-submitted sessions must be approved before athletes can see them.</p></div></div><DirectorTrainingReviewPanel sessions={pendingTrainingSessions} session={session} onReviewed={() => setRefreshKey((value) => value + 1)} /></section></> : <><section className="coach-list-header"><div><h2>Coaches</h2><p>Manage coach accounts and view their assigned athletes</p></div><span className="role-chip">{coaches.length} Total</span></section>
        {loading ? <p>Loading coaches...</p> : error ? <p className="error-message">{error}</p> : <div className="athlete-cards">{coaches.length ? coaches.map(coach => <article className="athlete-card" key={coach.coachId}><div className="athlete-card-top"><div className="athlete-avatar">{(coach.firstName || 'C').slice(0, 1)}{(coach.lastName || 'A').slice(0, 1)}</div><div><strong>{coach.firstName} {coach.lastName}</strong><small>{coach.email || 'Email unavailable'}</small><span>🏆 {coach.specialization || 'Coach'}</span></div></div><div className="athlete-card-meta"><div><strong>{coach.assignedAthletesCount || 0}</strong><small>Assigned athletes</small></div><div><strong>{coach.teams?.length || 0}</strong><small>Teams</small></div></div><div className="athlete-card-footer"><span>{coach.teams?.[0]?.teamName || 'No team assigned'}</span><div><button type="button" onClick={() => viewCoachProfile(coach)}>View Profile</button></div></div></article>) : <div className="dashboard-state"><p className="empty-copy">No coach accounts found.</p></div>}</div>}
        </>}
      </div>
      {showAssignModal && selectedCoach && <AssignAthleteModal coach={selectedCoach} session={session} onClose={() => setShowAssignModal(false)} onAssigned={() => { setShowAssignModal(false); viewCoachProfile(selectedCoach) }} />}
      {showDirectorScheduleModal && <DirectorScheduleModal session={session} onClose={() => setShowDirectorScheduleModal(false)} onCreated={() => { setShowDirectorScheduleModal(false); setRefreshKey((value) => value + 1) }} />}
    </main>
  )
}

export default App
