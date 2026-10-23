import { useEffect, useRef, useState } from 'react'
import { Avatar, HelpDialog, Modal } from './ui.jsx'
import Icon from './icons.jsx'
import InstallApp from './InstallApp.jsx'
import NotificationBell from './NotificationBell.jsx'
import { fullName } from '../lib/format.js'

// Optional link to a usability survey (e.g. a SUS questionnaire) shown during user testing.
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL

// Phones get a bottom tab bar; at most this many tabs fit comfortably, the rest move to the account sheet.
const MAX_TABS = 5

/**
 * Gives every table cell a data-label naming its column, so on phones the stylesheet can show each
 * table row as a card ("Team: Volleyball") instead of a table that scrolls sideways.
 */
function useTableCardLabels(ref) {
  useEffect(() => {
    const root = ref.current
    if (!root) return undefined
    let frame = 0
    const label = () => {
      frame = 0
      root.querySelectorAll('table.table').forEach((table) => {
        const headers = [...table.querySelectorAll('thead th')].map((th) => (th.querySelector('.visually-hidden') ? '' : th.textContent.trim()))
        table.querySelectorAll('tbody tr').forEach((row) => {
          ;[...row.children].forEach((cell, index) => {
            const text = headers[index] ?? ''
            if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text)
          })
        })
      })
    }
    label()
    // Setting attributes does not trigger childList mutations, so this cannot loop.
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(label) })
    observer.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref])
}

/**
 * Shared portal shell. On computers and tablets: sidebar navigation and a top bar with help and
 * notifications. On phones: a maroon app bar, a bottom tab bar, and an account sheet opened from the avatar.
 * `nav` is a list of { key, label, shortLabel?, icon?, badge?, locked? }; `activeKey` highlights the current section.
 * An item with `children` (a list of the same) is a collapsed group whose sections stay out of sight until it is
 * opened; on phones groups are listed under "More". `locked` shows a padlock for sections that need a password.
 * `help` is { title, intro?, steps?, tips? } describing the current page, shown from the Help button.
 * Notifications are not in the navigation: the bell drops down the latest ones, and its "See all notifications"
 * opens the portal's `notifications` page. `notificationRoutes` (see lib/notifications.js) says which page each
 * kind of notification opens; `onNotificationsChanged` runs after some are marked read, to refresh `unreadCount`.
 * Pass `showNotifications={false}` for roles that receive no notifications.
 */
export default function AppLayout({ portal, roleLabel, session, nav, activeKey, pageTitle, onNavigate, onLogout, unreadCount = 0, showNotifications = true, notificationRoutes, onNotificationsChanged, help, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef(null)
  useTableCardLabels(mainRef)

  // A group is open while one of its sections is shown, and closes again when the user moves elsewhere.
  const activeGroup = nav.find((item) => item.children?.some((child) => child.key === activeKey))?.key
  const [openGroups, setOpenGroups] = useState(activeGroup ? [activeGroup] : [])
  const [groupsFor, setGroupsFor] = useState(activeKey)
  if (groupsFor !== activeKey) {
    setGroupsFor(activeKey)
    setOpenGroups(activeGroup ? [activeGroup] : [])
  }
  const toggleGroup = (key) => setOpenGroups((open) => open.includes(key) ? open.filter((item) => item !== key) : [...open, key])

  // Name the browser tab after the page so testers (and screen-reader users) know where they are.
  useEffect(() => {
    document.title = `${pageTitle} · ${portal} · Athlete-Hub`
  }, [pageTitle, portal])

  // Like a phone app, a new section starts at the top instead of wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeKey])

  // On phones the app bar shows the page name once the large page title has scrolled away.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the slide-out menu with Escape.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const navigate = (key) => {
    setMenuOpen(false)
    setAccountOpen(false)
    onNavigate(key)
  }

  // Groups always go under "More".
  const groups = nav.filter((item) => item.children)
  const tabItems = nav.filter((item) => !item.children)
  const tabs = tabItems.length > MAX_TABS || groups.length ? tabItems.slice(0, MAX_TABS - 1) : tabItems
  const overflow = [...tabItems.filter((item) => !tabs.includes(item)), ...groups]
  const overflowActive = overflow.some((item) => item.key === activeKey || item.key === activeGroup)

  const navLink = (item, className = '') => (
    <button
      key={item.key}
      type="button"
      className={`nav-link ${className} ${activeKey === item.key ? 'active' : ''}`}
      aria-current={activeKey === item.key ? 'page' : undefined}
      onClick={() => navigate(item.key)}
    >
      <span className="nav-link-label">{item.icon && <Icon name={item.icon} />}{item.label}</span>
      {item.locked && <span className="nav-lock" title="Password required"><Icon name="lock" size={15} /><span className="visually-hidden"> (password required)</span></span>}
      {item.badge > 0 && <span className="nav-badge" aria-label={`${item.badge} new`}>{item.badge > 99 ? '99+' : item.badge}</span>}
    </button>
  )

  const sheetLink = (item, className = '') => (
    <button key={item.key} type="button" className={`sheet-item ${className} ${activeKey === item.key ? 'active' : ''}`} onClick={() => navigate(item.key)}>
      <Icon name={item.icon || 'circle'} size={20} /><span>{item.label}</span>
      {item.locked && <span className="nav-lock" title="Password required"><Icon name="lock" size={16} /><span className="visually-hidden"> (password required)</span></span>}
      {item.badge > 0 && <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>}
      <Icon name="chevronRight" size={18} className="sheet-chevron" />
    </button>
  )

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
          {nav.map((item) => item.children ? (
            <div className={`nav-group ${openGroups.includes(item.key) ? 'open' : ''}`} key={item.key}>
              <button type="button" className="nav-link nav-group-toggle" aria-expanded={openGroups.includes(item.key)} onClick={() => toggleGroup(item.key)}>
                <span className="nav-link-label">{item.icon && <Icon name={item.icon} />}{item.label}</span>
                <Icon name="chevronDown" size={16} className="nav-group-chevron" />
              </button>
              {openGroups.includes(item.key) && item.children.map((child) => navLink(child, 'nav-sublink'))}
            </div>
          ) : navLink(item))}
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
        <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
          <button className="icon-button menu-toggle" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>☰</button>
          <div className="appbar-brand" aria-hidden="true">
            <img src="/athletehub-logo.png" alt="" />
            <span className="appbar-brand-name">Athlete-Hub</span>
            <span className="appbar-page-title">{pageTitle}</span>
          </div>
          <div className="breadcrumbs">
            <span>{portal}</span>
            <span aria-hidden="true">›</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-actions">
            {help && (
              <button className="btn btn-ghost btn-sm topbar-help" type="button" onClick={() => setHelpOpen(true)} aria-haspopup="dialog" aria-label="Help for this page">
                <span className="help-mark" aria-hidden="true">?</span><span className="topbar-help-label">Help</span>
              </button>
            )}
            {showNotifications && (
              <NotificationBell
                session={session}
                unreadCount={unreadCount}
                routes={notificationRoutes}
                active={activeKey === 'notifications'}
                onNavigate={navigate}
                onChanged={onNotificationsChanged}
              />
            )}
            <span className="topbar-user">
              <Avatar firstName={session.firstName} lastName={session.lastName} size="sm" />
              <span>
                <strong>{session.firstName || roleLabel}</strong>
                <small>{roleLabel}</small>
              </span>
            </span>
            <button className="appbar-account" type="button" onClick={() => setAccountOpen(true)} aria-haspopup="dialog" aria-label="Account and settings">
              <Avatar firstName={session.firstName} lastName={session.lastName} size="sm" />
            </button>
          </div>
        </header>
        <main className="page" id="main-content" tabIndex={-1} ref={mainRef}>
          <div className="page-view" key={activeKey}>{children}</div>
        </main>
      </div>

      <nav className="tabbar" aria-label={`${portal} sections`}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tabbar-item ${activeKey === item.key ? 'active' : ''}`}
            aria-current={activeKey === item.key ? 'page' : undefined}
            onClick={() => navigate(item.key)}
          >
            <span className="tabbar-icon">
              <Icon name={item.icon || 'circle'} size={22} />
              {item.badge > 0 && <span className="tabbar-badge" aria-label={`${item.badge} new`}>{item.badge > 9 ? '9+' : item.badge}</span>}
            </span>
            <span className="tabbar-label">{item.shortLabel || item.label}</span>
          </button>
        ))}
        {overflow.length > 0 && (
          <button type="button" className={`tabbar-item ${overflowActive ? 'active' : ''}`} onClick={() => setAccountOpen(true)} aria-haspopup="dialog">
            <span className="tabbar-icon"><Icon name="more" size={22} /></span>
            <span className="tabbar-label">More</span>
          </button>
        )}
      </nav>

      {accountOpen && (
        <Modal title={fullName(session, roleLabel)} subtitle={`${roleLabel} · ${portal}`} onClose={() => setAccountOpen(false)} size="sm">
          <div className="account-sheet">
            {overflow.length > 0 && (
              <div className="sheet-group">
                {overflow.map((item) => item.children ? [
                  <button key={item.key} type="button" className={`sheet-item sheet-group-toggle ${openGroups.includes(item.key) ? 'open' : ''}`} aria-expanded={openGroups.includes(item.key)} onClick={() => toggleGroup(item.key)}>
                    <Icon name={item.icon || 'circle'} size={20} /><span>{item.label}</span>
                    <Icon name="chevronDown" size={18} className="sheet-chevron" />
                  </button>,
                  ...(openGroups.includes(item.key) ? item.children.map((child) => sheetLink(child, 'sheet-subitem')) : []),
                ] : sheetLink(item))}
              </div>
            )}
            <div className="sheet-group">
              {help && (
                <button type="button" className="sheet-item" onClick={() => { setAccountOpen(false); setHelpOpen(true) }}>
                  <Icon name="help" size={20} /><span>How to use this page</span>
                  <Icon name="chevronRight" size={18} className="sheet-chevron" />
                </button>
              )}
              <InstallApp className="sheet-item" label="Install app on this phone" />
              {FEEDBACK_URL && (
                <a className="sheet-item" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
                  <Icon name="chat" size={20} /><span>Give feedback</span>
                  <Icon name="chevronRight" size={18} className="sheet-chevron" />
                </a>
              )}
            </div>
            <div className="sheet-group">
              <button type="button" className="sheet-item tone-text-danger" onClick={onLogout}>
                <Icon name="logout" size={20} /><span>Sign out</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
      {helpOpen && help && <HelpDialog help={help} onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
