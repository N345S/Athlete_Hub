import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate } from '../../lib/format.js'
import { useToast } from '../../components/toast.jsx'
import { Alert, Card, EmptyState, Field, Loading, Modal, PageHeader, StatusBadge } from '../../components/ui.jsx'

const SCALE = [
  [1, 'Strongly disagree'],
  [2, 'Disagree'],
  [3, 'Neutral'],
  [4, 'Agree'],
  [5, 'Strongly agree'],
]
const MAX_COMMENT_LENGTH = 2000

const termLabel = (evaluation) => `${evaluation.term.semester} ${evaluation.term.academicYear}`
const coachLine = (evaluation) => `Coach ${evaluation.coachName}${evaluation.teamName ? ` · ${evaluation.teamName}` : ''}`

/** The evaluation form, or (once submitted) the student's own answers, read-only. */
function EvaluationModal({ evaluation, questions, session, onClose, onSubmitted }) {
  const submitted = evaluation.status === 'SUBMITTED'
  const [ratings, setRatings] = useState(evaluation.ratings || {})
  const [comments, setComments] = useState(evaluation.comments || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const answered = questions.filter((question) => ratings[question.key]).length

  const submit = async (event) => {
    event.preventDefault()
    if (answered < questions.length) {
      setError(`Rate every statement before submitting (${questions.length - answered} left).`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post(`/api/CoachEvaluations/${evaluation.coachEvaluationId}`, { ratings, comments: comments.trim() || null }, session.token)
      onSubmitted()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={submitted ? 'Your evaluation' : 'Evaluate your coach'}
      subtitle={`${coachLine(evaluation)} · ${termLabel(evaluation)}`}
      onClose={onClose}
      size="lg"
      closeOnBackdrop={submitted}
      footer={submitted
        ? <button className="btn btn-secondary" type="button" onClick={onClose}>Close</button>
        : <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="coach-evaluation-form" disabled={saving}>{saving ? 'Submitting…' : `Submit evaluation (${answered}/${questions.length})`}</button>
        </>}
    >
      <form id="coach-evaluation-form" onSubmit={submit}>
        {!submitted && <Alert tone="info">Your answers are anonymous: the Sports Director sees averages and comments, never your name. You can submit once.</Alert>}
        {questions.map((question) => (
          <fieldset className="rating-question" key={question.key} disabled={submitted}>
            <legend>{question.text}</legend>
            <div className="rating-scale">
              {SCALE.map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name={question.key} value={value} checked={ratings[question.key] === value} onChange={() => setRatings((current) => ({ ...current, [question.key]: value }))} />
                  <strong>{value}</strong>
                  <small>{label}</small>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <Field label="Comments" optional hint={submitted ? undefined : 'What should your coach keep doing or change?'}>
          <textarea rows="3" value={comments} onChange={(event) => setComments(event.target.value)} maxLength={MAX_COMMENT_LENGTH} readOnly={submitted} />
        </Field>
      </form>
      <Alert>{error}</Alert>
    </Modal>
  )
}

/**
 * Coach evaluation forms. One is sent for each of the student's team coaches when a semester's final grades
 * are released from the ICTD database.
 */
export default function CoachEvaluationsPage({ session, evaluations, onChanged }) {
  const toast = useToast()
  const [open, setOpen] = useState(null)
  const list = evaluations.data?.evaluations || []
  const pending = list.filter((item) => item.status === 'PENDING')
  const done = list.filter((item) => item.status === 'SUBMITTED')

  const row = (item) => (
    <li className="row" key={item.coachEvaluationId}>
      <div className="row-main">
        <strong>{coachLine(item)}</strong>
        <span>{termLabel(item)}</span>
        <small>{item.status === 'SUBMITTED' ? `Submitted ${formatDate(item.submittedAt)}` : `Sent ${formatDate(item.sentAt)}`}</small>
      </div>
      <div className="row-actions">
        <StatusBadge status={item.status} label={item.status === 'PENDING' ? 'To do' : undefined} />
        <button className={`btn btn-sm ${item.status === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setOpen(item)}>{item.status === 'PENDING' ? 'Evaluate' : 'View'}</button>
      </div>
    </li>
  )

  return (
    <>
      <PageHeader title="Coach evaluation" subtitle="Tell the Sports Director how your coach did this semester" />
      <Alert>{evaluations.error}</Alert>
      {evaluations.loading && !evaluations.data ? <Loading label="Loading evaluations…" /> : (
        <div className="stack">
          <Card title="To do" subtitle="Sent when a semester's final grades are released">
            {pending.length ? <ul className="row-list">{pending.map(row)}</ul>
              : <EmptyState icon="check" title="Nothing to evaluate" message="You'll be notified when final grades are released and your coach evaluation is ready." />}
          </Card>
          {done.length > 0 && <Card title="Submitted"><ul className="row-list">{done.map(row)}</ul></Card>}
        </div>
      )}
      {open && (
        <EvaluationModal
          evaluation={open}
          questions={evaluations.data?.questions || []}
          session={session}
          onClose={() => setOpen(null)}
          onSubmitted={() => { setOpen(null); toast.success('Thank you! Your evaluation was submitted.'); onChanged() }}
        />
      )}
    </>
  )
}
