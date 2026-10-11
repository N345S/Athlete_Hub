import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateTime, timeAgo } from '../lib/format.js'
import { useApiData } from '../lib/hooks.js'
import { Alert, Card, EmptyState, Loading, PageHeader, Tabs } from './ui.jsx'

export default function NotificationsPage({ session, onChanged }) {
  const { data, loading, error, setData } = useApiData('/api/Notifications/me', session.token, { initialData: [] })
  const [actionError, setActionError] = useState('')
  const [filter, setFilter] = useState('all')
  const notifications = data || []
  const unread = notifications.filter((item) => !item.isRead).length
  const shown = filter === 'unread' ? notifications.filter((item) => !item.isRead) : notifications

  const markRead = async (item) => {
    if (item.isRead) return
    setData((current) => current.map((entry) => entry.notificationId === item.notificationId ? { ...entry, isRead: true } : entry))
    try {
      await api.put(`/api/Notifications/${item.notificationId}/read`, undefined, session.token)
      onChanged?.()
    } catch (err) {
      setActionError(err.message)
    }
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
        actions={unread > 0 && <button className="btn btn-secondary" type="button" onClick={markAllRead}>Mark all as read</button>}
      />
      <Alert>{error || actionError}</Alert>
      <Card
        title={filter === 'unread' ? 'Unread' : 'All notifications'}
        subtitle="Select a notification to mark it as read."
        actions={<Tabs label="Show" value={filter} onChange={setFilter} options={[['all', `All (${notifications.length})`], ['unread', `Unread (${unread})`]]} />}
      >
        {loading && !notifications.length ? <Loading label="Loading notifications…" /> : shown.length ? (
          <ul className="notification-list">
            {shown.map((item) => (
              <li key={item.notificationId}>
                <button type="button" className={`notification-item ${item.isRead ? '' : 'unread'}`} onClick={() => markRead(item)}>
                  <span className="notification-dot" aria-hidden="true" />
                  <span className="notification-copy">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small title={formatDateTime(item.createdAt)}>{timeAgo(item.createdAt) || 'Just now'}</small>
                  </span>
                  {!item.isRead && <span className="visually-hidden">Unread. Select to mark as read.</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : filter === 'unread' && notifications.length
          ? <EmptyState icon="check" title="No unread notifications" message="You have read everything." action={<button className="btn btn-secondary btn-sm" type="button" onClick={() => setFilter('all')}>Show all</button>} />
          : <EmptyState icon="bell" title="No notifications yet" message="Approvals, reviews, and reminders will appear here." />}
      </Card>
    </>
  )
}
