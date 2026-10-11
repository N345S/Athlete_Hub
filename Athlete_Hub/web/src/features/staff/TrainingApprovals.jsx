import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, formatTimeRange } from '../../lib/format.js'
import { useToast } from '../../components/toast.jsx'
import { Alert, Card, EmptyState, ReasonDialog } from '../../components/ui.jsx'

/** Director queue of coach-submitted training sessions awaiting approval. */
export default function TrainingApprovals({ sessions, session, onReviewed }) {
  const toast = useToast()
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [error, setError] = useState('')

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
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Training approvals" subtitle="Coach-submitted sessions are published to athletes once approved." actions={<span className="badge badge-neutral">{sessions.length} pending</span>}>
      <Alert>{!rejecting && error}</Alert>
      {sessions.length ? (
        <ul className="row-list">
          {sessions.map((item) => (
            <li className="row" key={item.trainingSessionId}>
              <div className="row-main">
                <strong>{item.title}</strong>
                <span>{item.teamName}{item.sport ? ` · ${item.sport}` : ''} · Coach {item.coachName}</span>
                <small>{formatDate(item.trainingDate)} · {formatTimeRange(item.startTime, item.endTime)} · {item.location || 'Location TBA'}</small>
                {item.description && <small>{item.description}</small>}
              </div>
              <div className="row-actions">
                <button className="btn btn-success btn-sm" type="button" disabled={busyId === item.trainingSessionId} onClick={() => review(item, 'APPROVED')}>Approve</button>
                <button className="btn btn-danger-outline btn-sm" type="button" disabled={busyId === item.trainingSessionId} onClick={() => { setError(''); setRejecting(item) }}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon="check" title="Nothing to review" message="No training sessions are waiting for approval." />}
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
