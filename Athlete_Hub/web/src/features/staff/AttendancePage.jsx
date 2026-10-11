import { useState } from 'react'
import { api } from '../../lib/api.js'
import { accountLabel, formatDate, fullName, isActiveAccount, localDateISO } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import { useToast } from '../../components/toast.jsx'
import { Alert, Avatar, Card, EmptyState, Field, Loading, PageHeader, ProgressBar, StatusBadge } from '../../components/ui.jsx'

const STATUSES = [
  ['PRESENT', 'Present'],
  ['LATE', 'Late'],
  ['EXCUSED', 'Excused'],
  ['ABSENT', 'Absent'],
]

/** Coach view for marking attendance on approved training sessions. */
export default function AttendancePage({ teams, session }) {
  const toast = useToast()
  const sessions = useApiData('/api/Training/sessions', session.token, { initialData: [] })
  const approved = (sessions.data || [])
    .filter((item) => String(item.approvalStatus || 'APPROVED').toUpperCase() === 'APPROVED')
    .sort((a, b) => b.trainingDate.localeCompare(a.trainingDate))
  const today = localDateISO()
  const defaultId = (approved.find((item) => item.trainingDate <= today) || approved[0])?.trainingSessionId
  const [chosenId, setChosenId] = useState('')
  const selectedId = chosenId || (defaultId ? String(defaultId) : '')
  const selected = approved.find((item) => String(item.trainingSessionId) === selectedId)
  const attendance = useApiData(selectedId ? `/api/Training/sessions/${selectedId}/attendance` : null, session.token, { initialData: [] })
  const [overrides, setOverrides] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [error, setError] = useState('')

  const statuses = { ...Object.fromEntries((attendance.data || []).map((item) => [item.athleteId, item.attendanceStatus])), ...(overrides[selectedId] || {}) }
  const athletes = teams.find((team) => team.teamId === selected?.teamId)?.athletes || []
  const markable = athletes.filter(isActiveAccount)
  const marked = markable.filter((athlete) => statuses[athlete.athleteId]).length
  const unmarked = markable.filter((athlete) => !statuses[athlete.athleteId])

  const mark = async (athleteId, status) => {
    setSavingId(athleteId)
    setError('')
    try {
      await api.post(`/api/Training/sessions/${selectedId}/attendance`, { athleteId, attendanceStatus: status }, session.token)
      setOverrides((current) => ({ ...current, [selectedId]: { ...(current[selectedId] || {}), [athleteId]: status } }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  // Most athletes attend most sessions: mark the rest present in one step, then fix the exceptions.
  const markRestPresent = async () => {
    setBulkSaving(true)
    setError('')
    const saved = {}
    let failed = 0
    for (const athlete of unmarked) {
      try {
        await api.post(`/api/Training/sessions/${selectedId}/attendance`, { athleteId: athlete.athleteId, attendanceStatus: 'PRESENT' }, session.token)
        saved[athlete.athleteId] = 'PRESENT'
      } catch {
        failed += 1
      }
    }
    setOverrides((current) => ({ ...current, [selectedId]: { ...(current[selectedId] || {}), ...saved } }))
    setBulkSaving(false)
    const count = Object.keys(saved).length
    if (count) toast.success(`Marked ${count} athlete${count === 1 ? '' : 's'} present.`)
    if (failed) setError(`${failed} athlete${failed === 1 ? '' : 's'} could not be marked. Try again.`)
  }

  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark who attended each approved training session." />
      <Alert>{sessions.error || attendance.error || error}</Alert>
      <Card>
        {sessions.loading && !approved.length ? <Loading label="Loading sessions…" /> : approved.length ? (
          <>
            <div className="toolbar">
              <Field label="Training session">
                <select value={selectedId} onChange={(event) => setChosenId(event.target.value)}>
                  {approved.map((item) => <option key={item.trainingSessionId} value={item.trainingSessionId}>{formatDate(item.trainingDate)} · {item.title} · {item.teamName}</option>)}
                </select>
              </Field>
              {selected && markable.length > 0 && (
                <div className="attendance-progress">
                  <span className="muted">{marked} of {markable.length} marked</span>
                  <ProgressBar value={Math.round((100 * marked) / markable.length)} tone={marked === markable.length ? 'success' : 'brand'} label={`${marked} of ${markable.length} athletes marked`} />
                </div>
              )}
              {selected && unmarked.length > 0 && selected.trainingDate <= today && (
                <button className="btn btn-secondary" type="button" onClick={markRestPresent} disabled={bulkSaving}>
                  {bulkSaving ? 'Saving…' : marked ? `Mark everyone else present (${unmarked.length})` : `Mark all present (${unmarked.length})`}
                </button>
              )}
            </div>
            {selected && markable.length > 0 && marked === markable.length && <Alert tone="success">Attendance is complete for this session.</Alert>}
            {selected && selected.trainingDate > today && <Alert tone="info">This session has not happened yet.</Alert>}
            {athletes.length ? (
              <ul className="row-list">
                {athletes.map((athlete) => (
                  <li className="row" key={athlete.athleteId}>
                    <div className="row-main with-avatar">
                      <Avatar firstName={athlete.firstName} lastName={athlete.lastName} />
                      <div><strong>{fullName(athlete)}</strong><small>{athlete.studentNumber || 'Student ID pending'}</small></div>
                    </div>
                    {!isActiveAccount(athlete) ? <StatusBadge status={athlete.accountStatus} label={`${accountLabel(athlete)} — cannot be marked`} /> : <div className="segmented attendance-options" role="group" aria-label={`Attendance for ${fullName(athlete)}`}>
                      {STATUSES.map(([value, label]) => (
                        <button key={value} type="button" className={`${statuses[athlete.athleteId] === value ? 'active' : ''} status-${value.toLowerCase()}`}
                          aria-pressed={statuses[athlete.athleteId] === value} disabled={savingId === athlete.athleteId || bulkSaving} onClick={() => mark(athlete.athleteId, value)}>
                          {label}
                        </button>
                      ))}
                    </div>}
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="users" title="No athletes on this team" message="Ask the Sports Director to assign athletes to this team." />}
          </>
        ) : <EmptyState icon="clipboard" title="No approved sessions" message="Training sessions appear here after the Sports Director approves them." />}
      </Card>
    </>
  )
}
