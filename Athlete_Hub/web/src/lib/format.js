/** Today's date as YYYY-MM-DD in the user's local time zone (toISOString would use UTC). */
export function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatDate(value) {
  if (!value) return 'Date not set'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date not set'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatTime(value) {
  if (!value) return 'Time TBA'
  const [hours, minutes] = String(value).split(':')
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes))
  return Number.isNaN(date.getTime()) ? 'Time TBA' : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)}${end ? ` – ${formatTime(end)}` : ''}`
}

export function longToday() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function initials(firstName, lastName, fallback = 'AH') {
  const value = `${(firstName || '').trim().slice(0, 1)}${(lastName || '').trim().slice(0, 1)}`
  return (value || fallback).toUpperCase()
}

export function fullName(person, fallback = 'Unnamed') {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || fallback
}

export function matchesSearch(search, ...values) {
  const term = search.trim().toLowerCase()
  return !term || values.filter(Boolean).join(' ').toLowerCase().includes(term)
}

const STATUS_LABELS = {
  VERIFIED: 'Verified',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PENDING: 'Pending',
  ELIGIBLE: 'Eligible',
  INELIGIBLE: 'Ineligible',
  AT_RISK: 'Monitored',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
}

export function statusLabel(status) {
  const key = String(status || 'PENDING').toUpperCase()
  return STATUS_LABELS[key] || key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

/** Maps a status to one of the badge tones defined in styles.css. */
export function statusTone(status) {
  switch (String(status || '').toUpperCase()) {
    case 'VERIFIED':
    case 'APPROVED':
    case 'ELIGIBLE':
    case 'ACTIVE':
    case 'PRESENT':
      return 'success'
    case 'REJECTED':
    case 'INELIGIBLE':
    case 'SUSPENDED':
    case 'ABSENT':
      return 'danger'
    case 'AT_RISK':
    case 'LATE':
    case 'INACTIVE':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function eventTypeLabel(type) {
  return String(type || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

/**
 * Rosters arrive as one row per team membership; collapse them to one row per athlete,
 * joining team and sport names for athletes on several teams.
 */
export function mergeAthleteTeams(rows) {
  const byId = new Map()
  for (const row of rows) {
    const existing = byId.get(row.athleteId)
    if (!existing) {
      byId.set(row.athleteId, { ...row, teamNames: row.teamName ? [row.teamName] : [], sports: row.sport ? [row.sport] : [] })
      continue
    }
    if (row.teamName && !existing.teamNames.includes(row.teamName)) existing.teamNames.push(row.teamName)
    if (row.sport && !existing.sports.includes(row.sport)) existing.sports.push(row.sport)
  }
  return [...byId.values()].map((athlete) => ({
    ...athlete,
    teamName: athlete.teamNames.join(', ') || null,
    sport: athlete.sports.join(' · ') || null,
  }))
}

export const isActiveAccount = (person) => !person?.accountStatus || person.accountStatus === 'ACTIVE'

/** Badge label for a non-active account, e.g. "Account suspended". */
export const accountLabel = (person) => `Account ${String(person?.accountStatus || '').toLowerCase()}`
