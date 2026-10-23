import { useState } from 'react'
import { eventTypeLabel, formatDate, formatTimeRange, localDateISO } from '../lib/format.js'
import { Loading, Modal, StatusBadge, Tabs } from './ui.jsx'

const EVENT_TYPES = ['TRAINING', 'SPORTS_EVENT', 'COMPETITION']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * The status to show beside a schedule item, if any: cancelled, waiting for approval or rejected, or rescheduled.
 */
export function ScheduleStatusBadge({ item }) {
  if (item.cancelled) return <StatusBadge status="CANCELLED" label="Cancelled" />
  if (item.approvalStatus && item.approvalStatus !== 'APPROVED') return <StatusBadge status={item.approvalStatus} label={item.approvalStatus === 'PENDING' ? 'Awaiting approval' : undefined} />
  if (item.rescheduledAt) return <span className="badge badge-warning">Rescheduled</span>
  return null
}

/**
 * Month calendar and list view of training sessions, sports events, and competitions.
 * `renderActions(event, close)` may return extra buttons for the event detail dialog, and
 * `renderDetails(event)` extra rows for its detail list. `eventTypes` limits the type filters shown.
 */
export default function CalendarView({ events, loading, renderActions, renderDetails, eventTypes = EVENT_TYPES }) {
  const [month, setMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [view, setView] = useState('calendar')
  const [types, setTypes] = useState(eventTypes)
  const [selected, setSelected] = useState(null)
  const [selectedDay, setSelectedDay] = useState(() => localDateISO())

  const visible = events
    .map((item) => ({ ...item, type: String(item.type || 'OTHER').toUpperCase() }))
    .filter((item) => types.includes(item.type))
    .sort((a, b) => `${a.startDate} ${a.startTime || ''}`.localeCompare(`${b.startDate} ${b.startTime || ''}`))

  const firstWeekday = month.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1
    return day > 0 && day <= daysInMonth ? day : null
  })
  const isoFor = (day) => localDateISO(new Date(month.getFullYear(), month.getMonth(), day))
  const today = localDateISO()
  const monthEvents = visible.filter((item) => item.startDate?.startsWith(isoFor(1).slice(0, 7)))
  const listEvents = view === 'list' ? visible.filter((item) => item.startDate >= today) : monthEvents

  const toggleType = (type) => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  const shiftMonth = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  const goToday = () => {
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDay(localDateISO(now))
  }
  const dayEvents = visible.filter((item) => item.startDate === selectedDay)
  const selectedInMonth = selectedDay.startsWith(isoFor(1).slice(0, 7))

  const eventButton = (item, compact) => (
    <button key={item.id} type="button" className={`event-chip type-${item.type.toLowerCase()} ${compact ? 'compact' : ''} ${item.cancelled ? 'cancelled' : ''}`} onClick={() => setSelected(item)}
      aria-label={item.cancelled ? `${item.title} (cancelled)` : undefined}>
      {compact ? <><span className="event-time">{formatTimeRange(item.startTime).replace('Time TBA', '')}</span> {item.title}</> : (
        <>
          <strong>{item.title}</strong>
          <span>{eventTypeLabel(item.type)} · {formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span>
          <small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small>
          <ScheduleStatusBadge item={item} />
        </>
      )}
    </button>
  )

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        {view === 'calendar' ? (
          <div className="calendar-nav">
            <button className="icon-button" type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button className="icon-button" type="button" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={goToday}>Today</button>
          </div>
        ) : <strong>Upcoming events</strong>}
        <Tabs label="Calendar view" value={view} onChange={setView} options={[['calendar', 'Calendar'], ['list', 'List']]} />
      </div>

      {eventTypes.length > 1 && (
        <div className="calendar-filters" role="group" aria-label="Event types">
          {eventTypes.map((type) => (
            <button key={type} type="button" className={`filter-chip type-${type.toLowerCase()} ${types.includes(type) ? 'active' : ''}`} aria-pressed={types.includes(type)} onClick={() => toggleType(type)}>
              {eventTypeLabel(type)}
            </button>
          ))}
        </div>
      )}

      {loading && !events.length ? <Loading label="Loading schedule…" /> : view === 'list' ? (
        <div className="event-list">{listEvents.length ? listEvents.map((item) => eventButton(item, false)) : <p className="muted">No upcoming events match the selected filters.</p>}</div>
      ) : (
        <>
          <div className="calendar-grid">
            {WEEKDAYS.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
            {cells.map((day, index) => {
              if (!day) return <div key={index} className="calendar-day blank" />
              const iso = isoFor(day)
              const count = visible.filter((item) => item.startDate === iso).length
              return (
                // Clicking anywhere in the cell selects the day; the day number is the keyboard target.
                <div key={index} className={`calendar-day ${iso === today ? 'today' : ''} ${iso === selectedDay ? 'selected' : ''} ${count ? 'has-events' : ''}`} onClick={() => setSelectedDay(iso)}>
                  <button type="button" className="day-number" onClick={() => setSelectedDay(iso)} aria-pressed={iso === selectedDay}
                    aria-label={`${formatDate(iso)}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ', no events'}`}>{day}</button>
                  {visible.filter((item) => item.startDate === iso).map((item) => eventButton(item, true))}
                </div>
              )
            })}
          </div>
          {selectedInMonth && (
            <div className="calendar-agenda" aria-live="polite">
              <strong>{new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
              {dayEvents.length ? <div className="event-list">{dayEvents.map((item) => eventButton(item, false))}</div> : <p className="muted">Nothing scheduled on this day.</p>}
            </div>
          )}
        </>
      )}

      {selected && (
        <Modal title={selected.title} subtitle={eventTypeLabel(selected.type)} onClose={() => setSelected(null)} size="sm"
          footer={<>
            {renderActions?.(selected, () => setSelected(null))}
            <button className="btn btn-primary" type="button" onClick={() => setSelected(null)}>Close</button>
          </>}>
          <dl className="detail-list">
            <div><dt>Date</dt><dd>{formatDate(selected.startDate)}</dd></div>
            <div><dt>Time</dt><dd>{formatTimeRange(selected.startTime, selected.endTime)}</dd></div>
            <div><dt>Location</dt><dd>{selected.location || 'Location TBA'}</dd></div>
            {selected.teamName && <div><dt>Team</dt><dd>{selected.teamName}</dd></div>}
            {(selected.approvalStatus || selected.cancelled) && <div><dt>Status</dt><dd><StatusBadge status={selected.cancelled ? 'CANCELLED' : selected.approvalStatus} /></dd></div>}
            {selected.cancellationReason && <div><dt>Why it was cancelled</dt><dd>{selected.cancellationReason}</dd></div>}
            {selected.rescheduleReason && <div><dt>Why it was moved</dt><dd>{selected.rescheduleReason}</dd></div>}
            {selected.rejectionReason && <div><dt>Reason</dt><dd>{selected.rejectionReason}</dd></div>}
            {selected.description && <div><dt>Details</dt><dd>{selected.description}</dd></div>}
            {renderDetails?.(selected)}
          </dl>
        </Modal>
      )}
    </div>
  )
}
