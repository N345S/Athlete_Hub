import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { useApiData } from '../lib/hooks.js'
import { openNotification } from '../lib/notifications.js'
import Icon from './icons.jsx'
import { NotificationList } from './NotificationsPage.jsx'
import { EmptyState, Loading } from './ui.jsx'

// The dropdown shows the newest few; the rest are on the notifications page.
const PREVIEW_COUNT = 6

/**
 * The bell in the top bar. Selecting it drops down a panel under the bell with the latest notifications;
 * each opens the page it is about, and "See all notifications" opens the full notifications page.
 */
export default function NotificationBell({ session, unreadCount, routes, active, onNavigate, onChanged }) {
  const [open, setOpen] = useState(false)
  const [requested, setRequested] = useState(false)
  const rootRef = useRef(null)
  const { data, loading, error, reload, setData } = useApiData(requested ? '/api/Notifications/me' : null, session.token, { initialData: [] })
  const notifications = data || []
  const unread = notifications.filter((item) => !item.isRead).length

  const toggle = () => {
    if (!open) {
      // Load on first open and fetch again on every later open, so the panel is never stale.
      if (requested) reload()
      else setRequested(true)
    }
    setOpen((value) => !value)
  }

  const close = (returnFocus) => {
    setOpen(false)
    if (returnFocus) rootRef.current?.querySelector('.notification-bell')?.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      rootRef.current?.querySelector('.notification-bell')?.focus()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (item) => {
    setData((current) => current.map((entry) => entry.notificationId === item.notificationId ? { ...entry, isRead: true } : entry))
    close(false)
    openNotification(item, { token: session.token, routes, onNavigate, onRead: onChanged })
  }

  const markAllRead = async () => {
    try {
      await api.put('/api/Notifications/me/read-all', undefined, session.token)
      setData((current) => current.map((entry) => ({ ...entry, isRead: true })))
      onChanged?.()
    } catch {
      // The full page shows errors; here the dots simply stay until the next try.
    }
  }

  const seeAll = () => {
    close(false)
    onNavigate('notifications')
  }

  return (
    <div className={`notification-menu ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        className={`icon-button notification-bell ${active || open ? 'active' : ''}`}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        title="Notifications"
      >
        <Icon name="bell" />
        {unreadCount > 0 && <span className="bell-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && <>
        {/* On phones the panel sits over a dimmed page; the scrim only shows there. */}
        <button type="button" className="notification-scrim" aria-hidden="true" tabIndex={-1} onClick={() => close(false)} />
        <div className="notification-panel" role="dialog" aria-label="Latest notifications">
          <div className="notification-panel-header">
            <div>
              <strong>Notifications</strong>
              <small>{unread ? `${unread} unread` : 'You are all caught up'}</small>
            </div>
            {unread > 0 && <button className="btn btn-ghost btn-sm" type="button" onClick={markAllRead}>Mark all as read</button>}
          </div>
          <div className="notification-panel-body">
            {loading && !notifications.length ? <Loading label="Loading…" />
              : error && !notifications.length ? <p className="notification-panel-error">{error}</p>
                : notifications.length ? <NotificationList items={notifications.slice(0, PREVIEW_COUNT)} routes={routes} compact onOpen={select} />
                  : <EmptyState icon="bell" title="No notifications yet" message="Approvals, reviews, and reminders will appear here." />}
          </div>
          <button className="notification-panel-footer" type="button" onClick={seeAll}>
            See all notifications <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </>}
    </div>
  )
}
