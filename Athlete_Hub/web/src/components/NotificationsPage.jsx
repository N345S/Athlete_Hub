import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { useApiData } from '../lib/hooks.js'
import { Alert, Card, EmptyState, Loading, PageHeader } from './ui.jsx'

export default function NotificationsPage({ session, onChanged }) {
  const { data, loading, error, setData } = useApiData('/api/Notifications/me', session.token, { initialData: [] })
  const [actionError, setActionError] = useState('')
  const notifications = data || []
  const unread = notifications.filter((item) => !item.isRead).length

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
      <Card>
        {loading && !notifications.length ? <Loading label="Loading notifications…" /> : notifications.length ? (
          <ul className="notification-list">
            {notifications.map((item) => (
              <li key={item.notificationId}>
                <button type="button" className={`notification-item ${item.isRead ? '' : 'unread'}`} onClick={() => markRead(item)}>
                  <span className="notification-dot" aria-hidden="true" />
                  <span className="notification-copy">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{formatDateTime(item.createdAt) || 'Just now'}</small>
                  </span>
                  {!item.isRead && <span className="visually-hidden">Unread. Select to mark as read.</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No notifications yet" message="Approvals, reviews, and reminders will appear here." />}
      </Card>
    </>
  )
}
