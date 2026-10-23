import { api } from './api.js'

// Icon and colour for each kind of notification, matched on the start of its type (most specific first).
const KINDS = [
  ['COACH_EVALUATION', 'chat', 'warning'],
  ['PORTFOLIO_VERIFIED', 'trophy', 'success'],
  ['PORTFOLIO_REJECTED', 'trophy', 'danger'],
  ['PORTFOLIO', 'trophy', 'info'],
  ['TRAINING_APPROVAL_REQUEST', 'clock', 'warning'],
  ['TRAINING_APPROVED', 'calendar', 'success'],
  ['TRAINING_REJECTED', 'calendar', 'danger'],
  ['TRAINING_CANCELLED', 'calendar', 'danger'],
  ['TRAINING_RESCHEDULED', 'clock', 'warning'],
  ['TRAINING_ATTENDANCE', 'clipboard', 'info'],
  ['SCHEDULE_CANCELLED', 'calendar', 'danger'],
  ['SCHEDULE_RESCHEDULED', 'clock', 'warning'],
  ['SCHEDULE', 'calendar', 'brand'],
  ['ELIGIBILITY', 'check', 'info'],
  ['GRADE', 'file', 'info'],
]

export function notificationKind(type) {
  const match = KINDS.find(([prefix]) => String(type || '').startsWith(prefix))
  return match ? { icon: match[1], tone: match[2] } : { icon: 'bell', tone: 'brand' }
}

/**
 * Where selecting a notification takes each portal, by notification type. A route is a page key, or
 * { view, target } to also scroll to the element with id `target` on that page.
 */
export const NOTIFICATION_ROUTES = {
  athlete: {
    COACH_EVALUATION: { view: 'dashboard', target: 'coach-evaluation' },
    PORTFOLIO_VERIFIED: 'portfolio',
    PORTFOLIO_REJECTED: 'portfolio',
    TRAINING_APPROVED: 'schedule',
    TRAINING_CANCELLED: 'schedule',
    TRAINING_RESCHEDULED: 'schedule',
    SCHEDULE_CREATED: 'schedule',
    SCHEDULE_CANCELLED: 'schedule',
    SCHEDULE_RESCHEDULED: 'schedule',
  },
  coach: {
    PORTFOLIO_SUBMITTED: { view: 'dashboard', target: 'coach-portfolio' },
    TRAINING_APPROVED: 'schedule',
    TRAINING_REJECTED: 'schedule',
    TRAINING_CANCELLED: 'schedule',
    TRAINING_RESCHEDULED: 'schedule',
    SCHEDULE_CREATED: 'schedule',
    SCHEDULE_CANCELLED: 'schedule',
    SCHEDULE_RESCHEDULED: 'schedule',
    GRADE_EVALUATION_REQUEST: 'athletes',
    ELIGIBILITY_DECISION: 'athletes',
  },
  director: {
    TRAINING_APPROVAL_REQUEST: { view: 'dashboard', target: 'training-approvals' },
    TRAINING_CANCELLED: 'schedule',
    TRAINING_RESCHEDULED: 'schedule',
    GRADE_EVALUATION_UPLOADED: 'athletes',
    ELIGIBILITY_DECISION: 'athletes',
  },
  registrar: {
    GRADE_EVALUATION_REQUEST: 'requests',
  },
  parent: {
    TRAINING_APPROVED: 'training',
    TRAINING_CANCELLED: 'training',
    TRAINING_RESCHEDULED: 'training',
    TRAINING_ATTENDANCE: 'training',
  },
}

/** Opens the page a route points to and, once it has rendered, scrolls to and briefly highlights its target. */
export function goToRoute(route, onNavigate) {
  const { view, target } = typeof route === 'string' ? { view: route } : route
  onNavigate(view)
  if (!target) return
  // Wait for the page to render (and for the layout's scroll-to-top on a page change) before scrolling.
  setTimeout(() => {
    const element = document.getElementById(target)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    element.classList.add('is-highlighted')
    setTimeout(() => element.classList.remove('is-highlighted'), 1800)
  }, 150)
}

/**
 * Selecting a notification marks it read and opens the page it is about. `onRead` runs once the server has
 * recorded the read, so the caller can refresh the unread count. Returns whether the notification had a page to open.
 */
export function openNotification(item, { token, routes, onNavigate, onRead }) {
  if (!item.isRead) {
    api.put(`/api/Notifications/${item.notificationId}/read`, undefined, token)
      .then(() => onRead?.())
      // Not being able to mark it read should not stop the person from getting to the page.
      .catch(() => {})
  }
  const route = routes?.[item.notificationType]
  if (route) goToRoute(route, onNavigate)
  return Boolean(route)
}
