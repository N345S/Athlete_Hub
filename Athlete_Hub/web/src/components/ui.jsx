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

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
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

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}

export function Modal({ title, subtitle, onClose, children, footer, size = 'md' }) {
  const titleId = useId()
  const dialogRef = useRef(null)
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
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
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
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" type="button" onClick={() => onConfirm(reason.trim())} disabled={busy || !reason.trim()}>{busy ? 'Saving…' : confirmLabel}</button>
      </>}
    >
      {message && <p className="modal-message">{message}</p>}
      <Field label={label}>
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
