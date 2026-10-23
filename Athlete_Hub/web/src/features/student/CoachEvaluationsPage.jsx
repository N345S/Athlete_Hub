import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate } from '../../lib/format.js'
import Icon from '../../components/icons.jsx'
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
export function EvaluationModal({ evaluation, questions, session, onClose, onSubmitted }) {
  const submitted = evaluation.status === 'SUBMITTED'
  const [ratings, setRatings] = useState(evaluation.ratings || {})
  const [comments, setComments] = useState(evaluation.comments || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const answered = questions.filter((question) => ratings[question.key]).length

  const submit = async (event) => {
    event.preventDefault()
    if (answered < questions.length) {
      setError(`Please answer every question before sending (${questions.length - answered} left).`)
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
        {!submitted && <Alert tone="info">The Sports Director sees your name with your answers and comment, so please be honest and respectful. You can submit once.</Alert>}
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
 * The dashboard's prompt to evaluate coaches, shown only while an evaluation is waiting. It stands out from the
 * rest of the dashboard without looking like an error, and each coach's form opens right from it.
 */
export function CoachEvaluationPrompt({ session, evaluations, onChanged }) {
  const toast = useToast()
  const [open, setOpen] = useState(null)
  const pending = (evaluations.data?.evaluations || []).filter((item) => item.status === 'PENDING')
  if (!pending.length) return null
  const terms = [...new Set(pending.map(termLabel))].join(' and ')

  return (
    <section className="evaluation-prompt scroll-target" id="coach-evaluation" aria-labelledby="coach-evaluation-title">
      <span className="evaluation-prompt-icon" aria-hidden="true"><Icon name="chat" size={22} /></span>
      <div className="evaluation-prompt-body">
        <span className="evaluation-prompt-tag">Action needed</span>
        <h2 id="coach-evaluation-title">Evaluate your coach{pending.length > 1 ? 'es' : ''}</h2>
        <p>Final grades for {terms} are out. Each form takes about two minutes, and the Sports Director will see your answers.</p>
        <ul className="evaluation-prompt-list">
          {pending.map((item) => (
            <li key={item.coachEvaluationId}>
              <span>
                <strong>Coach {item.coachName}</strong>
                <small>{item.teamName ? `${item.teamName} · ` : ''}{termLabel(item)}</small>
              </span>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => setOpen(item)}>Evaluate</button>
            </li>
          ))}
        </ul>
      </div>
      {open && (
        <EvaluationModal
          evaluation={open}
          questions={evaluations.data?.questions || []}
          session={session}
          onClose={() => setOpen(null)}
          onSubmitted={() => { setOpen(null); toast.success('Thank you! Your evaluation was submitted.'); onChanged() }}
        />
      )}
    </section>
  )
}

/**
 * Coach evaluation forms. It is not in the navigation: evaluations are prompted on the dashboard, which links
 * here to see past ones. One is sent for each of the student's team coaches when a semester's final grades
 * are released from the ICTD database.
 */
export default function CoachEvaluationsPage({ session, evaluations, onChanged, onBack }) {
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
      <button className="btn btn-ghost back-button" type="button" onClick={onBack}>← Back to dashboard</button>
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
