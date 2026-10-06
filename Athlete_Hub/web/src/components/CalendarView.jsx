import { useState } from 'react'
import { eventTypeLabel, formatDate, formatTimeRange, localDateISO } from '../lib/format.js'
import { Loading, Modal, StatusBadge, Tabs } from './ui.jsx'

const EVENT_TYPES = ['TRAINING', 'SPORTS_EVENT', 'COMPETITION']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Month calendar and list view of training sessions, sports events, and competitions. */
export default function CalendarView({ events, loading }) {
  const [month, setMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [view, setView] = useState('calendar')
  const [types, setTypes] = useState(EVENT_TYPES)
  const [selected, setSelected] = useState(null)

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

  const eventButton = (item, compact) => (
    <button key={item.id} type="button" className={`event-chip type-${item.type.toLowerCase()} ${compact ? 'compact' : ''}`} onClick={() => setSelected(item)}>
      {compact ? <><span className="event-time">{formatTimeRange(item.startTime).replace('Time TBA', '')}</span> {item.title}</> : (
        <>
          <strong>{item.title}</strong>
          <span>{eventTypeLabel(item.type)} · {formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span>
          <small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small>
          {item.approvalStatus && item.approvalStatus !== 'APPROVED' && <StatusBadge status={item.approvalStatus} label={item.approvalStatus === 'PENDING' ? 'Awaiting approval' : undefined} />}
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
          </div>
        ) : <strong>Upcoming events</strong>}
        <Tabs label="Calendar view" value={view} onChange={setView} options={[['calendar', 'Calendar'], ['list', 'List']]} />
      </div>

      <div className="calendar-filters" role="group" aria-label="Event types">
        {EVENT_TYPES.map((type) => (
          <button key={type} type="button" className={`filter-chip type-${type.toLowerCase()} ${types.includes(type) ? 'active' : ''}`} aria-pressed={types.includes(type)} onClick={() => toggleType(type)}>
            {eventTypeLabel(type)}
          </button>
        ))}
      </div>

      {loading && !events.length ? <Loading label="Loading schedule…" /> : view === 'list' ? (
        <div className="event-list">{listEvents.length ? listEvents.map((item) => eventButton(item, false)) : <p className="muted">No upcoming events match the selected filters.</p>}</div>
      ) : (
        <div className="calendar-grid">
          {WEEKDAYS.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
          {cells.map((day, index) => (
            <div key={index} className={`calendar-day ${day ? '' : 'blank'} ${day && isoFor(day) === today ? 'today' : ''}`}>
              {day && <>
                <span className="day-number">{day}</span>
                {visible.filter((item) => item.startDate === isoFor(day)).map((item) => eventButton(item, true))}
              </>}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal title={selected.title} subtitle={eventTypeLabel(selected.type)} onClose={() => setSelected(null)} size="sm"
          footer={<button className="btn btn-primary" type="button" onClick={() => setSelected(null)}>Close</button>}>
          <dl className="detail-list">
            <div><dt>Date</dt><dd>{formatDate(selected.startDate)}</dd></div>
            <div><dt>Time</dt><dd>{formatTimeRange(selected.startTime, selected.endTime)}</dd></div>
            <div><dt>Location</dt><dd>{selected.location || 'Location TBA'}</dd></div>
            {selected.teamName && <div><dt>Team</dt><dd>{selected.teamName}</dd></div>}
            {selected.approvalStatus && <div><dt>Status</dt><dd><StatusBadge status={selected.approvalStatus} /></dd></div>}
            {selected.rejectionReason && <div><dt>Reason</dt><dd>{selected.rejectionReason}</dd></div>}
            {selected.description && <div><dt>Details</dt><dd>{selected.description}</dd></div>}
          </dl>
        </Modal>
      )}
    </div>
  )
}
