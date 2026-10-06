import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, fullName, localDateISO } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import { Alert, Avatar, Card, EmptyState, Field, Loading, PageHeader } from '../../components/ui.jsx'

const STATUSES = [
  ['PRESENT', 'Present'],
  ['LATE', 'Late'],
  ['EXCUSED', 'Excused'],
  ['ABSENT', 'Absent'],
]

/** Coach view for marking attendance on approved training sessions. */
export default function AttendancePage({ teams, session }) {
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
  const [error, setError] = useState('')

  const statuses = { ...Object.fromEntries((attendance.data || []).map((item) => [item.athleteId, item.attendanceStatus])), ...(overrides[selectedId] || {}) }
  const athletes = teams.find((team) => team.teamId === selected?.teamId)?.athletes || []
  const marked = athletes.filter((athlete) => statuses[athlete.athleteId]).length

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
              {selected && <span className="muted">{marked} of {athletes.length} marked</span>}
            </div>
            {selected && selected.trainingDate > today && <Alert tone="info">This session has not happened yet.</Alert>}
            {athletes.length ? (
              <ul className="row-list">
                {athletes.map((athlete) => (
                  <li className="row" key={athlete.athleteId}>
                    <div className="row-main with-avatar">
                      <Avatar firstName={athlete.firstName} lastName={athlete.lastName} />
                      <div><strong>{fullName(athlete)}</strong><small>{athlete.studentNumber || 'Student ID pending'}</small></div>
                    </div>
                    <div className="segmented attendance-options" role="group" aria-label={`Attendance for ${fullName(athlete)}`}>
                      {STATUSES.map(([value, label]) => (
                        <button key={value} type="button" className={`${statuses[athlete.athleteId] === value ? 'active' : ''} status-${value.toLowerCase()}`}
                          aria-pressed={statuses[athlete.athleteId] === value} disabled={savingId === athlete.athleteId} onClick={() => mark(athlete.athleteId, value)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No athletes on this team" message="Ask the Sports Director to assign athletes to this team." />}
          </>
        ) : <EmptyState title="No approved sessions" message="Training sessions appear here after the Sports Director approves them." />}
      </Card>
    </>
  )
}
