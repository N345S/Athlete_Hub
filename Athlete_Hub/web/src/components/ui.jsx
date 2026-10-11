import { useEffect, useId, useRef, useState } from 'react'
import { initials, statusLabel, statusTone } from '../lib/format.js'
import Icon from './icons.jsx'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

export function Card({ title, subtitle, actions, children, className = '', id }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, hint, tone = 'brand', icon, onClick }) {
  const Tag = onClick ? 'button' : 'article'
  return (
    <Tag className={`stat-card tone-${tone} ${onClick ? 'stat-card-button' : ''}`} type={onClick ? 'button' : undefined} onClick={onClick}>
      {icon && <span className="stat-icon"><Icon name={icon} size={20} /></span>}
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <small>{hint}</small>}
    </Tag>
  )
}

/** Horizontal bar for a 0–100 value; tone follows the value unless one is given. */
export function ProgressBar({ value, label, tone }) {
  if (value == null) return <span className="muted">—</span>
  const resolved = tone || (value >= 80 ? 'success' : value >= 60 ? 'warning' : 'danger')
  return (
    <span className="progress" title={label || `${value}%`}>
      <span className="progress-track"><span className={`progress-fill tone-${resolved}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
      <span className="progress-value">{value}%</span>
    </span>
  )
}

export function StatusBadge({ status, label }) {
  return <span className={`badge badge-${statusTone(status)}`}>{label || statusLabel(status)}</span>
}

export function Avatar({ firstName, lastName, size = 'md' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{initials(firstName, lastName)}</span>
}

export function EmptyState({ title, message, action, icon }) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-icon"><Icon name={icon} size={22} /></span>}
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>
}

export function Alert({ tone = 'danger', children, onDismiss }) {
  if (!children) return null
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && <button type="button" className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search' }) {
  return (
    <div className="search-input">
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  )
}

/** Form field wrapper. `required` adds a red asterisk; `optional` adds a muted "(optional)". */
export function Field({ label, hint, required, optional, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required && <span className="field-required" aria-hidden="true"> *</span>}
        {optional && <span className="field-optional"> (optional)</span>}
      </span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}

/**
 * Accessible dialog. Pass `closeOnBackdrop={false}` for forms so a stray click outside
 * does not throw away what the user typed (Escape and the × button still close it).
 */
export function Modal({ title, subtitle, onClose, children, footer, size = 'md', closeOnBackdrop = true }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  // Only close when the press both started and ended on the backdrop, so selecting text
  // inside the dialog and releasing outside it does not dismiss the dialog.
  const pressedBackdrop = useRef(false)
  // Callers usually pass an inline function; keep the latest without re-running the mount effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    dialogRef.current?.querySelector('input, select, textarea, button:not(.modal-close)')?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => { pressedBackdrop.current = event.target === event.currentTarget }}
      onMouseUp={(event) => {
        if (closeOnBackdrop && pressedBackdrop.current && event.target === event.currentTarget) onClose()
        pressedBackdrop.current = false
      }}
    >
      <section ref={dialogRef} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </section>
    </div>
  )
}

/** Replaces window.confirm with an accessible, styled dialog. */
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'danger', busy, onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={`btn btn-${tone === 'danger' ? 'danger' : 'primary'}`} type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </>}
    >
      <p className="modal-message">{message}</p>
    </Modal>
  )
}

/** Replaces window.prompt for actions that need a reason, such as rejections. */
export function ReasonDialog({ title, message, label = 'Reason', confirmLabel = 'Reject', busy, error, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" type="button" onClick={() => onConfirm(reason.trim())} disabled={busy || !reason.trim()}>{busy ? 'Saving…' : confirmLabel}</button>
      </>}
    >
      {message && <p className="modal-message">{message}</p>}
      <Field label={label} required hint="The person will see this reason, so be specific.">
        <textarea rows="4" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required />
      </Field>
      <Alert>{error}</Alert>
    </Modal>
  )
}

export function Tabs({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" className={value === key ? 'active' : ''} aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  )
}

/**
 * "More" button that opens a short list of actions. Replaces a <select> used as a menu, which
 * people often do not recognise as clickable. Items: { label, onSelect, tone?, hidden? }.
 */
export function ActionMenu({ label = 'More', ariaLabel, items }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef(null)
  const visible = items.filter((item) => !item.hidden)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => {
      if (event.key === 'Escape') { setOpen(false); rootRef.current?.querySelector('.action-menu-trigger')?.focus() }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const buttons = [...(rootRef.current?.querySelectorAll('.action-menu-item') || [])]
        const index = buttons.indexOf(document.activeElement)
        const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length
        buttons[next]?.focus()
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    rootRef.current?.querySelector('.action-menu-item')?.focus()
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!visible.length) return null
  return (
    <div className="action-menu" ref={rootRef}>
      <button type="button" className="btn btn-ghost btn-sm action-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} aria-label={ariaLabel} onClick={() => setOpen((value) => !value)}>
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="action-menu-list" role="menu" id={menuId}>
          {visible.map((item) => (
            <button key={item.label} type="button" role="menuitem" className={`action-menu-item ${item.tone ? `tone-text-${item.tone}` : ''}`} onClick={() => { setOpen(false); item.onSelect() }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Step-by-step help for the current page, opened from the "Help" button in the top bar. */
export function HelpDialog({ help, onClose }) {
  return (
    <Modal title={help.title} subtitle="How to use this page" onClose={onClose} size="md"
      footer={<button className="btn btn-primary" type="button" onClick={onClose}>Got it</button>}>
      {help.intro && <p className="modal-message">{help.intro}</p>}
      {help.steps?.length > 0 && (
        <ol className="help-steps">
          {help.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      )}
      {help.tips?.length > 0 && (
        <div className="help-tips">
          <strong>Good to know</strong>
          <ul>{help.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      )}
    </Modal>
  )
}
