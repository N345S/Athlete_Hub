import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../lib/api.js'
import { eventTypeLabel, formatDate, formatTimeRange, localDateISO } from '../../lib/format.js'
import { Alert, Field, Modal, Tabs } from '../../components/ui.jsx'

const WEEKDAYS = [['Sun', 'Sunday'], ['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday']]
// One request creates one session per date; a cap stops a mistyped "until" date creating hundreds.
const MAX_DATES = 60

const parseISO = (value) => new Date(`${value}T00:00:00`)
const shortDate = (value) => parseISO(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const longDate = (value) => parseISO(value).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const addDays = (value, days) => {
  const date = parseISO(value)
  date.setDate(date.getDate() + days)
  return localDateISO(date)
}

/** Every date from `from` to `until` (inclusive) that falls on one of the chosen weekdays (0 = Sunday). */
function weeklyDates(weekdays, from, until) {
  if (!weekdays.length || !from || !until || until < from) return []
  const result = []
  for (let value = from; value <= until && result.length <= MAX_DATES; value = addDays(value, 1)) {
    if (weekdays.includes(parseISO(value).getDay())) result.push(value)
  }
  return result
}

/**
 * Builds a list of distinct, non-past dates: tap days on a month calendar, or generate a weekly
 * pattern ("every Mon and Wed for 8 weeks"). Selected dates are listed below and can be removed.
 */
function DatePicker({ dates, onChange, label }) {
  const today = localDateISO()
  const labelId = useId()
  const [mode, setMode] = useState('calendar')
  const [month, setMonth] = useState(() => {
    const base = parseISO(dates[0] || today)
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [weekdays, setWeekdays] = useState([])
  const [from, setFrom] = useState(today)
  const [until, setUntil] = useState('')
  const [message, setMessage] = useState('')
  // Quick successive taps can arrive before the parent re-renders; always build on the latest list.
  const latest = useRef(dates)
  useEffect(() => { latest.current = dates }, [dates])

  const setDates = (next) => {
    const unique = [...new Set(next)].filter((value) => value >= today).sort()
    if (unique.length > MAX_DATES) {
      setMessage(`You can add up to ${MAX_DATES} dates at a time.`)
      return false
    }
    setMessage('')
    latest.current = unique
    onChange(unique)
    return true
  }
  const toggle = (value) => {
    const current = latest.current
    setDates(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  // Month grid
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth()
  const leadingBlanks = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, index) => localDateISO(new Date(year, monthIndex, index + 1)))
  const shiftMonth = (offset) => setMonth(new Date(year, monthIndex + offset, 1))

  // Weekly pattern
  const pattern = weeklyDates(weekdays, from, until)
  const newFromPattern = pattern.filter((value) => !dates.includes(value))
  const tooMany = pattern.length > MAX_DATES || dates.length + newFromPattern.length > MAX_DATES
  const addPattern = () => {
    if (!setDates([...latest.current, ...pattern])) return
    const first = parseISO(pattern[0])
    setMonth(new Date(first.getFullYear(), first.getMonth(), 1))
    setMode('calendar')
  }
  const patternLabel = !weekdays.length ? 'Choose at least one day'
    : !until ? 'Choose when it ends'
      : tooMany ? `More than ${MAX_DATES} dates — choose an earlier end date`
        : newFromPattern.length ? `Add ${newFromPattern.length} date${newFromPattern.length === 1 ? '' : 's'}`
          : 'No new dates in this range'

  return (
    <div className="field date-picker">
      <span className="field-label" id={labelId}>{label}<span className="field-required" aria-hidden="true"> *</span></span>
      <Tabs label="How to choose dates" value={mode} onChange={setMode} options={[['calendar', 'Pick on calendar'], ['weekly', 'Repeat weekly']]} />

      <div className="date-picker-body">
        {mode === 'calendar' ? (
          <div className="mini-calendar" role="group" aria-labelledby={labelId}>
            <div className="mini-calendar-nav">
              <button className="icon-button" type="button" onClick={() => shiftMonth(-1)} disabled={isCurrentMonth} aria-label="Previous month">‹</button>
              <strong aria-live="polite">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
              <button className="icon-button" type="button" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
            </div>
            <div className="mini-calendar-grid">
              {WEEKDAYS.map(([short, long]) => <abbr className="mini-calendar-weekday" key={short} title={long}>{short.slice(0, 2)}</abbr>)}
              {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} />)}
              {days.map((value) => {
                const selected = dates.includes(value)
                return (
                  <button key={value} type="button" className={`mini-day ${selected ? 'selected' : ''} ${value === today ? 'today' : ''}`}
                    disabled={value < today} aria-pressed={selected} aria-label={`${longDate(value)}${value === today ? ' (today)' : ''}`} onClick={() => toggle(value)}>
                    {Number(value.slice(8))}
                  </button>
                )
              })}
            </div>
            <small className="field-hint">Tap every day the session happens. Tap a day again to remove it.</small>
          </div>
        ) : (
          <div className="weekly-repeat">
            <fieldset className="weekday-picker">
              <legend className="field-label">Repeat every</legend>
              {WEEKDAYS.map(([short, long], index) => (
                <button key={short} type="button" className={`weekday-toggle ${weekdays.includes(index) ? 'selected' : ''}`} aria-pressed={weekdays.includes(index)} aria-label={long}
                  onClick={() => setWeekdays((current) => (current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort()))}>
                  {short}
                </button>
              ))}
            </fieldset>
            <div className="weekly-range">
              <Field label="Starting"><input type="date" min={today} value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
              <Field label="Until"><input type="date" min={from || today} value={until} onChange={(event) => setUntil(event.target.value)} /></Field>
            </div>
            <div className="weekly-quick" role="group" aria-label="Quick end dates">
              <span className="muted">For</span>
              {[4, 8, 12].map((weeks) => (
                <button key={weeks} type="button" className={`filter-chip ${until && from && until === addDays(from, weeks * 7 - 1) ? 'active' : ''}`} onClick={() => setUntil(addDays(from || today, weeks * 7 - 1))}>{weeks} weeks</button>
              ))}
            </div>
            <button className="btn btn-primary" type="button" disabled={!newFromPattern.length || tooMany} onClick={addPattern}>{patternLabel}</button>
          </div>
        )}

        <div className="selected-dates" aria-live="polite">
          <div className="selected-dates-header">
            <strong>{dates.length ? `${dates.length} date${dates.length === 1 ? '' : 's'} selected` : 'No dates selected yet'}</strong>
            {dates.length > 0 && <button className="link-button" type="button" onClick={() => setDates([])}>Clear all</button>}
          </div>
          {dates.length > 0 ? (
            <ul className="selected-date-list">
              {dates.map((value) => (
                <li key={value}>
                  <span>{shortDate(value)}{value.slice(0, 4) !== String(now.getFullYear()) && <small className="muted"> {value.slice(0, 4)}</small>}</span>
                  <button type="button" onClick={() => toggle(value)} aria-label={`Remove ${longDate(value)}`}>×</button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{mode === 'calendar' ? 'Tap days on the calendar to add them.' : 'Choose the days and how long it repeats.'}</p>}
        </div>
      </div>
      {message && <small className="text-danger" role="alert">{message}</small>}
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
    if (!form.teamId || !form.title.trim() || !form.dates.length) return setError('Please choose a team, enter a title, and pick at least one date. Tap the dates on the calendar, or use “Repeat weekly”.')
    if (form.startTime && form.endTime && form.endTime <= form.startTime) return setError('The end time must be later than the start time.')
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
    <Modal title="Request training session" subtitle="Sessions are published to athletes after the Sports Director approves them." onClose={onClose} closeOnBackdrop={false} size="lg"
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

// The API asks for a clear reason; keep these in step with ScheduleChangeRequest.
const MIN_REASON = 10
const MAX_REASON = 500

/**
 * Cancels or reschedules a training session (`event.type` TRAINING) or a sports event or competition, with a
 * required reason that is sent to everyone affected. `mode` is 'cancel' or 'reschedule'; `role` is 'coach' or
 * 'director' and decides who is said to be notified.
 */
export function ScheduleChangeModal({ event, mode, role, session, onClose, onDone }) {
  const training = event.type === 'TRAINING'
  const rescheduling = mode === 'reschedule'
  const kind = training ? 'training session' : eventTypeLabel(event.type).toLowerCase()
  const [form, setForm] = useState({ date: event.startDate, startTime: event.startTime?.slice(0, 5) || '', endTime: event.endTime?.slice(0, 5) || '', reason: '' })
  const { saving, error, setError, submit } = useSubmit(onDone)
  const update = (key) => (change) => setForm((current) => ({ ...current, [key]: change.target.value }))
  const reasonLength = form.reason.trim().length
  const audience = !training ? 'Every athlete and coach'
    : event.approvalStatus === 'PENDING' ? 'The Sports Director'
      : `The team’s athletes, their parents, and ${role === 'coach' ? 'the Sports Director' : 'the coach'}`

  const handleSubmit = (submitEvent) => {
    submitEvent.preventDefault()
    if (reasonLength < MIN_REASON) return setError(`Please explain the reason clearly (at least ${MIN_REASON} characters).`)
    if (rescheduling) {
      if (!form.date) return setError('Please choose the new date.')
      if (form.date < localDateISO()) return setError('The new date cannot be in the past.')
      if (!training && !form.startTime) return setError('Please choose the new start time.')
      if (form.startTime && form.endTime && form.endTime <= form.startTime) return setError('The end time must be later than the start time.')
      const unchanged = form.date === event.startDate && form.startTime === (event.startTime?.slice(0, 5) || '') && form.endTime === (event.endTime?.slice(0, 5) || '')
      if (unchanged) return setError(`Choose a different date or time to reschedule the ${kind}.`)
    }
    const base = training ? `/api/Training/sessions/${event.sourceId}` : `/api/Schedules/${event.sourceId}`
    submit(() => api.put(`${base}/${mode}`, {
      reason: form.reason.trim(),
      ...(rescheduling ? { date: form.date, startTime: toTimeSpan(form.startTime), endTime: toTimeSpan(form.endTime) } : {}),
    }, session.token))
  }

  return (
    <Modal
      title={`${rescheduling ? 'Reschedule' : 'Cancel'} ${kind}`}
      subtitle={`${event.title} · ${formatDate(event.startDate)} · ${formatTimeRange(event.startTime, event.endTime)}`}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>{rescheduling ? 'Back' : `Keep ${kind}`}</button>
        <button className={`btn ${rescheduling ? 'btn-primary' : 'btn-danger'}`} type="submit" form="schedule-change-form" disabled={saving || reasonLength < MIN_REASON}>
          {saving ? 'Saving…' : rescheduling ? 'Save new date and time' : `Cancel ${kind}`}
        </button>
      </>}
    >
      <form id="schedule-change-form" className="form-grid" onSubmit={handleSubmit}>
        {rescheduling && <>
          <Field label="New date" required className="span-2"><input type="date" min={localDateISO()} value={form.date} onChange={update('date')} required /></Field>
          <Field label="Start time" required={!training} optional={training}><input type="time" value={form.startTime} onChange={update('startTime')} required={!training} /></Field>
          <Field label="End time" optional><input type="time" value={form.endTime} onChange={update('endTime')} /></Field>
        </>}
        {!rescheduling && <p className="span-2 modal-message">It stays on the calendar marked “Cancelled”, with your reason.</p>}
        <Field
          label={rescheduling ? 'Reason for the change' : 'Reason for cancelling'}
          required
          className="span-2"
          hint={`${audience} will be notified and will see this reason. ${reasonLength}/${MAX_REASON}${reasonLength < MIN_REASON ? ` · at least ${MIN_REASON} characters` : ''}`}
        >
          <textarea rows="3" value={form.reason} onChange={update('reason')} maxLength={MAX_REASON} required
            placeholder={rescheduling ? 'e.g. The gym is booked for the school fair, so practice moves to Thursday.' : 'e.g. The venue is closed because of the typhoon warning.'} />
        </Field>
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
    if (!form.title.trim() || !form.dates.length || !form.startTime) return setError('Please enter a title and a start time, and pick at least one date. Tap the dates on the calendar, or use “Repeat weekly”.')
    if (form.endTime && form.endTime <= form.startTime) return setError('The end time must be later than the start time.')
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
    <Modal title="Add sports event" subtitle="Create a sports event or competition on one or more dates. Every athlete will see it." onClose={onClose} closeOnBackdrop={false} size="lg"
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
