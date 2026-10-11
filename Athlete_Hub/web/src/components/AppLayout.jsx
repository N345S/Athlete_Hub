import { useEffect, useState } from 'react'
import { Avatar, HelpDialog } from './ui.jsx'
import Icon from './icons.jsx'
import InstallApp from './InstallApp.jsx'
import { fullName } from '../lib/format.js'

// Optional link to a usability survey (e.g. a SUS questionnaire) shown during user testing.
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL

/**
 * Shared portal shell: sidebar navigation, top bar with help and notifications, and the page area.
 * `nav` is a list of { key, label, icon?, badge? }; `activeKey` highlights the current section.
 * `help` is { title, intro?, steps?, tips? } describing the current page, shown from the Help button.
 * Pass `showNotifications={false}` for roles that receive no notifications.
 */
export default function AppLayout({ portal, roleLabel, session, nav, activeKey, pageTitle, onNavigate, onLogout, unreadCount = 0, showNotifications = true, help, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // Name the browser tab after the page so testers (and screen-reader users) know where they are.
  useEffect(() => {
    document.title = `${pageTitle} · ${portal} · Athlete-Hub`
  }, [pageTitle, portal])

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const navigate = (key) => {
    setMenuOpen(false)
    onNavigate(key)
  }

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to main content</a>
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
          <span className="sidebar-section">Menu</span>
          {nav.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-link ${activeKey === item.key ? 'active' : ''}`}
              aria-current={activeKey === item.key ? 'page' : undefined}
              onClick={() => navigate(item.key)}
            >
              <span className="nav-link-label">{item.icon && <Icon name={item.icon} />}{item.label}</span>
              {item.badge > 0 && <span className="nav-badge" aria-label={`${item.badge} new`}>{item.badge > 99 ? '99+' : item.badge}</span>}
            </button>
          ))}
        </nav>

        <InstallApp className="sidebar-feedback sidebar-install" label="Install app" />
        {FEEDBACK_URL && (
          <a className="sidebar-feedback" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
            <Icon name="chat" /> Give feedback
          </a>
        )}
        <button className="sidebar-logout" type="button" onClick={onLogout}><Icon name="logout" /> Sign out</button>
        <small className="sidebar-version">Athlete-Hub · {roleLabel} access</small>
      </aside>

      <button className="sidebar-scrim" type="button" aria-label="Close menu" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-toggle" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>☰</button>
          <div className="breadcrumbs">
            <span>{portal}</span>
            <span aria-hidden="true">›</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-actions">
            {help && (
              <button className="btn btn-ghost btn-sm topbar-help" type="button" onClick={() => setHelpOpen(true)} aria-haspopup="dialog">
                <span className="help-mark" aria-hidden="true">?</span><span className="topbar-help-label">Help</span>
              </button>
            )}
            {showNotifications && <button
              className="icon-button notification-bell"
              type="button"
              onClick={() => navigate('notifications')}
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              title="Notifications"
            >
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>}
            <span className="topbar-user">
              <Avatar firstName={session.firstName} lastName={session.lastName} size="sm" />
              <span>
                <strong>{session.firstName || roleLabel}</strong>
                <small>{roleLabel}</small>
              </span>
            </span>
          </div>
        </header>
        <main className="page" id="main-content" tabIndex={-1}>{children}</main>
      </div>
      {helpOpen && help && <HelpDialog help={help} onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
