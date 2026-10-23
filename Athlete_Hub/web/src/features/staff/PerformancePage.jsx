import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, fullName, matchesSearch } from '../../lib/format.js'
import { useApiData, usePerformanceData } from '../../lib/hooks.js'
import PerformanceOverview from '../../components/PerformanceOverview.jsx'
import Icon from '../../components/icons.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Avatar, EmptyState, Field, Modal, PageHeader, SearchInput } from '../../components/ui.jsx'

const UNITS = [
  ['NUMBER', 'Number / repetitions'],
  ['SECONDS', 'Seconds'],
  ['METERS_PER_SECOND', 'Meters per second'],
  ['PERCENT', 'Percent'],
]


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
    if (!selectedSession) return setError('Please choose a training session that has already finished.')
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
  const [showForm, setShowForm] = useState(false)
  const data = usePerformanceData(athlete.athleteId, session.token)
  const sessions = useApiData(canEdit ? '/api/Training/sessions' : null, session.token, { initialData: [] })
  const savedWorkouts = [...new Set((data.records.data?.records || []).map((record) => record.dataType).filter(Boolean))]

  const onSaved = () => {
    setShowForm(false)
    toast.success(`Performance recorded for ${fullName(athlete)}.`)
    data.reload()
  }

  return (
    <>
      <button className="btn btn-ghost back-button" type="button" onClick={onBack}>← All athletes</button>
      <section className="profile-hero">
        <Avatar firstName={athlete.firstName} lastName={athlete.lastName} size="xl" />
        <div>
          <h1>{fullName(athlete)}</h1>
          <p>{[athlete.studentNumber || 'Student ID pending', athlete.sport, athlete.teamName].filter(Boolean).join(' · ')}</p>
        </div>
        {canEdit && <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}><Icon name="plus" />Record performance</button>}
      </section>
      <PerformanceOverview
        data={data}
        viewer="staff"
        emptyTitle="No performance records"
        emptyMessage={canEdit ? 'Use “Record performance” after a training session ends.' : 'The coach has not recorded any performance for this athlete yet.'}
      />
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
