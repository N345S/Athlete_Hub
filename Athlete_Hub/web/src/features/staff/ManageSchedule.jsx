import { eventTypeLabel, formatDate, formatTimeRange } from '../../lib/format.js'
import { ScheduleStatusBadge } from '../../components/CalendarView.jsx'
import { Card, Loading } from '../../components/ui.jsx'
import { useSeeMore } from '../../lib/lists.jsx'

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
 * when it cannot be changed; only items with actions are listed. `countLabel` names the count badge. Five are
 * shown at first and "See more" opens five more at a time.
 */
export default function ManageScheduleCard({ title, subtitle, events, loading, actionsFor, empty, countLabel = 'upcoming', id }) {
  const rows = events
    .filter((item) => actionsFor(item).length)
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`))
  const [shown, seeMore] = useSeeMore(rows, 5)

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
        {seeMore}
      </> : empty}
    </Card>
  )
}
