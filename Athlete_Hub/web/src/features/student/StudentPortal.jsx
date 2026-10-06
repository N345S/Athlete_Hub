import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, formatTimeRange, fullName, greeting, localDateISO, longToday, statusLabel } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView from '../../components/CalendarView.jsx'
import FileLink from '../../components/FileLink.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { Alert, Avatar, Card, ConfirmDialog, EmptyState, Field, Loading, PageHeader, StatCard, StatusBadge } from '../../components/ui.jsx'

const VIEWS = ['dashboard', 'grades', 'schedule', 'documents', 'portfolio', 'profile', 'notifications']
const TITLES = { dashboard: 'Dashboard', grades: 'My grades', schedule: 'Schedule', documents: 'Documents', portfolio: 'Portfolio', profile: 'Profile', notifications: 'Notifications' }
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const DOCUMENT_TYPES = ['Medical Clearance', 'Consent Form', 'Enrollment Form', 'Athletic Eligibility Form', 'Other']
const ACHIEVEMENT_CATEGORIES = ['Competition', 'Award', 'Certification', 'Leadership', 'Academic', 'Other']

function fileProblem(file) {
  const extension = `.${file.name.split('.').pop().toLowerCase()}`
  if (!ALLOWED_EXTENSIONS.includes(extension)) return 'Unsupported file type'
  if (file.size > MAX_FILE_SIZE) return 'Larger than 10 MB'
  return ''
}

/** File picker with drag-and-drop that stages files and flags invalid ones before upload. */
function FileDropZone({ files, onChange, label }) {
  const [dragging, setDragging] = useState(false)
  const add = (list) => onChange([...files, ...Array.from(list || [])])

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <label
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files) }}
      >
        <input type="file" multiple accept={ALLOWED_EXTENSIONS.join(',')} onChange={(event) => { add(event.target.files); event.target.value = '' }} />
        <strong>Drop files here or click to browse</strong>
        <span>PDF, PNG, JPG, DOC, or DOCX · up to 10 MB each</span>
      </label>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, index) => {
            const problem = fileProblem(file)
            return (
              <li key={`${file.name}-${file.lastModified}-${index}`} className={problem ? 'invalid' : ''}>
                <span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB{problem ? ` · ${problem}` : ''}</small></span>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}>Remove</button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function StudentDashboard({ session, profile, onNavigate }) {
  const academics = useApiData(profile?.athleteId ? `/api/AcademicRecords/dashboard/${profile.athleteId}` : null, session.token)
  const upcoming = useApiData(`/api/Schedules/athlete?from=${localDateISO()}`, session.token, { initialData: [] })
  const portfolio = useApiData('/api/Portfolio/me', session.token, { initialData: [] })
  const nextEvent = [...(upcoming.data || [])]
    .filter((item) => item.startDate >= localDateISO())
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`))
  const nextTraining = nextEvent.find((item) => item.type === 'TRAINING')
  const verified = (portfolio.data || []).filter((item) => ['VERIFIED', 'APPROVED'].includes(String(item.achievementStatus || item.verificationStatus).toUpperCase())).length
  const eligibility = academics.data?.latestEligibility

  return (
    <>
      <PageHeader title={`${greeting()}, ${session.firstName || 'Athlete'}`} subtitle={longToday()} />
      {eligibility?.academicStatus === 'INELIGIBLE' && (
        <Alert tone="warning">The Registrar marked you ineligible for {eligibility.term.semester} {eligibility.term.academicYear}.{eligibility.remarks ? ` Remark: ${eligibility.remarks}` : ''} Please coordinate with your coach.</Alert>
      )}
      <div className="stat-grid">
        <StatCard label="Current GPA" value={academics.data?.averageGrade || '—'} hint="Academic performance" />
        <StatCard label="Enrolled units" value={academics.data?.totalUnits || '—'} hint="From your academic records" tone="info" />
        <StatCard label="Next training" value={nextTraining ? formatDate(nextTraining.startDate) : '—'} hint={nextTraining ? `${nextTraining.title} · ${formatTimeRange(nextTraining.startTime)}` : 'No upcoming session'} tone="success" />
        <StatCard label="Verified achievements" value={verified} hint={`${(portfolio.data || []).length} submitted`} tone="warning" />
      </div>
      <div className="dashboard-grid">
        <Card title="Coming up" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => onNavigate('schedule')}>Full schedule →</button>}>
          {upcoming.loading && !upcoming.data?.length ? <Loading /> : nextEvent.length ? (
            <ul className="row-list">
              {nextEvent.slice(0, 5).map((item) => (
                <li className="row" key={item.id}>
                  <div className="row-main">
                    <strong>{item.title}</strong>
                    <span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span>
                    <small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small>
                  </div>
                  <span className={`badge type-${String(item.type).toLowerCase()}`}>{statusLabel(item.type)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nothing scheduled" message="Approved training and events will appear here." />}
        </Card>
        <Card title="Academic eligibility" subtitle="Latest Registrar decision">
          {eligibility ? (
            <div className="row">
              <div className="row-main">
                <strong>{eligibility.term.semester} {eligibility.term.academicYear}</strong>
                {eligibility.remarks && <span>{eligibility.remarks}</span>}
              </div>
              <StatusBadge status={eligibility.academicStatus} />
            </div>
          ) : <EmptyState title="No decision yet" message="Your coach requests a Grade Evaluation from the Registrar each term." />}
        </Card>
      </div>
    </>
  )
}

function GradesPage({ session, profile }) {
  const { data, loading, error } = useApiData(profile?.athleteId ? `/api/AcademicRecords/dashboard/${profile.athleteId}` : null, session.token)
  const records = data?.records || []
  return (
    <>
      <PageHeader title="My grades" subtitle="Academic records from the Registrar" />
      <Alert>{error}</Alert>
      <Card>
        {loading || !profile ? <Loading /> : records.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Term</th><th>Subject</th><th className="numeric">Units</th><th className="numeric">Grade</th><th>Remarks</th></tr></thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.academicRecordId}>
                    <td>{item.term.semester} {item.term.academicYear}</td>
                    <td><strong>{item.subjectCode}</strong> · {item.subjectName}</td>
                    <td className="numeric">{item.units ?? '—'}</td>
                    <td className="numeric">{item.grade ?? 'Pending'}</td>
                    <td>{item.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No academic records" message="Grades recorded by the Registrar will appear here." />}
      </Card>
    </>
  )
}

function DocumentsPage({ session }) {
  const { data, loading, error, reload } = useApiData('/api/Documents/me', session.token, { initialData: [] })
  const [form, setForm] = useState({ documentType: DOCUMENT_TYPES[0], title: '', description: '' })
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const documents = (data || []).filter((item) => item.documentType !== 'Achievement Evidence')

  const upload = async (event) => {
    event.preventDefault()
    if (!files.length) return setActionError('Add at least one file.')
    if (files.some(fileProblem)) return setActionError('Remove the files marked as invalid first.')
    setUploading(true)
    setActionError('')
    setMessage('')
    try {
      const body = new FormData()
      body.append('documentType', form.documentType)
      body.append('title', form.title)
      body.append('description', form.description)
      files.forEach((file) => body.append('files', file))
      await api.post('/api/Documents', body, session.token)
      setFiles([])
      setForm({ ...form, title: '', description: '' })
      setMessage('Documents uploaded and awaiting review.')
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setActionError('')
    try {
      await api.del(`/api/Documents/${deleting.documentId}`, session.token)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  return (
    <>
      <PageHeader title="Documents" subtitle="Upload and track your clearance documents" />
      <div className="stack">
        <Card title="Upload documents">
          <form className="form-grid" onSubmit={upload}>
            <Field label="Document type">
              <select value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}>
                {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Title (optional)"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} placeholder="e.g. PRISAA 2027 requirements" /></Field>
            <Field label="Description (optional)" className="span-2"><textarea rows="2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What are these documents for?" /></Field>
            <div className="span-2"><FileDropZone label="Files" files={files} onChange={setFiles} /></div>
            <div className="span-2"><button className="btn btn-primary" type="submit" disabled={uploading || !files.length}>{uploading ? 'Uploading…' : `Upload ${files.length || ''} file${files.length === 1 ? '' : 's'}`}</button></div>
          </form>
          <Alert tone="success">{message}</Alert>
          <Alert>{actionError}</Alert>
        </Card>
        <Card title="My documents">
          <Alert>{error}</Alert>
          {loading && !documents.length ? <Loading /> : documents.length ? (
            <ul className="row-list">
              {documents.map((item) => (
                <li className="row" key={item.documentId}>
                  <div className="row-main">
                    <strong>{item.title || item.documentName}</strong>
                    <span>{item.documentType} · Uploaded {formatDate(item.uploadedAt)}</span>
                    {item.description && <small>{item.description}</small>}
                    {item.title && <small>File: {item.documentName}</small>}
                  </div>
                  <div className="row-actions">
                    <StatusBadge status={item.status} />
                    <FileLink url={item.fileUrl} token={session.token} className="btn btn-ghost btn-sm">Open</FileLink>
                    <button className="btn btn-ghost btn-sm text-danger" type="button" onClick={() => setDeleting(item)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No documents yet" message="Upload your clearance and consent forms above." />}
        </Card>
      </div>
      {deleting && <ConfirmDialog title="Delete document" message={`Delete “${deleting.title || deleting.documentName}”? This cannot be undone.`} confirmLabel="Delete" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </>
  )
}

function PortfolioPage({ session, profile }) {
  const { data, loading, error, reload } = useApiData('/api/Portfolio/me', session.token, { initialData: [] })
  const [form, setForm] = useState({ title: '', description: '', achievementDate: '', category: '' })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const items = data || []
  const statusOf = (item) => String(item.achievementStatus || item.verificationStatus || 'PENDING').toUpperCase()
  const counts = items.reduce((total, item) => ({ ...total, [statusOf(item)]: (total[statusOf(item)] || 0) + 1 }), {})

  const submit = async (event) => {
    event.preventDefault()
    if (!files.length) return setActionError('Attach at least one evidence file.')
    if (files.some(fileProblem)) return setActionError('Remove the files marked as invalid first.')
    setSaving(true)
    setActionError('')
    try {
      const body = new FormData()
      body.append('title', form.title.trim())
      body.append('description', form.description.trim())
      if (form.achievementDate) body.append('achievementDate', form.achievementDate)
      if (form.category) body.append('category', form.category)
      files.forEach((file) => body.append('files', file))
      await api.post('/api/Portfolio/submit', body, session.token)
      setForm({ title: '', description: '', achievementDate: '', category: '' })
      setFiles([])
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    setActionError('')
    try {
      await api.del(`/api/Portfolio/${deleting.portfolioItemId}`, session.token)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setSaving(false)
      setDeleting(null)
    }
  }

  return (
    <>
      <PageHeader title="Athletic portfolio" subtitle="Submit achievements with evidence for coach verification" />
      <section className="profile-hero">
        <Avatar firstName={session.firstName} lastName={session.lastName} size="xl" />
        <div>
          <h1>{fullName(session)}</h1>
          <p>{profile?.course || 'Student-athlete'} · {profile?.studentNumber || 'Student ID pending'}</p>
        </div>
      </section>
      <div className="stat-grid">
        <StatCard label="Submitted" value={items.length} />
        <StatCard label="Verified" value={(counts.VERIFIED || 0) + (counts.APPROVED || 0)} tone="success" />
        <StatCard label="Awaiting review" value={counts.PENDING || 0} tone="info" />
        <StatCard label="Needs changes" value={counts.REJECTED || 0} tone="danger" />
      </div>
      <div className="stack">
        <Card title="Submit an achievement">
          <form className="form-grid" onSubmit={submit}>
            <Field label="Achievement title" className="span-2"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} placeholder="e.g. Regional Basketball Championship — 1st place" required /></Field>
            <Field label="Date achieved"><input type="date" max={localDateISO()} value={form.achievementDate} onChange={(event) => setForm({ ...form, achievementDate: event.target.value })} /></Field>
            <Field label="Category">
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="">Select a category</option>
                {ACHIEVEMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Description" className="span-2"><textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the achievement and the evidence attached" /></Field>
            <div className="span-2"><FileDropZone label="Evidence files" files={files} onChange={setFiles} /></div>
            <div className="span-2"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for verification'}</button></div>
          </form>
          <Alert>{actionError}</Alert>
        </Card>
        <Card title="Achievements & awards" actions={<span className="badge badge-neutral">{items.length} entries</span>}>
          <Alert>{error}</Alert>
          {loading && !items.length ? <Loading /> : items.length ? (
            <ul className="row-list">
              {items.map((item) => {
                const status = statusOf(item)
                return (
                  <li className="row" key={item.portfolioItemId}>
                    <div className="row-main">
                      <strong>{item.title}</strong>
                      {item.description && <span>{item.description}</span>}
                      <small>{item.category ? `${item.category} · ` : ''}{item.achievementDate ? formatDate(item.achievementDate) : 'Date not provided'}</small>
                      {status === 'REJECTED' && item.rejectionReason && <small className="text-danger">Reason: {item.rejectionReason}</small>}
                      {item.evidence?.length > 0 && (
                        <div className="evidence-list">
                          {item.evidence.map((file) => <FileLink key={file.documentId} url={file.fileUrl} token={session.token}>{file.documentName}</FileLink>)}
                        </div>
                      )}
                    </div>
                    <div className="row-actions">
                      <StatusBadge status={status} />
                      {status !== 'VERIFIED' && status !== 'APPROVED' && <button className="btn btn-ghost btn-sm text-danger" type="button" onClick={() => setDeleting(item)}>Delete</button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : <EmptyState title="No submissions yet" message="Add your first achievement above." />}
        </Card>
      </div>
      {deleting && <ConfirmDialog title="Delete submission" message={`Delete “${deleting.title}” and its evidence files?`} confirmLabel="Delete" busy={saving} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </>
  )
}

function ProfilePage({ session, profile, onSaved }) {
  const [form, setForm] = useState(() => ({
    course: profile?.course || '',
    yearLevel: profile?.yearLevel ? String(profile.yearLevel) : '',
    birthDate: profile?.birthDate || '',
    phone: profile?.phone || '',
  }))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await api.put('/api/AthleteProfile/me', {
        course: form.course.trim() || null,
        yearLevel: form.yearLevel ? Number(form.yearLevel) : null,
        birthDate: form.birthDate || null,
        phone: form.phone.trim() || null,
      }, session.token)
      setMessage('Profile saved.')
      onSaved()
    } catch (err) {
      setError(err.data?.errors ? Object.values(err.data.errors).flat().join(' ') : err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <Loading label="Loading profile…" />

  return (
    <>
      <PageHeader title="Profile" subtitle="Your personal and academic information" />
      <div className="stack">
        <Card title="Account" subtitle="Managed by the school. Contact an administrator to change these.">
          <dl className="detail-grid">
            <div><dt>Name</dt><dd>{[profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ')}</dd></div>
            <div><dt>Email</dt><dd>{profile.email}</dd></div>
            <div><dt>Student ID</dt><dd>{profile.studentNumber}</dd></div>
            <div><dt>University ID</dt><dd>{session.universityId || '—'}</dd></div>
          </dl>
        </Card>
        <Card title="Details you can update">
          <form className="form-grid" onSubmit={submit}>
            <Field label="Program / course"><input value={form.course} onChange={update('course')} maxLength={150} placeholder="e.g. BS Information Technology" /></Field>
            <Field label="Year level">
              <select value={form.yearLevel} onChange={update('yearLevel')}>
                <option value="">Not set</option>
                {[1, 2, 3, 4, 5].map((year) => <option key={year} value={year}>Year {year}</option>)}
              </select>
            </Field>
            <Field label="Birth date"><input type="date" max={localDateISO()} value={form.birthDate} onChange={update('birthDate')} /></Field>
            <Field label="Phone"><input type="tel" value={form.phone} onChange={update('phone')} maxLength={30} placeholder="e.g. 0917 123 4567" /></Field>
            <div className="span-2"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
          </form>
          <Alert tone="success">{message}</Alert>
          <Alert>{error}</Alert>
        </Card>
      </div>
    </>
  )
}

export default function StudentPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const profile = useApiData('/api/AthleteProfile/me', session.token)
  const schedule = useApiData(view === 'schedule' ? '/api/Schedules/athlete' : null, session.token, { initialData: [] })

  const pages = {
    dashboard: <StudentDashboard session={session} profile={profile.data} onNavigate={setView} />,
    grades: <GradesPage session={session} profile={profile.data} />,
    schedule: <>
      <PageHeader title="Schedule" subtitle="Approved training sessions, sports events, and competitions" />
      <Alert>{schedule.error}</Alert>
      <Card><CalendarView events={schedule.data || []} loading={schedule.loading} /></Card>
    </>,
    documents: <DocumentsPage session={session} />,
    portfolio: <PortfolioPage session={session} profile={profile.data} />,
    profile: <ProfilePage key={profile.data ? 'loaded' : 'loading'} session={session} profile={profile.data} onSaved={profile.reload} />,
    notifications: <NotificationsPage session={session} onChanged={refreshUnread} />,
  }

  return (
    <AppLayout
      portal="Athlete Portal"
      roleLabel="Student-athlete"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'grades', label: 'My grades' },
        { key: 'schedule', label: 'Schedule' },
        { key: 'documents', label: 'Documents' },
        { key: 'portfolio', label: 'Portfolio' },
        { key: 'profile', label: 'Profile' },
        { key: 'notifications', label: 'Notifications', badge: unread },
      ]}
      activeKey={view}
      pageTitle={TITLES[view]}
      onNavigate={setView}
      onLogout={onLogout}
      unreadCount={unread}
    >
      <Alert>{profile.error}</Alert>
      {pages[view]}
    </AppLayout>
  )
}
