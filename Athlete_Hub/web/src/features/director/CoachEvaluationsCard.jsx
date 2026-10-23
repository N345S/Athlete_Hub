import { useState } from 'react'
import { formatDate } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import { Alert, Avatar, Card, EmptyState, Field, Loading } from '../../components/ui.jsx'

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

/** What students said about one coach, per semester: the averages, then each student's answers by name. */
export default function CoachEvaluationsCard({ coach, session }) {
  const { data, loading, error } = useApiData(`/api/CoachEvaluations/coach/${coach.coachId}`, session.token)
  const [picked, setPicked] = useState('')
  const terms = data?.terms || []
  const current = terms.find((item) => termLabel(item.term) === picked) || terms[0]

  return (
    <Card
      title="Student evaluations"
      subtitle="Sent automatically when the ICTD database releases a semester's final grades. 5 means strongly agree."
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
        <EmptyState icon="chat" title="No evaluations yet" message="Students receive the form once the ICTD database releases a semester's final grades." />
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
        {current.responses?.length > 0 && <>
          <h3 className="card-subheading">Responses</h3>
          <ul className="row-list evaluation-responses">
            {current.responses.map((response) => {
              const [firstName, ...rest] = response.athleteName.split(' ')
              return (
                <li className="row" key={`${response.athleteName}-${response.submittedAt}`}>
                  <div className="row-main">
                    <span className="evaluation-response-name">
                      <Avatar firstName={firstName} lastName={rest.join(' ')} size="sm" />
                      <strong>{response.athleteName}</strong>
                      <small>Submitted {formatDate(response.submittedAt)}</small>
                    </span>
                    {response.comments ? <span>“{response.comments}”</span> : <small className="muted">No comment</small>}
                    <details className="evaluation-response-answers">
                      <summary>See answers</summary>
                      <ul className="rating-results">
                        {data.questions.map((question) => (
                          <li key={question.key}>
                            <span>{question.text}</span>
                            <RatingBar value={response.ratings[question.key]} />
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                  <div className="row-actions"><RatingBar value={response.average} /></div>
                </li>
              )
            })}
          </ul>
        </>}
        {current.notSubmitted?.length > 0 && (
          <p className="evaluation-not-submitted"><strong>Not submitted yet:</strong> {current.notSubmitted.join(', ')}</p>
        )}
      </>}
    </Card>
  )
}
