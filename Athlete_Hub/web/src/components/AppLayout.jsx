import { useState } from 'react'
import { Avatar } from './ui.jsx'
import Icon from './icons.jsx'
import { fullName } from '../lib/format.js'

/**
 * Shared portal shell: sidebar navigation, top bar with notifications, and the page area.
 * `nav` is a list of { key, label, icon?, badge? }; `activeKey` highlights the current section.
 * Pass `showNotifications={false}` for roles that receive no notifications.
 */
export default function AppLayout({ portal, roleLabel, session, nav, activeKey, pageTitle, onNavigate, onLogout, unreadCount = 0, showNotifications = true, children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const navigate = (key) => {
    setMenuOpen(false)
    onNavigate(key)
  }

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar" aria-label={`${portal} navigation`}>
        <div className="sidebar-brand">
          <img src="/athletehub-logo.png" alt="" />
          <div>
            <strong>Athlete-Hub</strong>
            <small>{portal}</small>
          </div>
        </div>

        <div className="sidebar-profile">
          <Avatar firstName={session.firstName} lastName={session.lastName} />
          <div>
            <strong>{fullName(session, roleLabel)}</strong>
            <small>{roleLabel}</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-link ${activeKey === item.key ? 'active' : ''}`}
              aria-current={activeKey === item.key ? 'page' : undefined}
              onClick={() => navigate(item.key)}
            >
              <span className="nav-link-label">{item.icon && <Icon name={item.icon} />}{item.label}</span>
              {item.badge > 0 && <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>}
            </button>
          ))}
        </nav>

        <button className="sidebar-logout" type="button" onClick={onLogout}>Sign out</button>
        <small className="sidebar-version">Athlete-Hub · {roleLabel} access</small>
      </aside>

      <button className="sidebar-scrim" type="button" aria-label="Close menu" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-toggle" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu">☰</button>
          <div className="breadcrumbs">
            <span>{portal}</span>
            <span aria-hidden="true">›</span>
            <strong>{pageTitle}</strong>
          </div>
          {showNotifications && <button
            className="icon-button notification-bell"
            type="button"
            onClick={() => navigate('notifications')}
            aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            {unreadCount > 0 && <span className="bell-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>}
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  )
}
