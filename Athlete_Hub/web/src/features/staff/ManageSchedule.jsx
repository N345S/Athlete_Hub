import { useState } from 'react'
import { eventTypeLabel, formatDate, formatTimeRange } from '../../lib/format.js'
import { ScheduleStatusBadge } from '../../components/CalendarView.jsx'
import { Card, Loading } from '../../components/ui.jsx'

// The list shows the next few items; the rest are one click away.
const PREVIEW_COUNT = 5

/** Buttons for the actions on one schedule item ({ label, onSelect, tone? }); `small` for list rows. */
export function ChangeButtons({ actions, small }) {
  return actions.map((action) => (
    <button key={action.label} type="button" className={`btn ${small ? 'btn-sm' : ''} ${action.tone === 'danger' ? 'btn-danger-outline' : 'btn-secondary'}`} onClick={action.onSelect}>
      {action.label}
    </button>
  ))
}

/**
 * Schedule items the coach or Director can change, each with its own buttons, so the actions are in plain sight
 * rather than only inside the calendar's event dialog. `actionsFor(event)` returns the actions for an item, or none
 * when it cannot be changed; only items with actions are listed. `countLabel` names the count badge.
 */
export default function ManageScheduleCard({ title, subtitle, events, loading, actionsFor, empty, countLabel = 'upcoming', id }) {
  const [showAll, setShowAll] = useState(false)
  const rows = events
    .filter((item) => actionsFor(item).length)
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`))
  const shown = showAll ? rows : rows.slice(0, PREVIEW_COUNT)

  return (
    <Card className={id ? 'scroll-target' : ''} id={id} title={title} subtitle={subtitle} actions={rows.length > 0 && <span className="badge badge-neutral">{rows.length} {countLabel}</span>}>
      {loading && !events.length ? <Loading /> : rows.length ? <>
        <ul className="row-list">
          {shown.map((item) => (
            <li className="row" key={item.id}>
              <div className="row-main">
                <strong>{item.title}</strong>
                <span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span>
                <small>{eventTypeLabel(item.type)} · {item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small>
              </div>
              <div className="row-actions">
                <ScheduleStatusBadge item={item} />
                <ChangeButtons actions={actionsFor(item)} small />
              </div>
            </li>
          ))}
        </ul>
        {rows.length > PREVIEW_COUNT && (
          <button className="btn btn-ghost btn-sm manage-schedule-more" type="button" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show fewer' : `Show all ${rows.length}`}
          </button>
        )}
      </> : empty}
    </Card>
  )
}
