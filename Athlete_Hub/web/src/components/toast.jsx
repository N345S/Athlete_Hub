import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)
const DURATION = { success: 4000, info: 5000, warning: 7000, danger: 8000 }

/**
 * Short-lived confirmation messages ("Document uploaded") shown in the corner, so feedback is
 * visible even when the button that triggered it is far from any inline alert.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const show = useCallback((message, tone = 'success') => {
    if (!message) return
    const id = ++nextId.current
    setToasts((current) => [...current.slice(-3), { id, message, tone }])
    setTimeout(() => dismiss(id), DURATION[tone] || DURATION.info)
  }, [dismiss])

  const api = useMemo(() => ({
    success: (message) => show(message, 'success'),
    info: (message) => show(message, 'info'),
    warning: (message) => show(message, 'warning'),
    error: (message) => show(message, 'danger'),
  }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === 'danger' ? 'alert' : 'status'}>
            <span className="toast-mark" aria-hidden="true">{toast.tone === 'success' ? '✓' : toast.tone === 'danger' ? '!' : 'i'}</span>
            <span className="toast-message">{toast.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss message">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const NO_TOASTS = { success: () => {}, info: () => {}, warning: () => {}, error: () => {} }

// eslint-disable-next-line react/only-export-components
export function useToast() {
  return useContext(ToastContext) || NO_TOASTS
}
