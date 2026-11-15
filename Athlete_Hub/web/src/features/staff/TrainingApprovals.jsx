import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, formatTimeRange, localDateISO } from '../../lib/format.js'
import { useToast } from '../../components/toast.jsx'
import { useSeeMore } from '../../lib/lists.jsx'
import { Alert, Card, EmptyState, ReasonDialog, SeeAllLink } from '../../components/ui.jsx'

/**
 * Director queue of coach-submitted training sessions awaiting approval, soonest first (those expire first: a request
 * whose date passes without a decision expires on the server and drops out of this list).
 *
 * With `preview` (the dashboard) only the first few are shown and `onSeeAll` opens the full list on the Schedule page;
 * without it the list pages through with "See more".
 */
export default function TrainingApprovals({ sessions, session, onReviewed, preview, onSeeAll, id = 'training-approvals' }) {
  const toast = useToast()
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [error, setError] = useState('')
  const [paged, seeMore] = useSeeMore(sessions, 5)
  const shown = preview ? sessions.slice(0, preview) : paged
  const today = localDateISO()

  const review = async (item, status, rejectionReason = null) => {
    setBusyId(item.trainingSessionId)
    setError('')
    try {
      await api.put(`/api/Training/sessions/${item.trainingSessionId}/review?status=${status}`, { rejectionReason }, session.token)
      toast.success(status === 'APPROVED' ? `“${item.title}” approved and published to athletes.` : `“${item.title}” rejected. Coach ${item.coachName} has been notified.`)
      setRejecting(null)
      onReviewed()
    } catch (err) {
      setError(err.message)
      // The request may have expired or been withdrawn meanwhile; refresh so it drops out of the list.
      onReviewed()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="scroll-target" id={id} title="Training approvals"
      subtitle={preview ? 'Soonest first. Requests expire if their date passes before you decide.' : 'Coach-submitted sessions are published to athletes once approved. Unanswered requests expire when their date passes.'}
      actions={<span className={`badge ${sessions.length ? 'badge-warning' : 'badge-neutral'}`}>{sessions.length} pending</span>}>
      <Alert>{!rejecting && error}</Alert>
      {sessions.length ? <>
        <ul className="row-list">
          {shown.map((item) => (
            <li className="row" key={item.trainingSessionId}>
              <div className="row-main">
                <strong>{item.title}</strong>
                <span>{item.teamName}{item.sport ? ` · ${item.sport}` : ''} · Coach {item.coachName}</span>
                <small>{formatDate(item.trainingDate)} · {formatTimeRange(item.startTime, item.endTime)} · {item.location || 'Location TBA'}</small>
                {!preview && item.description && <small>{item.description}</small>}
              </div>
              <div className="row-actions">
                {item.trainingDate === today && <span className="badge badge-danger">Expires today</span>}
                <button className="btn btn-success btn-sm" type="button" disabled={busyId === item.trainingSessionId} onClick={() => review(item, 'APPROVED')}>Approve</button>
                <button className="btn btn-danger-outline btn-sm" type="button" disabled={busyId === item.trainingSessionId} onClick={() => { setError(''); setRejecting(item) }}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
        {preview ? <SeeAllLink total={sessions.length} shown={preview} label={`See all ${sessions.length} in Schedule`} onClick={onSeeAll} /> : seeMore}
      </> : preview
        // On the dashboard an empty queue should not take the top of the page.
        ? <p className="muted">Nothing waiting for your approval.</p>
        : <EmptyState icon="check" title="Nothing to review" message="No training sessions are waiting for approval." />}
      {rejecting && (
        <ReasonDialog
          title="Reject training session"
          message={`The coach will be notified that “${rejecting.title}” was rejected.`}
          busy={busyId === rejecting.trainingSessionId}
          error={error}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => review(rejecting, 'REJECTED', reason)}
        />
      )}
    </Card>
  )
}
