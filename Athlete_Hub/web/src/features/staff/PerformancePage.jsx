import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, fullName, matchesSearch } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import PerformanceTrendChart from '../../PerformanceTrendChart.jsx'
import { ChartErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Avatar, Card, EmptyState, Field, Loading, Modal, PageHeader, SearchInput, Tabs } from '../../components/ui.jsx'

const UNITS = [
  ['NUMBER', 'Number / repetitions'],
  ['SECONDS', 'Seconds'],
  ['METERS_PER_SECOND', 'Meters per second'],
  ['PERCENT', 'Percent'],
]

const UNIT_SUFFIX = { NUMBER: '', SECONDS: 's', METERS_PER_SECOND: 'm/s', PERCENT: '%' }

function guessUnit(workoutName) {
  const name = String(workoutName || '').trim().toLowerCase().replace(/[-_]+/g, ' ')
  if (name.includes('sprint') || name.includes('speed') || name.includes('balance')) return 'SECONDS'
  if (name.includes('shoot') || name.includes('accuracy')) return 'PERCENT'
  if (name.includes('push up') || name.includes('rep')) return 'NUMBER'
  return ''
}

function sessionEnd(item) {
  return new Date(`${item.trainingDate}T${item.endTime || '23:59:59'}`)
}

function RecordPerformanceModal({ athlete, sessions, savedWorkouts, session, onClose, onSaved }) {
  const completed = sessions
    .filter((item) => String(item.approvalStatus || '').toUpperCase() === 'APPROVED' && sessionEnd(item) <= new Date())
    .sort((a, b) => sessionEnd(b) - sessionEnd(a))
  const [form, setForm] = useState({ dataType: '', recordedValue: '', unit: 'NUMBER', sessionId: completed[0]?.trainingSessionId || '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedSession = completed.find((item) => item.trainingSessionId === Number(form.sessionId))

  const submit = async (event) => {
    event.preventDefault()
    if (!selectedSession) return setError('Select a completed training session.')
    setSaving(true)
    setError('')
    try {
      await api.post('/api/Performance/record', {
        athleteId: athlete.athleteId,
        metricId: 0,
        recordedValue: Number(form.recordedValue),
        recordedDate: selectedSession.trainingDate,
        notes: form.notes.trim() || null,
        dataType: form.dataType.trim(),
        unit: form.unit,
        sessionId: selectedSession.trainingSessionId,
      }, session.token)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Record performance" subtitle={fullName(athlete)} onClose={onClose} closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="performance-form" disabled={saving || !completed.length}>{saving ? 'Saving…' : 'Save record'}</button>
      </>}>
      {!completed.length && <Alert tone="info">Performance can only be recorded for director-approved sessions that have already ended.</Alert>}
      <form id="performance-form" className="form-grid" onSubmit={submit}>
        <Field label="Workout / measurement" required className="span-2" hint="Pick a saved workout or type a new one. The unit is suggested from the name.">
          <input list="saved-workouts" value={form.dataType} onChange={(event) => setForm({ ...form, dataType: event.target.value, unit: guessUnit(event.target.value) || form.unit })} placeholder="e.g. Push-ups, Sprint 40m, Balance" required />
          <datalist id="saved-workouts">{savedWorkouts.map((name) => <option key={name} value={name} />)}</datalist>
        </Field>
        <Field label="Value" required><input type="number" step="any" min="0" value={form.recordedValue} onChange={(event) => setForm({ ...form, recordedValue: event.target.value })} required /></Field>
        <Field label="Unit" required>
          <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
            {UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Training session" required className="span-2" hint={selectedSession ? `Session date: ${formatDate(selectedSession.trainingDate)}` : undefined}>
          <select value={form.sessionId} onChange={(event) => setForm({ ...form, sessionId: event.target.value })} disabled={!completed.length} required>
            {!completed.length && <option value="">No completed sessions</option>}
            {completed.map((item) => <option key={item.trainingSessionId} value={item.trainingSessionId}>{item.title} · {formatDate(item.trainingDate)}</option>)}
          </select>
        </Field>
        <Field label="Notes" optional className="span-2"><textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="e.g. Personal best, felt strong" /></Field>
      </form>
      <Alert>{error}</Alert>
    </Modal>
  )
}

function AthletePerformance({ athlete, session, canEdit, onBack }) {
  const toast = useToast()
  const [range, setRange] = useState('overall')
  const [showForm, setShowForm] = useState(false)
  const records = useApiData(`/api/Performance/athlete/${athlete.athleteId}`, session.token)
  const trend = useApiData(`/api/Performance/athlete/${athlete.athleteId}/trend?timeRange=${range}`, session.token)
  const sessions = useApiData(canEdit ? '/api/Training/sessions' : null, session.token, { initialData: [] })
  const rows = records.data?.records || []
  const savedWorkouts = [...new Set(rows.map((record) => record.dataType).filter(Boolean))]

  const onSaved = () => {
    setShowForm(false)
    toast.success(`Performance recorded for ${fullName(athlete)}.`)
    records.reload()
    trend.reload()
  }

  return (
    <>
      <button className="btn btn-ghost back-button" type="button" onClick={onBack}>← All athletes</button>
      <PageHeader
        title={fullName(athlete)}
        subtitle={`${athlete.studentNumber || 'Student ID pending'}${athlete.teamName ? ` · ${athlete.teamName}` : ''}`}
        actions={canEdit && <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>+ Record performance</button>}
      />
      <Alert>{records.error || trend.error}</Alert>
      <Card title="Performance trend" actions={<Tabs label="Time range" value={range} onChange={setRange} options={[['overall', 'Overall'], ['monthly', 'Last 30 days'], ['weekly', 'Last 7 days']]} />}>
        <div className="chart-area">
          {trend.loading ? <Loading label="Loading trend…" /> : trend.data?.labels?.length ? (
            <ChartErrorBoundary data={trend.data}>
              <PerformanceTrendChart data={trend.data} title="" />
            </ChartErrorBoundary>
          ) : <EmptyState icon="chart" title="No data for this range" message="Recorded performances will be charted here." />}
        </div>
      </Card>
      <Card title="Performance records" subtitle="Every measurement recorded for this athlete">
        {records.loading && !records.data ? <Loading label="Loading records…" /> : rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Workout</th><th>Value</th><th>Date</th><th>Session</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map((record) => (
                  <tr key={record.performanceRecordId}>
                    <td><span className="badge badge-neutral">{record.dataType || record.metric?.metricName || '—'}</span></td>
                    <td className="numeric">{record.recordedValue}{UNIT_SUFFIX[record.unit] ? ` ${UNIT_SUFFIX[record.unit]}` : ''}</td>
                    <td>{formatDate(record.recordedDate)}</td>
                    <td>{record.sessionTitle || (record.sessionId ? `Session ${record.sessionId}` : '—')}</td>
                    <td>{record.notes || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="chart" title="No performance records" message={canEdit ? 'Use “Record performance” after a training session ends.' : 'The coach has not recorded any performance yet.'} />}
      </Card>
      {showForm && <RecordPerformanceModal athlete={athlete} sessions={sessions.data || []} savedWorkouts={savedWorkouts} session={session} onClose={() => setShowForm(false)} onSaved={onSaved} />}
    </>
  )
}

export default function PerformancePage({ athletes, session, canEdit }) {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  if (selected) return <AthletePerformance athlete={selected} session={session} canEdit={canEdit} onBack={() => setSelected(null)} />

  const filtered = athletes.filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.studentNumber, athlete.sport, athlete.teamName))
  return (
    <>
      <PageHeader title="Performance" subtitle={canEdit ? 'Select an athlete to record and track their performance over time' : 'Select an athlete to view their performance records and trends'} />
      {athletes.length > 0 && (
        <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search athletes…" label="Search athletes" /></div>
      )}
      {!athletes.length ? <EmptyState icon="users" title="No athletes assigned" message="Athletes appear here once they are assigned to a team." /> : filtered.length ? (
        <div className="card-grid compact">
          {filtered.map((athlete) => (
            <button className="person-card person-card-button" type="button" key={`${athlete.teamName || 'none'}-${athlete.athleteId}`} onClick={() => setSelected(athlete)}>
              <Avatar firstName={athlete.firstName} lastName={athlete.lastName} size="lg" />
              <strong>{fullName(athlete)}</strong>
              <small>{athlete.studentNumber || 'Student ID pending'}</small>
              <span className="muted">{athlete.sport || 'Athlete'}{athlete.teamName ? ` · ${athlete.teamName}` : ''}</span>
            </button>
          ))}
        </div>
      ) : <EmptyState title="No matches" message="Try a different search." />}
    </>
  )
}
