import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, localDateISO } from '../../lib/format.js'
import { Alert, Field, Modal } from '../../components/ui.jsx'

/** Lets the user build a list of distinct, non-past dates. */
function DatePicker({ dates, onChange, label, hint }) {
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const today = localDateISO()

  const add = (value = pending) => {
    if (!value) return
    if (value < today) {
      setError('Dates cannot be in the past.')
      return
    }
    setError('')
    if (!dates.includes(value)) onChange([...dates, value].sort())
    setPending('')
  }

  return (
    <div className="field">
      <span className="field-label">{label}<span className="field-required" aria-hidden="true"> *</span></span>
      <div className="inline-row">
        <input type="date" min={today} value={pending} onChange={(event) => setPending(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
          onBlur={() => { if (pending && pending >= today) add() }} aria-label={`${label} to add`} />
        <button className="btn btn-secondary" type="button" onClick={() => add()} disabled={!pending}>Add date</button>
      </div>
      {error && <small className="text-danger">{error}</small>}
      {!error && <small className="field-hint">{dates.length ? `${dates.length} date${dates.length === 1 ? '' : 's'} selected.` : hint || 'Pick a date, then select “Add date”. Repeat to add more.'}</small>}
      {dates.length > 0 && (
        <div className="chip-list">
          {dates.map((date) => (
            <span className="chip" key={date}>
              {formatDate(date)}
              <button type="button" onClick={() => onChange(dates.filter((item) => item !== date))} aria-label={`Remove ${formatDate(date)}`}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// The API binds times to TimeSpan, which expects hh:mm:ss.
const toTimeSpan = (value) => (value ? (value.length === 5 ? `${value}:00` : value) : null)

function useSubmit(onCreated) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (request) => {
    setSaving(true)
    setError('')
    try {
      await request()
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return { saving, error, setError, submit }
}

/** Coach form: training sessions for one of their teams, sent to the director for approval. */
export function TrainingScheduleModal({ teams, session, onClose, onCreated }) {
  const [form, setForm] = useState({ teamId: teams[0]?.teamId ? String(teams[0].teamId) : '', title: '', dates: [], startTime: '', endTime: '', location: '', description: '' })
  const { saving, error, setError, submit } = useSubmit(onCreated)
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!form.teamId || !form.title.trim() || !form.dates.length) return setError('Team, title, and at least one date are required. Select “Add date” after picking each date.')
    if (form.startTime && form.endTime && form.endTime <= form.startTime) return setError('End time must be after start time.')
    submit(() => api.post('/api/Training/sessions', {
      teamId: Number(form.teamId),
      title: form.title.trim(),
      trainingDate: form.dates[0],
      trainingDates: form.dates,
      startTime: toTimeSpan(form.startTime),
      endTime: toTimeSpan(form.endTime),
      location: form.location.trim() || null,
      description: form.description.trim() || null,
    }, session.token))
  }

  return (
    <Modal title="Request training session" subtitle="Sessions are published to athletes after the Sports Director approves them." onClose={onClose} closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="training-form" disabled={saving || !teams.length}>{saving ? 'Saving…' : 'Submit for approval'}</button>
      </>}>
      <form id="training-form" className="form-grid" onSubmit={handleSubmit}>
        <Field label="Team" required>
          <select value={form.teamId} onChange={update('teamId')} required>
            {!teams.length && <option value="">No teams assigned</option>}
            {teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.teamName}</option>)}
          </select>
        </Field>
        <Field label="Title" required><input value={form.title} onChange={update('title')} maxLength={200} placeholder="e.g. Team practice" required /></Field>
        <div className="span-2"><DatePicker label="Dates" dates={form.dates} onChange={(dates) => setForm((current) => ({ ...current, dates }))} /></div>
        <Field label="Start time" optional><input type="time" value={form.startTime} onChange={update('startTime')} /></Field>
        <Field label="End time" optional><input type="time" value={form.endTime} onChange={update('endTime')} /></Field>
        <Field label="Location" optional className="span-2"><input value={form.location} onChange={update('location')} placeholder="e.g. Gymnasium" /></Field>
        <Field label="Description" optional className="span-2"><textarea rows="3" value={form.description} onChange={update('description')} placeholder="Details for athletes" /></Field>
      </form>
      <Alert>{error}</Alert>
    </Modal>
  )
}

/** Director form: sports events and competitions visible to every athlete. */
export function EventScheduleModal({ session, onClose, onCreated }) {
  const [form, setForm] = useState({ scheduleType: 'SPORTS_EVENT', title: '', dates: [], startTime: '', endTime: '', location: '', description: '' })
  const { saving, error, setError, submit } = useSubmit(onCreated)
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.dates.length || !form.startTime) return setError('Title, at least one date, and a start time are required. Select “Add date” after picking each date.')
    if (form.endTime && form.endTime <= form.startTime) return setError('End time must be after start time.')
    submit(() => api.post('/api/Schedules', {
      scheduleType: form.scheduleType,
      title: form.title.trim(),
      startDate: form.dates[0],
      dates: form.dates,
      startTime: toTimeSpan(form.startTime),
      endDate: form.endTime ? form.dates[0] : null,
      endTime: toTimeSpan(form.endTime),
      location: form.location.trim() || null,
      description: form.description.trim() || null,
    }, session.token))
  }

  return (
    <Modal title="Add sports event" subtitle="Create a sports event or competition on one or more dates. Every athlete will see it." onClose={onClose} closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="event-form" disabled={saving}>{saving ? 'Saving…' : 'Add event'}</button>
      </>}>
      <form id="event-form" className="form-grid" onSubmit={handleSubmit}>
        <Field label="Event type" required>
          <select value={form.scheduleType} onChange={update('scheduleType')}>
            <option value="SPORTS_EVENT">Sports event</option>
            <option value="COMPETITION">Competition</option>
          </select>
        </Field>
        <Field label="Title" required><input value={form.title} onChange={update('title')} maxLength={200} placeholder="e.g. Regional athletics meet" required /></Field>
        <div className="span-2"><DatePicker label="Dates" dates={form.dates} onChange={(dates) => setForm((current) => ({ ...current, dates }))} /></div>
        <Field label="Start time" required><input type="time" value={form.startTime} onChange={update('startTime')} required /></Field>
        <Field label="End time" optional><input type="time" value={form.endTime} onChange={update('endTime')} /></Field>
        <Field label="Location" optional className="span-2"><input value={form.location} onChange={update('location')} placeholder="e.g. Athletics stadium" /></Field>
        <Field label="Description" optional className="span-2"><textarea rows="3" value={form.description} onChange={update('description')} placeholder="Event details" /></Field>
      </form>
      <Alert>{error}</Alert>
    </Modal>
  )
}
