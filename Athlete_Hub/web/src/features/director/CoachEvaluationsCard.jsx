import { useState } from 'react'
import { useApiData } from '../../lib/hooks.js'
import { Alert, Card, EmptyState, Field, Loading } from '../../components/ui.jsx'

const termLabel = (term) => `${term.semester} ${term.academicYear}`

/** An average rating out of 5 as a bar, toned like attendance: 4+ good, 3+ fair, below 3 poor. */
function RatingBar({ value }) {
  if (value == null) return <span className="muted">—</span>
  const tone = value >= 4 ? 'success' : value >= 3 ? 'warning' : 'danger'
  return (
    <span className="progress" title={`${value.toFixed(2)} out of 5`}>
      <span className="progress-track"><span className={`progress-fill tone-${tone}`} style={{ width: `${(value / 5) * 100}%` }} /></span>
      <span className="progress-value">{value.toFixed(2)}</span>
    </span>
  )
}

/** What students said about one coach, per semester. Students' names are never shown. */
export default function CoachEvaluationsCard({ coach, session }) {
  const { data, loading, error } = useApiData(`/api/CoachEvaluations/coach/${coach.coachId}`, session.token)
  const [picked, setPicked] = useState('')
  const terms = data?.terms || []
  const current = terms.find((item) => termLabel(item.term) === picked) || terms[0]

  return (
    <Card
      title="Student evaluations"
      subtitle="Sent automatically when a semester's final grades are pulled from ICTD. Answers are anonymous; 5 means strongly agree."
      actions={terms.length > 1 && (
        <Field label="Semester">
          <select value={termLabel(current.term)} onChange={(event) => setPicked(event.target.value)}>
            {terms.map((item) => <option key={termLabel(item.term)}>{termLabel(item.term)}</option>)}
          </select>
        </Field>
      )}
    >
      <Alert>{error}</Alert>
      {loading && !data ? <Loading label="Loading evaluations…" /> : !current ? (
        <EmptyState icon="chat" title="No evaluations yet" message="Students receive the form once a semester's final grades are pulled from the ICTD database." />
      ) : <>
        <dl className="detail-grid">
          <div><dt>Semester</dt><dd>{termLabel(current.term)}</dd></div>
          <div><dt>Responses</dt><dd>{current.submitted} of {current.sent}</dd></div>
          <div><dt>Overall average</dt><dd><RatingBar value={current.overallAverage} /></dd></div>
        </dl>
        {current.averages ? (
          <ul className="rating-results">
            {data.questions.map((question) => (
              <li key={question.key}>
                <span>{question.text}</span>
                <RatingBar value={current.averages[question.key]} />
              </li>
            ))}
          </ul>
        ) : <EmptyState icon="clock" title="Waiting for answers" message={`${current.sent} student${current.sent === 1 ? ' has' : 's have'} the form but nobody has submitted it yet.`} />}
        {current.comments?.length > 0 && <>
          <h3 className="card-subheading">Comments</h3>
          <ul className="row-list">
            {current.comments.map((comment, index) => <li className="row" key={index}><span className="row-main"><span>“{comment}”</span></span></li>)}
          </ul>
        </>}
      </>}
    </Card>
  )
}
