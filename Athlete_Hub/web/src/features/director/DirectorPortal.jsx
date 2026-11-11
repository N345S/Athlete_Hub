import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { accountLabel, average, eventTypeLabel, formatDate, formatTimeRange, fullName, isActiveAccount, localDateISO, longToday, matchesSearch, mergeAthleteTeams } from '../../lib/format.js'
import { useApiData, useHashView, usePageDetail, useSensitiveAccess, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView, { ScheduleStatusBadge } from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Avatar, Card, ConfirmDialog, EmptyState, Loading, Modal, PageHeader, ProgressBar, SearchInput, StatCard, StatusBadge, Tabs } from '../../components/ui.jsx'
import { EligibilityBadge, EligibilityRulesDialog } from '../../components/Eligibility.jsx'
import Icon from '../../components/icons.jsx'
import { HELP } from '../../lib/help.js'
import { NOTIFICATION_ROUTES } from '../../lib/notifications.js'
import { REGISTRAR_ELIGIBILITY } from '../../lib/features.js'
import AccountsPage from '../accounts/AccountsPage.jsx'
import AthletesPage from '../staff/AthletesPage.jsx'
import AthleteProfilePage from '../staff/AthleteProfilePage.jsx'
import LineupsPage from '../staff/LineupsPage.jsx'
import PerformancePage from '../staff/PerformancePage.jsx'
import { ChangeButtons } from '../staff/ManageSchedule.jsx'
import { EventScheduleModal, ScheduleChangeModal } from '../staff/ScheduleModals.jsx'
import TrainingApprovals from '../staff/TrainingApprovals.jsx'
import CoachEvaluationsCard from './CoachEvaluationsCard.jsx'
import GradesPage, { AthleteGradesModal } from './GradesPage.jsx'
import { LockedPage, UnlockDialog } from './SensitiveAccess.jsx'

const VIEWS = ['dashboard', 'coaches', 'athletes', 'lineups', 'grades', 'schedule', 'performance', 'accounts', 'notifications']
const TITLES = { dashboard: 'Dashboard', coaches: 'Coaches', athletes: 'All athletes', lineups: 'Event lineups', grades: 'Grades', schedule: 'Schedule', performance: 'Performance', accounts: 'Accounts', notifications: 'Notifications' }
// Hidden under "More" in the menu and opened only with the director's page password.
const CONFIDENTIAL = ['grades', 'accounts']

/**
 * The athlete's active teams. Assigned means on a coach's team. `currentTeams` lists every team;
 * an API without it still sends `currentCoach` (their first coached team), so fall back to that
 * instead of treating everyone as unassigned.
 */
const athleteTeams = (athlete) => athlete.currentTeams
  ?? (athlete.currentCoach ? [{ teamName: athlete.currentCoach.teamName, coachId: athlete.currentCoach.coachId, coachName: athlete.currentCoach.coachName }] : [])

/** A small selectable athlete card for the assign dialog. */
function AssignAthleteCard({ athlete, selected, onToggle }) {
  const teams = athleteTeams(athlete)
  const details = [athlete.studentNumber || 'Student ID pending', athlete.course, athlete.yearLevel ? `Year ${athlete.yearLevel}` : null].filter(Boolean).join(' · ')
  return (
    <button type="button" className={`assign-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onToggle}>
      <Avatar firstName={athlete.firstName} lastName={athlete.lastName} size="md" />
      <span className="assign-card-text">
        <strong title={fullName(athlete)}>{fullName(athlete)}</strong>
        <small title={details}>{details}</small>
        {teams.length > 0 && (
          <span className="assign-card-team" title={teams.map((team) => `${team.teamName}${team.coachName ? ` · Coach ${team.coachName}` : ''}`).join('\n')}>
            <Icon name="team" size={13} />
            <span>{teams[0].teamName}{teams[0].coachName ? ` · ${teams[0].coachName}` : ' · No coach'}{teams.length > 1 ? ` +${teams.length - 1}` : ''}</span>
          </span>
        )}
        {!isActiveAccount(athlete) && <StatusBadge status={athlete.accountStatus} label={accountLabel(athlete)} />}
      </span>
      <span className="assign-check" aria-hidden="true">{selected && <Icon name="check" size={14} />}</span>
    </button>
  )
}

/**
 * Pick one or more athletes for a coach's active team. Athletes without a team are shown first; the
 * "On another team" filter is for reassigning, with a choice to move them or add a second team.
 */
function AssignAthleteModal({ coach, teamName, noTeam, session, onClose, onAssigned }) {
  const { data, loading, error } = useApiData('/api/Director/athletes', session.token)
  const [filter, setFilter] = useState('unassigned')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [move, setMove] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Athletes this coach already coaches are left out; assigning them again would do nothing.
  // Active accounts are listed before inactive or suspended ones.
  const candidates = (data?.athletes || [])
    .filter((athlete) => !athleteTeams(athlete).some((team) => team.coachId === coach.coachId))
    .sort((a, b) => Number(!isActiveAccount(a)) - Number(!isActiveAccount(b)))
  const unassigned = candidates.filter((athlete) => !athleteTeams(athlete).length)
  const onOtherTeams = candidates.filter((athlete) => athleteTeams(athlete).length)
  const shown = (filter === 'unassigned' ? unassigned : onOtherTeams).filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.studentNumber, athlete.course, ...athleteTeams(athlete).flatMap((team) => [team.teamName, team.coachName])))
  const chosen = candidates.filter((athlete) => selected.includes(athlete.athleteId))
  const chosenOnTeams = chosen.filter((athlete) => athleteTeams(athlete).length)
  const oldTeams = [...new Set(chosenOnTeams.flatMap((athlete) => athleteTeams(athlete).map((team) => team.teamName)))]
  const toggle = (athleteId) => setSelected((current) => current.includes(athleteId) ? current.filter((id) => id !== athleteId) : [...current, athleteId])

  const submit = async () => {
    setSaving(true)
    setSaveError('')
    const done = []
    try {
      for (const athlete of chosen) {
        await api.post(`/api/Director/coaches/${coach.coachId}/assign-athlete`, { athleteId: athlete.athleteId, moveFromOtherTeams: move && athleteTeams(athlete).length > 0 }, session.token)
        done.push(athlete)
      }
      onAssigned({ count: done.length, moved: move ? done.filter((athlete) => athleteTeams(athlete).length).length : 0 })
    } catch (err) {
      // Keep only the athletes that still need assigning selected, so retrying does not repeat the others.
      setSelected((current) => current.filter((id) => !done.some((athlete) => athlete.athleteId === id)))
      setSaveError(done.length ? `${done.length} assigned, then: ${err.message}` : err.message)
    } finally {
      setSaving(false)
    }
  }

  const count = `${chosen.length} athlete${chosen.length === 1 ? '' : 's'}`
  const actionLabel = !chosen.length ? 'Select athletes'
    : move && chosenOnTeams.length === chosen.length ? `Move ${count}`
    : `Assign ${count}`

  return (
    <Modal title="Assign athletes" subtitle={teamName ? `Add athletes to ${teamName}, coached by ${fullName(coach)}.` : `Add athletes to ${fullName(coach)}’s active team.`} onClose={onClose} closeOnBackdrop={false} size="lg"
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="button" onClick={submit} disabled={saving || !chosen.length || noTeam}>{saving ? 'Saving…' : actionLabel}</button>
      </>}>
      {noTeam && <Alert tone="warning">{fullName(coach)} has no active team yet, so athletes cannot be assigned. Their team needs to be created or activated first.</Alert>}
      <div className="assign-toolbar">
        <Tabs label="Show athletes" value={filter} onChange={setFilter} options={[['unassigned', `No team (${unassigned.length})`], ['assigned', `On another team (${onOtherTeams.length})`]]} />
        <SearchInput value={search} onChange={setSearch} placeholder={filter === 'unassigned' ? 'Search name or ID…' : 'Search name, team, or coach…'} label="Search athletes" />
      </div>
      <p className="assign-hint">
        {filter === 'unassigned' ? 'These athletes have no team or coach yet. Tap each one you want to add.' : 'These athletes already have a team. Select one to reassign them to this coach.'}
      </p>
      {loading && !data ? <Loading label="Loading athletes…" /> : shown.length ? (
        <div className="assign-grid">
          {shown.map((athlete) => <AssignAthleteCard key={athlete.athleteId} athlete={athlete} selected={selected.includes(athlete.athleteId)} onToggle={() => toggle(athlete.athleteId)} />)}
        </div>
      ) : search ? <EmptyState title="No matches" message="Try a different name, ID, or team." />
        : filter === 'unassigned'
          ? <EmptyState icon="check" title="Every athlete has a team" message="To reassign someone, look under “On another team”." action={<button className="btn btn-secondary btn-sm" type="button" onClick={() => setFilter('assigned')}>Show athletes on other teams</button>} />
          : <EmptyState icon="users" title="No athletes on other teams" />}
      {chosen.length > 0 && (
        <div className="assign-selection">
          <div className="assign-selection-header">
            <strong>{chosen.length} selected</strong>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelected([])}>Clear</button>
          </div>
          <ul className="selected-date-list">
            {chosen.map((athlete) => (
              <li key={athlete.athleteId}>{fullName(athlete)}<button type="button" aria-label={`Remove ${fullName(athlete)}`} onClick={() => toggle(athlete.athleteId)}>×</button></li>
            ))}
          </ul>
          {chosenOnTeams.length > 0 && (
            <fieldset className="choice-cards">
              <legend className="field-label">{chosenOnTeams.length === 1 ? `${fullName(chosenOnTeams[0])} is already on ${oldTeams.join(', ')}` : `${chosenOnTeams.length} selected athletes already have a team`}</legend>
              <label className={`choice-card ${move ? 'selected' : ''}`}>
                <input type="radio" name="assign-mode" checked={move} onChange={() => setMove(true)} />
                <span><strong>Move to {teamName || 'this team'}</strong><small>They leave {oldTeams.join(', ')}. Past attendance and records are kept.</small></span>
              </label>
              <label className={`choice-card ${!move ? 'selected' : ''}`}>
                <input type="radio" name="assign-mode" checked={!move} onChange={() => setMove(false)} />
                <span><strong>Add as an extra team</strong><small>They stay on their current team too, e.g. a multi-sport athlete.</small></span>
              </label>
            </fieldset>
          )}
        </div>
      )}
      <Alert>{error || saveError}</Alert>
    </Modal>
  )
}

/** One coach's teams and athletes, with each athlete's attendance, and what students said in their evaluations. */
function CoachProfile({ coach, session, athleteIndex, onOpenAthlete, onBack, onRosterChanged }) {
  const toast = useToast()
  const profile = useApiData(`/api/Director/coaches/${coach.coachId}`, session.token)
  const [showAssign, setShowAssign] = useState(false)
  const [unassigning, setUnassigning] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const data = profile.data
  const roster = (data?.assignedAthletes || []).map((athlete) => ({ ...athlete, ...athleteIndex.get(athlete.athleteId), teamName: athlete.teamName }))
  const activeTeam = data?.teams?.find((team) => String(team.status).toUpperCase() === 'ACTIVE')

  const unassign = async () => {
    setBusy(true)
    setError('')
    try {
      await api.del(`/api/Director/coaches/${coach.coachId}/unassign-athlete/${unassigning.athleteId}`, session.token)
      toast.success(`${fullName(unassigning)} removed from ${fullName(coach)}'s team.`)
      setUnassigning(null)
      profile.reload()
      onRosterChanged?.()
    } catch (err) {
      setError(err.message)
      setUnassigning(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn btn-ghost back-button" type="button" onClick={onBack}>← Back to coaches</button>
      <section className="profile-hero">
        <Avatar firstName={coach.firstName} lastName={coach.lastName} size="xl" />
        <div>
          <h1>{fullName(coach)}</h1>
          <p>{coach.specialization || 'Coach'} · {coach.email || 'Email unavailable'}</p>
        </div>
        {!isActiveAccount(coach) && <StatusBadge status={coach.accountStatus} label={accountLabel(coach)} />}
        <button className="btn btn-primary hero-action" type="button" onClick={() => setShowAssign(true)}>+ Assign athletes</button>
      </section>
      <Alert>{profile.error || error}</Alert>
      {profile.loading && !data ? <Loading label="Loading coach profile…" /> : <>
        <dl className="detail-grid">
          <div><dt>Specialization</dt><dd>{data?.specialization || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{data?.phone || '—'}</dd></div>
          <div><dt>Assigned athletes</dt><dd>{data?.totalAssignedAthletes ?? 0}</dd></div>
          <div><dt>Avg. attendance</dt><dd><ProgressBar value={average(roster.map((athlete) => athlete.attendanceRate))} /></dd></div>
        </dl>
        <div className="stack">
          <Card title="Teams">
            {data?.teams?.length ? (
              <ul className="row-list">
                {data.teams.map((team) => (
                  <li className="row" key={team.teamId}>
                    <div className="row-main"><strong>{team.teamName}</strong><span>{team.schoolYear || ''}</span></div>
                    <div className="row-actions"><StatusBadge status={team.status} /><span className="badge badge-neutral">{team.athletesCount} athlete{team.athletesCount === 1 ? '' : 's'}</span></div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="team" title="No teams" message="This coach is not assigned to a team, so athletes cannot be assigned yet." />}
          </Card>
          <Card title="Assigned athletes" subtitle="Attendance and eligibility for each athlete">
            {roster.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Athlete</th><th>Team</th><th>Attendance</th><th>Eligibility</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                  <tbody>
                    {roster.map((athlete) => (
                      <tr key={athlete.athleteId}>
                        <td>
                          <button className="link-button" type="button" onClick={() => onOpenAthlete(athlete.athleteId)}>{fullName(athlete)}</button>
                          <br /><small className="muted">{athlete.studentNumber}</small>
                          {!isActiveAccount(athlete) && <> <StatusBadge status={athlete.accountStatus} /></>}
                        </td>
                        <td>{athlete.teamName}</td>
                        <td><ProgressBar value={athlete.attendanceRate} /></td>
                        <td><EligibilityBadge status={athlete.eligibilityStatus} reasons={athlete.eligibilityReasons} showReasons /></td>
                        <td className="table-action"><button className="btn btn-ghost btn-sm" type="button" onClick={() => setUnassigning(athlete)}>Unassign</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon="users" title="No athletes assigned" />}
          </Card>
          <CoachEvaluationsCard coach={coach} session={session} />
        </div>
      </>}
      {showAssign && (
        <AssignAthleteModal
          coach={coach}
          teamName={activeTeam?.teamName}
          noTeam={Boolean(data) && !activeTeam}
          session={session}
          onClose={() => setShowAssign(false)}
          onAssigned={({ count, moved }) => {
            setShowAssign(false)
            toast.success(`${count} athlete${count === 1 ? '' : 's'} ${moved === count ? 'moved' : 'assigned'} to ${activeTeam?.teamName || `${fullName(coach)}’s team`}.`)
            profile.reload()
            onRosterChanged?.()
          }}
        />
      )}
      {unassigning && (
        <ConfirmDialog
          title="Unassign athlete"
          message={`Remove ${fullName(unassigning)} from ${fullName(coach)}'s team? Their records are kept.`}
          confirmLabel="Unassign"
          busy={busy}
          onCancel={() => setUnassigning(null)}
          onConfirm={unassign}
        />
      )}
    </>
  )
}

/** Roll-up of every coach: roster size, attendance, restricted athletes, and pending requests. */
function coachSummaries(coaches, athleteRows, pendingSessions) {
  return coaches.map((coach) => {
    const teamNames = new Set((coach.teams || []).map((team) => team.teamName))
    const roster = athleteRows.filter((athlete) => (athlete.teams || []).some((team) => teamNames.has(team.teamName)) && isActiveAccount(athlete))
    return {
      coach,
      athletes: roster.length,
      attendance: average(roster.map((athlete) => athlete.attendanceRate)),
      restricted: roster.filter((athlete) => athlete.eligibilityStatus === 'RESTRICTED').length,
      pending: pendingSessions.filter((session) => session.coachName === fullName(coach)).length,
    }
  })
}

function CoachesPage({ summaries, loading, onOpen }) {
  const [search, setSearch] = useState('')
  const filtered = summaries.filter(({ coach }) => matchesSearch(search, coach.firstName, coach.lastName, coach.email, coach.specialization))
  return (
    <>
      <PageHeader title="Coaches" subtitle="Coach accounts, their teams, and how their athletes are doing" actions={<span className="badge badge-neutral">{summaries.length} total</span>} />
      <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search coaches…" label="Search coaches" /></div>
      {loading && !summaries.length ? <Loading label="Loading coaches…" /> : filtered.length ? (
        <div className="card-grid person-grid">
          {filtered.map(({ coach, athletes, attendance, restricted }) => (
            <article className="person-card" key={coach.coachId}>
              <div className="person-card-top">
                <Avatar firstName={coach.firstName} lastName={coach.lastName} size="lg" />
                <div>
                  <strong className="person-card-name" title={fullName(coach)}>{fullName(coach)}</strong>
                  <small className="person-card-meta" title={coach.email}>{coach.email || 'Email unavailable'}</small>
                  <span className="person-card-team" title={(coach.teams || []).map((team) => team.teamName).join(', ')}>
                    {coach.teams?.[0]?.teamName || coach.specialization || 'No team'}{coach.teams?.length > 1 ? ` +${coach.teams.length - 1} more` : ''}
                  </span>
                  {!isActiveAccount(coach) && <StatusBadge status={coach.accountStatus} label={accountLabel(coach)} />}
                </div>
              </div>
              <dl className="person-card-stats">
                <div><dt>Athletes</dt><dd>{athletes}</dd></div>
                <div><dt>Attendance</dt><dd>{attendance == null ? '—' : `${attendance}%`}</dd></div>
                <div><dt>Restricted</dt><dd className={restricted ? 'text-danger' : ''}>{restricted}</dd></div>
              </dl>
              <button className="btn btn-secondary btn-block" type="button" onClick={() => onOpen(coach)}>View coach</button>
            </article>
          ))}
        </div>
      ) : <EmptyState icon="coach" title="No coaches found" />}
    </>
  )
}

export default function DirectorPortal({ session, onLogout }) {
  const toast = useToast()
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [profileAthlete, setProfileAthlete] = usePageDetail(view)
  const [profileCoach, setProfileCoach] = usePageDetail(view)
  const [showEventModal, setShowEventModal] = useState(false)
  // { event, mode: 'cancel' | 'reschedule' } for the training session or event being changed.
  const [changing, setChanging] = useState(null)
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const dashboard = useApiData('/api/DirectorDashboard', session.token)
  const coaches = useApiData('/api/Director/coaches', session.token)
  const pending = useApiData('/api/Training/pending', session.token, { initialData: [] })
  const schedule = useApiData('/api/Schedules/staff', session.token, { initialData: [] })
  // { eligibility } to open All athletes already filtered, e.g. from the dashboard's "Restricted" card.
  const [athleteFilter, setAthleteFilter] = useState(null)
  const [showRules, setShowRules] = useState(false)

  // Grades and Accounts need the page password. `unlockFor` is what the password dialog will open: a page
  // ({ view }) or one athlete's grades from their profile ({ athlete }).
  const access = useSensitiveAccess(session)
  const [unlockFor, setUnlockFor] = useState(() => CONFIDENTIAL.includes(view) ? { view } : null)
  const [gradesAthlete, setGradesAthlete] = useState(null)
  const confidentialSession = access.token ? { ...session, token: access.token } : null
  const onConfidentialPage = CONFIDENTIAL.includes(view)
  const viewingGrades = access.unlocked && gradesAthlete

  // Access ends as soon as the director leaves Grades and Accounts or closes an athlete's grades.
  const { lock } = access
  useEffect(() => {
    if (!onConfidentialPage && !viewingGrades) lock()
  }, [onConfidentialPage, viewingGrades, lock])

  // Reaching a locked page another way (a bookmark, the back button, or after access timed out) asks for the password.
  const lockedPage = onConfidentialPage && !access.unlocked ? view : null
  const [promptedFor, setPromptedFor] = useState(lockedPage)
  if (promptedFor !== lockedPage) {
    setPromptedFor(lockedPage)
    if (lockedPage) setUnlockFor({ view: lockedPage })
  }

  const athleteRows = dashboard.data?.athletes || []
  const athletes = mergeAthleteTeams(athleteRows.flatMap((athlete) => athlete.teams?.length
    ? athlete.teams.map((team) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))
    : [athlete]))
  const athleteIndex = new Map(athletes.map((athlete) => [athlete.athleteId, athlete]))
  const coachList = coaches.data?.coaches || []
  const summaries = coachSummaries(coachList, athleteRows, pending.data || [])
  const activeAthletes = athletes.filter(isActiveAccount)
  const restricted = athletes.filter((athlete) => athlete.eligibilityStatus === 'RESTRICTED')
  const lowAttendance = activeAthletes.filter((athlete) => athlete.attendanceRate != null && athlete.attendanceRate < 60)
    .sort((a, b) => a.attendanceRate - b.attendanceRate)
  const pendingLineups = dashboard.data?.pendingLineups || 0
  const coachesToFollow = summaries
    .filter(({ coach, pending: requests, restricted: count }) => isActiveAccount(coach) && (requests || count))
    .sort((a, b) => (b.pending + b.restricted) - (a.pending + a.restricted))
  const coachEvaluations = dashboard.data?.coachEvaluations
  const today = localDateISO()
  const upcomingEvents = (schedule.data || [])
    .filter((item) => item.type !== 'TRAINING' && !item.cancelled && item.startDate >= today)
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`))

  const go = (key) => {
    setProfileAthlete(null)
    setProfileCoach(null)
    setAthleteFilter(null)
    setView(key)
  }

  const showAthletes = (filter) => {
    go('athletes')
    setAthleteFilter(filter)
  }

  const navigate = (key) => {
    if (CONFIDENTIAL.includes(key) && !access.unlocked) setUnlockFor({ view: key })
    else go(key)
  }

  // The page or grades open in the same update that unlocks, so the lock effect never sees one without the other.
  const openUnlocked = () => {
    setUnlockFor(null)
    setGradesAthlete(unlockFor.athlete ?? null)
    if (unlockFor.view && unlockFor.view !== view) go(unlockFor.view)
  }

  const requestGrades = (athlete) => {
    if (access.unlocked) setGradesAthlete(athlete)
    else setUnlockFor({ athlete })
  }

  const openAthlete = (athleteId) => {
    const athlete = athleteIndex.get(athleteId)
    if (!athlete) return
    setProfileCoach(null)
    setProfileAthlete(athlete, 'athletes')
    setView('athletes')
  }

  const onReviewed = () => {
    pending.reload()
    schedule.reload()
  }

  // Upcoming approved training, sports events, and competitions can be moved or cancelled. `close` shuts the
  // calendar's event dialog first when the action starts there.
  const changeActions = (event, close = () => {}) => {
    if (event.cancelled || event.startDate < today || (event.type === 'TRAINING' && event.approvalStatus && event.approvalStatus !== 'APPROVED')) return []
    const open = (mode) => { close(); setChanging({ event, mode }) }
    return [
      { label: 'Reschedule', onSelect: () => open('reschedule') },
      { label: event.type === 'TRAINING' ? 'Cancel session' : 'Cancel event', tone: 'danger', onSelect: () => open('cancel') },
    ]
  }

  const addEventButton = <button className="btn btn-primary" type="button" onClick={() => setShowEventModal(true)}>+ Add sports event</button>

  let content
  if (view === 'athletes' && profileAthlete) {
    content = <AthleteProfilePage athlete={profileAthlete} session={session} canEdit={false} canRequestEvaluation={REGISTRAR_ELIGIBILITY} onViewGrades={requestGrades} onBack={() => setProfileAthlete(null)} />
  } else if (view === 'athletes') {
    content = <>
      <Alert>{dashboard.error}</Alert>
      {dashboard.loading && !dashboard.data ? <Loading label="Loading athletes…" /> : (
        <AthletesPage
          key={JSON.stringify(athleteFilter)}
          athletes={athletes}
          title="All athletes"
          subtitle="Every registered student-athlete. Sort, filter, or export the list; open a profile for grades, portfolio, and documents."
          initialFilter={athleteFilter}
          onViewProfile={setProfileAthlete}
          actions={<button className="btn btn-ghost" type="button" onClick={() => setShowRules(true)}><Icon name="help" size={16} />Eligibility rules</button>}
        />
      )}
    </>
  } else if (view === 'lineups') {
    content = <LineupsPage session={session} role="director" onChanged={dashboard.reload} />
  } else if (onConfidentialPage && !confidentialSession) {
    content = <LockedPage title={TITLES[view]} onUnlock={() => setUnlockFor({ view })} />
  } else if (view === 'grades') {
    content = <GradesPage session={confidentialSession} onOpenAthlete={openAthlete} />
  } else if (view === 'accounts') {
    content = <AccountsPage session={confidentialSession} />
  } else if (view === 'coaches' && profileCoach) {
    content = <CoachProfile coach={profileCoach} session={session} athleteIndex={athleteIndex} onOpenAthlete={openAthlete} onRosterChanged={() => { coaches.reload(); dashboard.reload() }} onBack={() => { setProfileCoach(null); coaches.reload(); dashboard.reload() }} />
  } else if (view === 'coaches') {
    content = <CoachesPage summaries={summaries} loading={coaches.loading} onOpen={setProfileCoach} />
  } else if (view === 'schedule') {
    content = <>
      <PageHeader title="Schedule" subtitle="Publish sports events and competitions, and approve coaches' training sessions" actions={addEventButton} />
      <Alert>{schedule.error || pending.error}</Alert>
      <div className="stack">
        <Card>
          <CalendarView
            events={schedule.data || []}
            loading={schedule.loading}
            renderActions={(event, close) => <ChangeButtons actions={changeActions(event, close)} />}
          />
        </Card>
        <TrainingApprovals sessions={pending.data || []} session={session} onReviewed={onReviewed} />
      </div>
    </>
  } else if (view === 'performance') {
    content = <ErrorBoundary><PerformancePage athletes={athletes} session={session} canEdit={false} /></ErrorBoundary>
  } else if (view === 'notifications') {
    content = <NotificationsPage session={session} routes={NOTIFICATION_ROUTES.director} onNavigate={navigate} onChanged={refreshUnread} />
  } else {
    content = <>
      <PageHeader title="Director dashboard" subtitle={longToday()} actions={addEventButton} />
      <Alert>{dashboard.error || coaches.error || pending.error}</Alert>
      {dashboard.loading && !dashboard.data ? <Loading label="Loading dashboard…" /> : <>
        {/* Only what needs the Director's action; everything else is one tap away in the menu. */}
        <div className="stat-grid stat-grid-actions stat-grid-3">
          <StatCard icon="clock" label="Training requests" value={pending.data?.length || 0} hint="Waiting for your approval" tone="warning" onClick={() => document.getElementById('training-approvals')?.scrollIntoView({ behavior: 'smooth' })} />
          <StatCard icon="team" label="Lineups to approve" value={pendingLineups} hint="Players coaches sent for events" tone="info" onClick={() => navigate('lineups')} />
          <StatCard icon="alert" label="Restricted athletes" value={restricted.length} hint="Cannot play in events" tone="danger" onClick={() => showAthletes({ eligibility: 'RESTRICTED' })} />
          <StatCard icon="clipboard" label="Below 60% attendance" value={lowAttendance.length} hint="Active athletes" tone="warning" onClick={() => document.getElementById('director-attendance')?.scrollIntoView({ behavior: 'smooth' })} />
          <StatCard icon="calendar" label="Upcoming events" value={upcomingEvents.length} hint={upcomingEvents[0] ? `Next: ${formatDate(upcomingEvents[0].startDate)}` : 'None scheduled'} tone="brand" onClick={() => navigate('schedule')} />
          <StatCard icon="chat" label="Coach evaluations" value={coachEvaluations ? coachEvaluations.pending : '—'} hint={coachEvaluations ? `Not yet answered · ${coachEvaluations.term}` : 'Sent when grades are released'} tone="info" onClick={() => navigate('coaches')} />
        </div>

        <TrainingApprovals sessions={pending.data || []} session={session} onReviewed={onReviewed} />

        <div className="dashboard-grid">
          <Card className="scroll-target" id="director-restricted" title="Restricted athletes" subtitle="Cannot be included in event lineups until fixed"
            actions={<>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowRules(true)}>Rules</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => showAthletes({ eligibility: 'RESTRICTED' })}>See all →</button>
            </>}>
            {restricted.length ? (
              <ul className="row-list">
                {restricted.slice(0, 6).map((athlete) => (
                  <li className="row" key={athlete.athleteId}>
                    <div className="row-main">
                      <strong>{fullName(athlete)}</strong>
                      <span>{athlete.teamName || 'No active team'}</span>
                      <small className="text-danger">{(athlete.eligibilityReasons || []).join(' · ')}</small>
                    </div>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAthlete(athlete.athleteId)}>View</button>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="check" title="No restricted athletes" message="Every student-athlete meets the eligibility rules." />}
            {restricted.length > 6 && <p className="card-footnote">{restricted.length - 6} more in All athletes.</p>}
          </Card>

          <Card className="scroll-target" id="director-attendance" title="Below 60% attendance" subtitle="Lowest first">
            {lowAttendance.length ? (
              <ul className="row-list">
                {lowAttendance.slice(0, 6).map((athlete) => (
                  <li className="row" key={athlete.athleteId}>
                    <div className="row-main"><strong>{fullName(athlete)}</strong><span>{athlete.teamName || 'No active team'}</span></div>
                    <div className="row-actions">
                      <ProgressBar value={athlete.attendanceRate} />
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAthlete(athlete.athleteId)}>View</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="check" title="Attendance is on track" message="No active athlete is below 60%." />}
          </Card>

          <Card title="Upcoming events" subtitle="Sports events and competitions you published" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('lineups')}>Lineups →</button>}>
            {upcomingEvents.length ? (
              <ul className="row-list">
                {upcomingEvents.slice(0, 5).map((item) => (
                  <li className="row" key={item.id}>
                    <div className="row-main"><strong>{item.title}</strong><span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span><small>{item.location || 'Location TBA'}</small></div>
                    <div className="row-actions">
                      <span className={`badge type-${item.type.toLowerCase()}`}>{eventTypeLabel(item.type)}</span>
                      <ScheduleStatusBadge item={item} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="calendar" title="No upcoming events" action={addEventButton} />}
          </Card>

          <Card title="Coaches needing follow-up" subtitle="Coaches with training requests waiting or restricted athletes" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('coaches')}>All coaches →</button>}>
            {coachesToFollow.length ? (
              <ul className="row-list">
                {coachesToFollow.map((summary) => (
                  <li className="row" key={summary.coach.coachId}>
                    <div className="row-main">
                      <button className="link-button" type="button" onClick={() => { setProfileCoach(summary.coach, 'coaches'); setView('coaches') }}>{fullName(summary.coach)}</button>
                      <span>{summary.coach.teams?.map((team) => team.teamName).join(', ') || 'No team'} · {summary.athletes} athlete{summary.athletes === 1 ? '' : 's'}</span>
                    </div>
                    <div className="row-actions">
                      {summary.pending > 0 && <span className="badge badge-warning">{summary.pending} request{summary.pending === 1 ? '' : 's'}</span>}
                      {summary.restricted > 0 && <span className="badge badge-danger">{summary.restricted} restricted</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="check" title="Nothing to follow up" message="No coach has requests waiting or restricted athletes." />}
          </Card>
        </div>
      </>}
    </>
  }
  const pageTitle = profileAthlete && view === 'athletes' ? 'Athlete profile' : profileCoach && view === 'coaches' ? 'Coach profile' : TITLES[view]

  return (
    <AppLayout
      portal="Director Portal"
      roleLabel="Sports Director"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: 'dashboard', badge: pending.data?.length || 0 },
        { key: 'coaches', label: 'Coaches', icon: 'coach' },
        { key: 'athletes', label: 'All athletes', shortLabel: 'Athletes', icon: 'users' },
        { key: 'lineups', label: 'Event lineups', shortLabel: 'Lineups', icon: 'team', badge: pendingLineups },
        { key: 'schedule', label: 'Schedule', icon: 'calendar' },
        { key: 'performance', label: 'Performance', shortLabel: 'Stats', icon: 'chart' },
        { key: 'confidential', label: 'More', icon: 'more', children: [
          { key: 'grades', label: 'Grades', icon: 'file', locked: !access.unlocked },
          { key: 'accounts', label: 'Accounts', icon: 'shield', locked: !access.unlocked },
        ] },
      ]}
      activeKey={view}
      pageTitle={pageTitle}
      onNavigate={navigate}
      onLogout={onLogout}
      unreadCount={unread}
      notificationRoutes={NOTIFICATION_ROUTES.director}
      onNotificationsChanged={refreshUnread}
      help={HELP.director[view]}
    >
      {content}
      {showRules && <EligibilityRulesDialog session={session} canEdit onClose={() => setShowRules(false)} onChanged={dashboard.reload} />}
      {unlockFor && <UnlockDialog session={session} access={access} section={unlockFor.view === 'accounts' ? 'Accounts' : 'Grades'} onOpened={openUnlocked} onCancel={() => setUnlockFor(null)} />}
      {viewingGrades && <AthleteGradesModal athlete={gradesAthlete} session={confidentialSession} onClose={() => setGradesAthlete(null)} />}
      {showEventModal && <EventScheduleModal session={session} onClose={() => setShowEventModal(false)} onCreated={() => { setShowEventModal(false); toast.success('Event published. Every athlete can now see it.'); schedule.reload() }} />}
      {changing && (
        <ScheduleChangeModal
          event={changing.event}
          mode={changing.mode}
          role="director"
          session={session}
          onClose={() => setChanging(null)}
          onDone={() => {
            toast.success(changing.mode === 'cancel' ? `“${changing.event.title}” cancelled. Everyone affected has been notified.` : `“${changing.event.title}” rescheduled. Everyone affected has been notified.`)
            setChanging(null)
            schedule.reload()
          }}
        />
      )}
    </AppLayout>
  )
}
