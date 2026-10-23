import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateTime, timeAgo } from '../lib/format.js'
import { useApiData } from '../lib/hooks.js'
import { notificationKind, openNotification } from '../lib/notifications.js'
import Icon from './icons.jsx'
import { Alert, Card, EmptyState, Loading, PageHeader, Tabs } from './ui.jsx'

const DAY = 24 * 60 * 60 * 1000

/** "Today", "Yesterday", "This week", or "Earlier", for grouping the full list. */
function dayGroup(value) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const days = Math.round((today - date) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  return 'Earlier'
}

/**
 * One notification: an icon for its kind, the title and time, and the message. Selecting it calls `onOpen`;
 * `linked` adds a chevron to show it leads to a page. `compact` clamps long messages (the bell's dropdown).
 */
export function NotificationItem({ item, linked, compact, onOpen }) {
  const kind = notificationKind(item.notificationType)
  return (
    <button type="button" className={`notification-item ${item.isRead ? '' : 'unread'} ${compact ? 'compact' : ''}`} onClick={() => onOpen(item)}>
      <span className={`notification-icon tone-${kind.tone}`} aria-hidden="true"><Icon name={kind.icon} size={18} /></span>
      <span className="notification-copy">
        <span className="notification-head">
          <strong>{item.title}</strong>
          <small title={formatDateTime(item.createdAt)}>{timeAgo(item.createdAt) || 'just now'}</small>
        </span>
        <span className="notification-message">{item.message}</span>
      </span>
      {!item.isRead && <span className="notification-dot" aria-hidden="true" />}
      {linked && <Icon name="chevronRight" size={16} className="notification-chevron" />}
      {!item.isRead && <span className="visually-hidden">Unread.</span>}
    </button>
  )
}

/** A list of notifications that opens each one's page when selected. Used by the page, the bell, and dashboards. */
export function NotificationList({ items, routes, compact, onOpen }) {
  return (
    <ul className="notification-list">
      {items.map((item) => (
        <li key={item.notificationId}>
          <NotificationItem item={item} linked={Boolean(routes?.[item.notificationType])} compact={compact} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}

/**
 * The full notifications page, opened from "See all notifications" in the bell's dropdown. Selecting a
 * notification marks it read and, when it is about something specific, opens that page.
 */
export default function NotificationsPage({ session, routes, onNavigate, onChanged }) {
  const { data, loading, error, setData } = useApiData('/api/Notifications/me', session.token, { initialData: [] })
  const [actionError, setActionError] = useState('')
  const [filter, setFilter] = useState('all')
  const notifications = data || []
  const unread = notifications.filter((item) => !item.isRead).length
  const shown = filter === 'unread' ? notifications.filter((item) => !item.isRead) : notifications
  const groups = shown.reduce((list, item) => {
    const label = dayGroup(item.createdAt)
    const group = list.find((entry) => entry.label === label)
    if (group) group.items.push(item)
    else list.push({ label, items: [item] })
    return list
  }, [])

  const open = (item) => {
    setData((current) => current.map((entry) => entry.notificationId === item.notificationId ? { ...entry, isRead: true } : entry))
    openNotification(item, { token: session.token, routes, onNavigate, onRead: onChanged })
  }

  const markAllRead = async () => {
    setActionError('')
    try {
      await api.put('/api/Notifications/me/read-all', undefined, session.token)
      setData((current) => current.map((entry) => ({ ...entry, isRead: true })))
      onChanged?.()
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up'}
        actions={unread > 0 && <button className="btn btn-secondary" type="button" onClick={markAllRead}><Icon name="check" /> Mark all as read</button>}
      />
      <Alert>{error || actionError}</Alert>
      <Card
        className="notifications-card"
        title={filter === 'unread' ? 'Unread' : 'All notifications'}
        subtitle="Select a notification to open what it is about."
        actions={<Tabs label="Show" value={filter} onChange={setFilter} options={[['all', `All (${notifications.length})`], ['unread', `Unread (${unread})`]]} />}
      >
        {loading && !notifications.length ? <Loading label="Loading notifications…" /> : shown.length ? (
          groups.map((group) => (
            <section className="notification-group" key={group.label} aria-label={group.label}>
              <h3 className="notification-group-title">{group.label}</h3>
              <NotificationList items={group.items} routes={routes} onOpen={open} />
            </section>
          ))
        ) : filter === 'unread' && notifications.length
          ? <EmptyState icon="check" title="No unread notifications" message="You have read everything." action={<button className="btn btn-secondary btn-sm" type="button" onClick={() => setFilter('all')}>Show all</button>} />
          : <EmptyState icon="bell" title="No notifications yet" message="Approvals, reviews, and reminders will appear here." />}
      </Card>
    </>
  )
}
