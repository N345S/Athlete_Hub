import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, formatTimeRange, fullName, greeting, localDateISO, longToday, statusLabel, timeAgo } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView from '../../components/CalendarView.jsx'
import FileLink from '../../components/FileLink.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import Icon from '../../components/icons.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Avatar, Card, ConfirmDialog, EmptyState, Field, Loading, PageHeader, StatCard, StatusBadge } from '../../components/ui.jsx'
import { HELP } from '../../lib/help.js'
import MyPerformancePage from './MyPerformancePage.jsx'

const VIEWS = ['dashboard', 'schedule', 'performance', 'documents', 'portfolio', 'profile', 'notifications']
const TITLES = { dashboard: 'Dashboard', schedule: 'Schedule', performance: 'Performance', documents: 'Documents', portfolio: 'Portfolio', profile: 'Profile', notifications: 'Notifications' }
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
function FileDropZone({ files, onChange, label, required }) {
  const [dragging, setDragging] = useState(false)
  const add = (list) => onChange([...files, ...Array.from(list || [])])

  return (
    <div className="field">
      <span className="field-label">{label}{required && <span className="field-required" aria-hidden="true"> *</span>}</span>
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

/** First-run checklist so new athletes know what to do; hidden once complete or dismissed. */
function GettingStarted({ session, profile, documents, portfolio, onNavigate }) {
  const storageKey = `athletehub-checklist-dismissed-${session.userId}`
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1' } catch { return false }
  })
  const steps = [
    { done: Boolean(profile?.course && profile?.yearLevel && profile?.phone), label: 'Complete your profile', detail: 'Program, year level, and phone number', view: 'profile' },
    { done: documents.some((item) => item.documentType === 'Medical Clearance'), label: 'Upload your medical clearance', detail: 'Required before competing', view: 'documents' },
    { done: portfolio.length > 0, label: 'Add your first achievement', detail: 'Your coach verifies it using your evidence', view: 'portfolio' },
  ]
  const finished = steps.filter((step) => step.done).length
  if (!profile || dismissed || finished === steps.length) return null

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1') } catch { /* private mode: hide for this visit only */ }
    setDismissed(true)
  }

  return (
    <Card
      className="checklist-card"
      title="Getting started"
      subtitle={`${finished} of ${steps.length} done`}
      actions={<button className="btn btn-ghost btn-sm" type="button" onClick={dismiss}>Hide</button>}
    >
      <ol className="checklist">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'done' : ''}>
            <span className="checklist-mark" aria-hidden="true">{step.done && <Icon name="check" size={16} />}</span>
            <span className="checklist-copy">
              <strong>{step.label}<span className="visually-hidden">{step.done ? ' (completed)' : ' (not completed)'}</span></strong>
              <small>{step.done ? 'Done' : step.detail}</small>
            </span>
            {!step.done && <button className="btn btn-secondary btn-sm" type="button" onClick={() => onNavigate(step.view)}>Start</button>}
          </li>
        ))}
      </ol>
    </Card>
  )
}

function StudentDashboard({ session, profile, onNavigate }) {
  const evaluations = useApiData(profile?.athleteId ? `/api/Eligibility/athlete/${profile.athleteId}` : null, session.token)
  const upcoming = useApiData(`/api/Schedules/athlete?from=${localDateISO()}`, session.token, { initialData: [] })
  const portfolio = useApiData('/api/Portfolio/me', session.token, { initialData: [] })
  const documents = useApiData('/api/Documents/me', session.token, { initialData: [] })
  const updates = useApiData('/api/Notifications/me', session.token, { initialData: [] })
  const nextEvents = [...(upcoming.data || [])]
    .filter((item) => item.startDate >= localDateISO())
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`))
  const nextTraining = nextEvents.find((item) => item.type === 'TRAINING')
  const verified = (portfolio.data || []).filter((item) => ['VERIFIED', 'APPROVED'].includes(String(item.achievementStatus || item.verificationStatus).toUpperCase())).length
  const clearanceDocuments = (documents.data || []).filter((item) => item.documentType !== 'Achievement Evidence')
  const hasMedicalClearance = clearanceDocuments.some((item) => item.documentType === 'Medical Clearance')
  // Records arrive newest first; the latest decision is what determines eligibility today.
  const records = evaluations.data?.records || []
  const latestDecision = records.find((item) => item.academicStatus !== 'PENDING')
  const pendingRequest = records.find((item) => item.academicStatus === 'PENDING')
  const termOf = (item) => `${item.term.semester} ${item.term.academicYear}`

  return (
    <>
      <PageHeader title={`${greeting()}, ${session.firstName || 'Athlete'}`} subtitle={longToday()} />
      {latestDecision?.academicStatus === 'INELIGIBLE' && (
        <Alert tone="warning">The Registrar marked you ineligible for {termOf(latestDecision)}. Please coordinate with your coach.</Alert>
      )}
      <GettingStarted session={session} profile={profile} documents={documents.data || []} portfolio={portfolio.data || []} onNavigate={onNavigate} />
      <div className="stat-grid">
        <StatCard
          icon="check"
          label="Academic eligibility"
          value={latestDecision ? statusLabel(latestDecision.academicStatus) : pendingRequest ? 'Under review' : 'Not evaluated'}
          hint={latestDecision ? `Registrar decision · ${termOf(latestDecision)}` : pendingRequest ? `Requested for ${termOf(pendingRequest)}` : 'No Grade Evaluation requested yet'}
          tone={latestDecision?.academicStatus === 'ELIGIBLE' ? 'success' : latestDecision?.academicStatus === 'INELIGIBLE' ? 'danger' : 'info'}
        />
        <StatCard icon="calendar" label="Next training" value={nextTraining ? formatDate(nextTraining.startDate) : '—'} hint={nextTraining ? `${nextTraining.title} · ${formatTimeRange(nextTraining.startTime)}` : 'No upcoming session'} tone="brand" onClick={() => onNavigate('schedule')} />
        <StatCard icon="trophy" label="Verified achievements" value={verified} hint={`${(portfolio.data || []).length} submitted`} tone="warning" onClick={() => onNavigate('portfolio')} />
        <StatCard icon="file" label="Documents on file" value={clearanceDocuments.length} hint={hasMedicalClearance ? 'Medical clearance uploaded' : 'Medical clearance not uploaded yet'} tone={hasMedicalClearance ? 'info' : 'warning'} onClick={() => onNavigate('documents')} />
      </div>
      <div className="dashboard-grid">
        <Card title="Coming up" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => onNavigate('schedule')}>Full schedule →</button>}>
          {upcoming.loading && !upcoming.data?.length ? <Loading /> : nextEvents.length ? (
            <ul className="row-list">
              {nextEvents.slice(0, 5).map((item) => (
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
          ) : <EmptyState icon="calendar" title="Nothing scheduled" message="Approved training and events will appear here." />}
        </Card>
        <Card title="Latest updates" subtitle="Portfolio reviews, new events, and approved training" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => onNavigate('notifications')}>All notifications →</button>}>
          {(updates.data || []).length ? (
            <ul className="row-list">
              {updates.data.slice(0, 5).map((item) => (
                <li className="row" key={item.notificationId}>
                  <div className="row-main">
                    <strong className={item.isRead ? '' : 'text-brand'}>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{timeAgo(item.createdAt)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="bell" title="No updates yet" message="You'll be notified when your portfolio is reviewed or new events are scheduled." />}
        </Card>
        <Card title="Academic eligibility" subtitle="Registrar decisions from your official Grade Evaluation">
          <Alert>{evaluations.error}</Alert>
          {evaluations.loading && !evaluations.data ? <Loading /> : records.length ? (
            <ul className="row-list">
              {records.slice(0, 4).map((item) => (
                <li className="row" key={item.eligibilityId}>
                  <div className="row-main">
                    <strong>{termOf(item)}</strong>
                    {item.academicStatus === 'PENDING' && <span>The Registrar is reviewing your Grade Evaluation.</span>}
                    {item.reasons?.length > 0 && <span>Reasons: {item.reasons.join(', ')}</span>}
                    {item.remarks && <small>Registrar remark: {item.remarks}</small>}
                  </div>
                  <StatusBadge status={item.academicStatus} label={item.academicStatus === 'PENDING' ? 'Under review' : undefined} />
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="check" title="No decision yet" message="The Director of Sports requests a Grade Evaluation from the Registrar each term." />}
        </Card>
      </div>
    </>
  )
}

function DocumentsPage({ session }) {
  const toast = useToast()
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
      const count = files.length
      setMessage('Documents uploaded. Your coach and the Sports Director can now see them.')
      toast.success(`${count} file${count === 1 ? '' : 's'} uploaded.`)
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
      toast.success('Document deleted.')
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
      <PageHeader title="Documents" subtitle="Keep your clearance and consent forms on file — no approval needed" />
      <div className="stack">
        <Card title="Upload documents">
          <form className="form-grid" onSubmit={upload}>
            <Field label="Document type" required>
              <select value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}>
                {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Title" optional><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} placeholder="e.g. PRISAA 2027 requirements" /></Field>
            <Field label="Description" optional className="span-2"><textarea rows="2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What are these documents for?" /></Field>
            <div className="span-2"><FileDropZone label="Files" files={files} onChange={setFiles} /></div>
            <div className="span-2"><button className="btn btn-primary" type="submit" disabled={uploading || !files.length}><Icon name="upload" />{uploading ? 'Uploading…' : files.length ? `Upload ${files.length} file${files.length === 1 ? '' : 's'}` : 'Add files to upload'}</button></div>
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
                    <FileLink url={item.fileUrl} token={session.token} className="btn btn-ghost btn-sm">Open</FileLink>
                    <button className="btn btn-ghost btn-sm text-danger" type="button" onClick={() => setDeleting(item)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="file" title="No documents yet" message="Upload your clearance and consent forms above." />}
        </Card>
      </div>
      {deleting && <ConfirmDialog title="Delete document" message={`Delete “${deleting.title || deleting.documentName}”? This cannot be undone.`} confirmLabel="Delete" busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </>
  )
}

function PortfolioPage({ session, profile }) {
  const toast = useToast()
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
    if (!form.title.trim()) return setActionError('Enter the achievement title.')
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
      toast.success('Achievement submitted. Your coach will review it.')
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
      toast.success('Submission deleted.')
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
            <Field label="Achievement title" required className="span-2"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} placeholder="e.g. Regional Basketball Championship — 1st place" required /></Field>
            <Field label="Date achieved" optional><input type="date" max={localDateISO()} value={form.achievementDate} onChange={(event) => setForm({ ...form, achievementDate: event.target.value })} /></Field>
            <Field label="Category" optional>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="">Select a category</option>
                {ACHIEVEMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Description" optional className="span-2"><textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the achievement and the evidence attached" /></Field>
            <div className="span-2"><FileDropZone label="Evidence files" required files={files} onChange={setFiles} /></div>
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
          ) : <EmptyState icon="trophy" title="No submissions yet" message="Add your first achievement above." />}
        </Card>
      </div>
      {deleting && <ConfirmDialog title="Delete submission" message={`Delete “${deleting.title}” and its evidence files?`} confirmLabel="Delete" busy={saving} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </>
  )
}

function ProfilePage({ session, profile, onSaved }) {
  const toast = useToast()
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
      toast.success('Profile saved.')
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
    schedule: <>
      <PageHeader title="Schedule" subtitle="Approved training sessions, sports events, and competitions" />
      <Alert>{schedule.error}</Alert>
      <Card><CalendarView events={schedule.data || []} loading={schedule.loading} /></Card>
    </>,
    performance: <MyPerformancePage session={session} profile={profile.data} />,
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
        { key: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: 'dashboard' },
        { key: 'schedule', label: 'Schedule', icon: 'calendar' },
        { key: 'performance', label: 'Performance', shortLabel: 'Stats', icon: 'chart' },
        { key: 'documents', label: 'Documents', shortLabel: 'Docs', icon: 'file' },
        { key: 'portfolio', label: 'Portfolio', icon: 'trophy' },
        { key: 'profile', label: 'Profile', icon: 'user' },
        { key: 'notifications', label: 'Notifications', icon: 'bell', badge: unread },
      ]}
      activeKey={view}
      pageTitle={TITLES[view]}
      onNavigate={setView}
      onLogout={onLogout}
      unreadCount={unread}
      help={HELP.athlete[view]}
    >
      <Alert>{profile.error}</Alert>
      {pages[view]}
    </AppLayout>
  )
}
