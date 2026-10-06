import { useEffect, useState } from 'react'
import { api, fetchFileUrl } from '../../lib/api.js'
import { formatDate, fullName } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import FileLink from '../../components/FileLink.jsx'
import { Alert, Avatar, Card, EmptyState, Field, Loading, Modal, ReasonDialog, StatusBadge } from '../../components/ui.jsx'

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

/** Inline viewer for a Grade Evaluation PDF fetched with the user's token. */
export function PdfPreview({ url, token, onClose }) {
  const [objectUrl, setObjectUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let created = ''
    let cancelled = false
    fetchFileUrl(url, token)
      .then((value) => { created = value; if (!cancelled) setObjectUrl(value) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true; if (created) URL.revokeObjectURL(created) }
  }, [url, token])

  return (
    <Modal title="Grade Evaluation PDF" onClose={onClose} size="xl">
      <Alert>{error}</Alert>
      {objectUrl ? <iframe className="pdf-frame" title="Grade Evaluation PDF" src={objectUrl} /> : !error && <Loading label="Loading PDF…" />}
    </Modal>
  )
}

function AcademicEligibilityCard({ athlete, session }) {
  const { data, loading, error, setData } = useApiData(`/api/Eligibility/athlete/${athlete.athleteId}`, session.token)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ academicYear: '', semester: SEMESTERS[0] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [preview, setPreview] = useState(null)
  const evaluations = data?.records || []
  const hasPending = evaluations.some((item) => item.academicStatus === 'PENDING')

  const request = async (event) => {
    event.preventDefault()
    if (!/^\d{4}-\d{4}$/.test(form.academicYear.trim())) {
      setFormError('Enter the academic year as YYYY-YYYY, e.g. 2026-2027.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const result = await api.post('/api/Eligibility/request', { athleteId: athlete.athleteId, academicYear: form.academicYear.trim(), semester: form.semester }, session.token)
      if (result.evaluation) {
        setData((current) => ({ ...current, records: [result.evaluation, ...(current?.records || []).filter((item) => item.eligibilityId !== result.evaluation.eligibilityId)] }))
      }
      setMessage(result.message || 'Grade Evaluation request sent to the Registrar.')
      setShowForm(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="Academic eligibility"
      subtitle="Registrar decisions based on the official Grade Evaluation"
      actions={!showForm && !hasPending && <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setMessage(''); setShowForm(true) }}>Request evaluation</button>}
    >
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>
      {showForm && (
        <form className="inline-form" onSubmit={request}>
          <Field label="Academic year"><input value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} placeholder="2026-2027" required /></Field>
          <Field label="Semester">
            <select value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })}>
              {SEMESTERS.map((semester) => <option key={semester}>{semester}</option>)}
            </select>
          </Field>
          <div className="inline-form-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send request'}</button>
          </div>
          <Alert>{formError}</Alert>
        </form>
      )}
      {loading && !data ? <Loading /> : evaluations.length ? (
        <ul className="row-list">
          {evaluations.map((item) => (
            <li className="row" key={item.eligibilityId}>
              <div className="row-main">
                <strong>{item.term.semester} {item.term.academicYear}</strong>
                {item.academicStatus === 'PENDING'
                  ? <span className="muted">{item.document ? 'Grade Evaluation received — awaiting Registrar decision.' : 'Waiting for the Registrar to upload the Grade Evaluation.'}</span>
                  : item.reviewedAt && <small>Reviewed {formatDate(item.reviewedAt)}</small>}
                {item.reasons?.length > 0 && <span>Reasons: {item.reasons.join(', ')}</span>}
                {item.remarks && <span>Registrar remark: {item.remarks}</span>}
              </div>
              <div className="row-actions">
                <StatusBadge status={item.academicStatus} />
                {item.document && item.academicStatus !== 'PENDING' && (
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPreview(item.document.fileUrl)}>View PDF</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No evaluations yet" message="Request a Grade Evaluation to get a Registrar eligibility decision." />}
      {preview && <PdfPreview url={preview} token={session.token} onClose={() => setPreview(null)} />}
    </Card>
  )
}

function PortfolioReview({ athlete, session, canReview }) {
  const { data, loading, error, reload } = useApiData(`/api/Portfolio/athlete/${athlete.athleteId}`, session.token)
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [actionError, setActionError] = useState('')
  const items = data?.items || []

  const review = async (item, status, rejectionReason = null) => {
    setBusyId(item.portfolioItemId)
    setActionError('')
    try {
      await api.put(`/api/Portfolio/${item.portfolioItemId}/verify`, { status, rejectionReason }, session.token)
      setRejecting(null)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Portfolio" subtitle="Achievements, evidence, and verification status">
      <Alert>{error || (!rejecting && actionError)}</Alert>
      {loading && !data ? <Loading label="Loading portfolio…" /> : items.length ? (
        <ul className="row-list">
          {items.map((item) => {
            const status = item.achievementStatus || item.verificationStatus || 'PENDING'
            return (
              <li className="row" key={item.portfolioItemId}>
                <div className="row-main">
                  <strong>{item.title}</strong>
                  <span>{item.description || 'No description provided.'}</span>
                  <small>{item.category ? `${item.category} · ` : ''}{item.achievementDate ? formatDate(item.achievementDate) : 'Date not provided'}</small>
                  {item.rejectionReason && status === 'REJECTED' && <small className="text-danger">Reason: {item.rejectionReason}</small>}
                  {item.evidence?.length > 0 && (
                    <div className="evidence-list">
                      {item.evidence.map((file) => <FileLink key={file.documentId} url={file.fileUrl} token={session.token}>{file.documentName}</FileLink>)}
                    </div>
                  )}
                </div>
                <div className="row-actions">
                  <StatusBadge status={status} />
                  {canReview && status === 'PENDING' && item.achievementId && <>
                    <button className="btn btn-success btn-sm" type="button" disabled={busyId === item.portfolioItemId} onClick={() => review(item, 'VERIFIED')}>Verify</button>
                    <button className="btn btn-danger-outline btn-sm" type="button" disabled={busyId === item.portfolioItemId} onClick={() => { setActionError(''); setRejecting(item) }}>Reject</button>
                  </>}
                </div>
              </li>
            )
          })}
        </ul>
      ) : <EmptyState title="No portfolio submissions" message="Achievements this athlete submits will appear here." />}
      {rejecting && (
        <ReasonDialog
          title="Reject portfolio submission"
          message={`The athlete will see this reason for “${rejecting.title}”.`}
          busy={busyId === rejecting.portfolioItemId}
          error={actionError}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => review(rejecting, 'REJECTED', reason)}
        />
      )}
    </Card>
  )
}

export default function AthleteProfilePage({ athlete, session, canReview, onBack }) {
  return (
    <>
      <button className="btn btn-ghost back-button" type="button" onClick={onBack}>← Back to athletes</button>
      <section className="profile-hero">
        <Avatar firstName={athlete.firstName} lastName={athlete.lastName} size="xl" />
        <div>
          <h1>{fullName(athlete)}</h1>
          <p>{athlete.studentNumber || 'Student ID pending'} · {athlete.sport || 'Athlete'}</p>
        </div>
      </section>
      <dl className="detail-grid">
        <div><dt>Program</dt><dd>{athlete.course || '—'}</dd></div>
        <div><dt>Year level</dt><dd>{athlete.yearLevel || '—'}</dd></div>
        <div><dt>Team</dt><dd>{athlete.teamName || 'No team assigned'}</dd></div>
        <div><dt>Attendance</dt><dd>{athlete.attendanceRate == null ? '—' : `${athlete.attendanceRate}%`}</dd></div>
      </dl>
      <div className="stack">
        <AcademicEligibilityCard athlete={athlete} session={session} />
        <PortfolioReview athlete={athlete} session={session} canReview={canReview} />
      </div>
    </>
  )
}
