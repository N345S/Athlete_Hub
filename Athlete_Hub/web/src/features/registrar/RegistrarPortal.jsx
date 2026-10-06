import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDateTime, fullName, longToday, matchesSearch } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { Alert, Avatar, Card, EmptyState, Field, Loading, PageHeader, SearchInput, StatCard, StatusBadge } from '../../components/ui.jsx'
import { PdfPreview } from '../staff/AthleteProfilePage.jsx'

const VIEWS = ['dashboard', 'requests', 'evaluations', 'students', 'notifications']
const TITLES = { dashboard: 'Dashboard', requests: 'Eligibility requests', evaluations: 'Evaluations', students: 'Students', notifications: 'Notifications' }
const REASONS = ['Failing Grades', 'Academic Requirement Not Met', 'Incomplete Academic Requirement', 'Other']

const termLabel = (item) => `${item.term.semester} ${item.term.academicYear}`

function EvaluationTable({ items, emptyTitle, emptyMessage, actionLabel, onOpen, showStatus }) {
  if (!items.length) return <EmptyState title={emptyTitle} message={emptyMessage} />
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Student</th><th>Student ID</th><th>Term</th>{showStatus ? <><th>Decision</th><th>Reasons</th></> : <th>Grade Evaluation</th>}<th><span className="visually-hidden">Action</span></th></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.eligibilityId}>
              <td>{fullName(item.student)}</td>
              <td>{item.student.studentNumber}</td>
              <td>{termLabel(item)}</td>
              {showStatus
                ? <><td><StatusBadge status={item.academicStatus} /></td><td>{item.reasons?.join(', ') || '—'}</td></>
                : <td>{item.document ? <span className="badge badge-success">PDF uploaded</span> : <span className="badge badge-neutral">Requested</span>}</td>}
              <td className="table-action"><button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(item)}>{typeof actionLabel === 'function' ? actionLabel(item) : actionLabel}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReviewPage({ evaluation, session, onBack, onUpdated }) {
  const [status, setStatus] = useState(evaluation.academicStatus === 'INELIGIBLE' ? 'INELIGIBLE' : 'ELIGIBLE')
  const [reasons, setReasons] = useState(evaluation.academicStatus === 'INELIGIBLE' ? evaluation.reasons || [] : [])
  const [remarks, setRemarks] = useState(evaluation.remarks || '')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  const toggleReason = (reason) => setReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason])

  const upload = async () => {
    setSaving(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const document = await api.post(`/api/Eligibility/${evaluation.eligibilityId}/document`, body, session.token)
      setFile(null)
      onUpdated({ ...evaluation, document })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api.post('/api/Eligibility/review', {
        athleteId: evaluation.athleteId,
        academicYear: evaluation.term.academicYear,
        semester: evaluation.term.semester,
        academicStatus: status,
        reasons: status === 'INELIGIBLE' ? reasons : [],
        remarks,
      }, session.token)
      onUpdated({ ...evaluation, academicStatus: result.academicStatus, reasons: result.reasons, remarks: result.remarks, reviewedAt: result.reviewedAt }, true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = evaluation.document && (status === 'ELIGIBLE' || reasons.length > 0)

  return (
    <>
      <button className="btn btn-ghost back-button" type="button" onClick={onBack}>← Back</button>
      <section className="profile-hero">
        <Avatar firstName={evaluation.student.firstName} lastName={evaluation.student.lastName} size="xl" />
        <div>
          <h1>{fullName(evaluation.student)}</h1>
          <p>{evaluation.student.studentNumber} · {evaluation.student.course || 'Program not set'} · {termLabel(evaluation)}</p>
        </div>
        <StatusBadge status={evaluation.academicStatus} />
      </section>
      <div className="stack">
        <Card title="1. Official Grade Evaluation" subtitle="Upload the Registrar-issued PDF listing every subject, grade, and semester.">
          {evaluation.document ? (
            <div className="row">
              <div className="row-main">
                <strong>{evaluation.document.documentName}</strong>
                <small>Uploaded {formatDateTime(evaluation.document.uploadedAt) || 'recently'}</small>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPreview(true)}>View PDF</button>
            </div>
          ) : (
            <div className="inline-form">
              <Field label="Grade Evaluation PDF" hint="PDF only, up to 10 MB.">
                <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </Field>
              <div className="inline-form-actions">
                <button className="btn btn-primary" type="button" onClick={upload} disabled={!file || saving}>{saving ? 'Uploading…' : 'Upload PDF'}</button>
              </div>
            </div>
          )}
        </Card>

        <Card title="2. Eligibility decision" subtitle="Record the result from the official evaluation. Individual grades are not entered here.">
          <form className="stack-sm" onSubmit={submit}>
            <fieldset className="choice-group" disabled={!evaluation.document}>
              <legend className="field-label">Decision</legend>
              <label className={`choice ${status === 'ELIGIBLE' ? 'selected' : ''}`}><input type="radio" name="decision" checked={status === 'ELIGIBLE'} onChange={() => { setStatus('ELIGIBLE'); setReasons([]) }} /> Eligible</label>
              <label className={`choice ${status === 'INELIGIBLE' ? 'selected' : ''}`}><input type="radio" name="decision" checked={status === 'INELIGIBLE'} onChange={() => setStatus('INELIGIBLE')} /> Ineligible</label>
            </fieldset>
            {status === 'INELIGIBLE' && (
              <fieldset className="choice-group" disabled={!evaluation.document}>
                <legend className="field-label">Reasons (select at least one)</legend>
                {REASONS.map((reason) => (
                  <label key={reason} className={`choice ${reasons.includes(reason) ? 'selected' : ''}`}><input type="checkbox" checked={reasons.includes(reason)} onChange={() => toggleReason(reason)} /> {reason}</label>
                ))}
              </fieldset>
            )}
            <Field label="Registrar remark" hint="Optional context shared with the coach and Sports Director.">
              <textarea rows="4" value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={1000} disabled={!evaluation.document} />
            </Field>
            {!evaluation.document && <Alert tone="info">Upload the Grade Evaluation PDF before recording a decision.</Alert>}
            <Alert>{error}</Alert>
            <div><button className="btn btn-primary" type="submit" disabled={saving || !canSubmit}>{saving ? 'Saving…' : 'Submit decision'}</button></div>
          </form>
        </Card>
      </div>
      {preview && <PdfPreview url={evaluation.document.fileUrl} token={session.token} onClose={() => setPreview(false)} />}
    </>
  )
}

export default function RegistrarPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [reviewingId, setReviewingId] = useState(null)
  const [search, setSearch] = useState('')
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const studentsData = useApiData('/api/RegistrarDashboard', session.token)
  const evaluationsData = useApiData('/api/Eligibility/registrar', session.token)

  const evaluations = evaluationsData.data?.evaluations || []
  const students = studentsData.data?.students || []
  const pending = evaluations.filter((item) => item.academicStatus === 'PENDING')
  const awaitingPdf = pending.filter((item) => !item.document)
  const readyForReview = pending.filter((item) => item.document)
  const completed = evaluations.filter((item) => item.academicStatus !== 'PENDING')
  const reviewing = evaluations.find((item) => item.eligibilityId === reviewingId)
  const searchFilter = (item) => matchesSearch(search, item.student.firstName, item.student.lastName, item.student.studentNumber)

  const navigate = (key) => {
    setReviewingId(null)
    setSearch('')
    setView(key)
  }

  const updateEvaluation = (updated, finished) => {
    evaluationsData.setData((current) => ({ ...current, evaluations: (current?.evaluations || []).map((item) => item.eligibilityId === updated.eligibilityId ? updated : item) }))
    if (finished) {
      setReviewingId(null)
      setView('evaluations')
    }
  }

  const loading = (studentsData.loading && !studentsData.data) || (evaluationsData.loading && !evaluationsData.data)
  const searchBar = <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search by name or student ID…" label="Search students" /></div>

  let content
  if (reviewing) {
    content = <ReviewPage key={reviewing.eligibilityId} evaluation={reviewing} session={session} onBack={() => setReviewingId(null)} onUpdated={updateEvaluation} />
  } else if (view === 'requests') {
    content = <>
      <PageHeader title="Eligibility requests" subtitle="Coach and Sports Director requests awaiting a Grade Evaluation or decision" />
      {searchBar}
      <Card><EvaluationTable items={pending.filter(searchFilter)} emptyTitle="No pending requests" actionLabel={(item) => item.document ? 'Review' : 'Upload PDF'} onOpen={(item) => setReviewingId(item.eligibilityId)} /></Card>
    </>
  } else if (view === 'evaluations') {
    content = <>
      <PageHeader title="Evaluations" subtitle="Completed Registrar eligibility decisions" />
      {searchBar}
      <Card><EvaluationTable items={completed.filter(searchFilter)} showStatus emptyTitle="No decisions yet" actionLabel="View" onOpen={(item) => setReviewingId(item.eligibilityId)} /></Card>
    </>
  } else if (view === 'students') {
    const latestByAthlete = new Map()
    evaluations.forEach((item) => { if (!latestByAthlete.has(item.athleteId)) latestByAthlete.set(item.athleteId, item) })
    const filteredStudents = students.filter((student) => matchesSearch(search, student.firstName, student.lastName, student.studentNumber, student.course))
    content = <>
      <PageHeader title="Students" subtitle="Student-athlete roster and latest eligibility status" />
      {searchBar}
      <Card>
        {filteredStudents.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Student</th><th>Student ID</th><th>Program</th><th>Latest evaluation</th></tr></thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const latest = latestByAthlete.get(student.athleteId)
                  return (
                    <tr key={student.athleteId}>
                      <td>{fullName(student)}</td>
                      <td>{student.studentNumber}</td>
                      <td>{student.course || '—'}</td>
                      <td>{latest ? <button className="link-button" type="button" onClick={() => setReviewingId(latest.eligibilityId)}><StatusBadge status={latest.academicStatus} /> {termLabel(latest)}</button> : <span className="muted">Not requested</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No students found" />}
      </Card>
    </>
  } else if (view === 'notifications') {
    content = <NotificationsPage session={session} onChanged={refreshUnread} />
  } else {
    content = <>
      <PageHeader title="Registrar dashboard" subtitle={longToday()} actions={<button className="btn btn-secondary" type="button" onClick={() => { studentsData.reload(); evaluationsData.reload() }}>Refresh</button>} />
      <div className="stat-grid">
        <StatCard label="Ready for decision" value={readyForReview.length} hint="Grade Evaluation uploaded" tone="info" />
        <StatCard label="Awaiting PDF" value={awaitingPdf.length} hint="Requests without a Grade Evaluation" tone="warning" />
        <StatCard label="Decided" value={completed.length} hint="Eligible or ineligible" tone="success" />
        <StatCard label="Students" value={students.length} hint="Registered athletes" />
      </div>
      <Card title="Ready for a decision" subtitle="Grade Evaluation received">
        <EvaluationTable items={readyForReview} emptyTitle="Nothing to decide" emptyMessage="Requests without a PDF are listed under Eligibility requests." actionLabel="Review" onOpen={(item) => setReviewingId(item.eligibilityId)} />
      </Card>
    </>
  }

  return (
    <AppLayout
      portal="Registrar Portal"
      roleLabel="Registrar"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'requests', label: 'Eligibility requests', badge: pending.length },
        { key: 'evaluations', label: 'Evaluations' },
        { key: 'students', label: 'Students' },
        { key: 'notifications', label: 'Notifications', badge: unread },
      ]}
      activeKey={view}
      pageTitle={reviewing ? 'Evaluation review' : TITLES[view]}
      onNavigate={navigate}
      onLogout={onLogout}
      unreadCount={unread}
    >
      <Alert>{studentsData.error || evaluationsData.error}</Alert>
      {loading ? <Loading label="Loading Registrar data…" /> : content}
    </AppLayout>
  )
}
