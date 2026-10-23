import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { accountLabel, average, eventTypeLabel, formatDate, formatDateTime, formatTimeRange, fullName, isActiveAccount, localDateISO, longToday, matchesSearch, mergeAthleteTeams } from '../../lib/format.js'
import { useApiData, useHashView, usePageDetail, useSensitiveAccess, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView, { ScheduleStatusBadge } from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Avatar, Card, ConfirmDialog, EmptyState, Loading, Modal, PageHeader, ProgressBar, SearchInput, StatCard, StatusBadge, Tabs } from '../../components/ui.jsx'
import Icon from '../../components/icons.jsx'
import { HELP } from '../../lib/help.js'
import { NOTIFICATION_ROUTES } from '../../lib/notifications.js'
import { REGISTRAR_ELIGIBILITY } from '../../lib/features.js'
import AccountsPage from '../accounts/AccountsPage.jsx'
import AthletesPage from '../staff/AthletesPage.jsx'
import AthleteProfilePage from '../staff/AthleteProfilePage.jsx'
import PerformancePage from '../staff/PerformancePage.jsx'
import ManageScheduleCard, { ChangeButtons } from '../staff/ManageSchedule.jsx'
import { EventScheduleModal, ScheduleChangeModal } from '../staff/ScheduleModals.jsx'
import TrainingApprovals from '../staff/TrainingApprovals.jsx'
import CoachEvaluationsCard from './CoachEvaluationsCard.jsx'
import GradesPage, { AthleteGradesModal, GradeSyncStatus } from './GradesPage.jsx'
import { LockedPage, UnlockDialog } from './SensitiveAccess.jsx'

const VIEWS = ['dashboard', 'coaches', 'athletes', 'grades', 'schedule', 'performance', 'accounts', 'notifications']
const TITLES = { dashboard: 'Dashboard', coaches: 'Coaches', athletes: 'All athletes', grades: 'Grades', schedule: 'Schedule', performance: 'Performance', accounts: 'Accounts', notifications: 'Notifications' }
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
          <Card title="Assigned athletes" subtitle={REGISTRAR_ELIGIBILITY ? 'Attendance and latest Registrar decision' : 'Attendance for each athlete'}>
            {roster.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Athlete</th><th>Team</th><th>Attendance</th>{REGISTRAR_ELIGIBILITY && <th>Eligibility</th>}<th><span className="visually-hidden">Actions</span></th></tr></thead>
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
                        {REGISTRAR_ELIGIBILITY && <td>{athlete.eligibilityStatus ? <StatusBadge status={athlete.eligibilityStatus} label={athlete.eligibilityStatus === 'PENDING' ? 'Awaiting decision' : undefined} /> : <span className="muted">Not evaluated</span>}</td>}
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

/** Roll-up of every coach: roster size, attendance, eligibility issues, and pending requests. */
function coachSummaries(coaches, athleteRows, pendingSessions) {
  return coaches.map((coach) => {
    const teamNames = new Set((coach.teams || []).map((team) => team.teamName))
    const roster = athleteRows.filter((athlete) => (athlete.teams || []).some((team) => teamNames.has(team.teamName)) && isActiveAccount(athlete))
    return {
      coach,
      athletes: roster.length,
      attendance: average(roster.map((athlete) => athlete.attendanceRate)),
      ineligible: roster.filter((athlete) => athlete.eligibilityStatus === 'INELIGIBLE').length,
      notEvaluated: roster.filter((athlete) => !athlete.eligibilityStatus).length,
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
          {filtered.map(({ coach, athletes, attendance, ineligible }) => (
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
                {REGISTRAR_ELIGIBILITY && <div><dt>Ineligible</dt><dd className={ineligible ? 'text-danger' : ''}>{ineligible}</dd></div>}
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
  const gradeSync = useApiData(REGISTRAR_ELIGIBILITY ? null : '/api/DirectorDashboard/grade-sync', session.token)
  const latestGrades = gradeSync.data?.latestTerm

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
  const ineligible = activeAthletes.filter((athlete) => athlete.eligibilityStatus === 'INELIGIBLE')
  const noTeam = activeAthletes.filter((athlete) => !athlete.teamName)
  const today = localDateISO()
  const upcomingEvents = (schedule.data || [])
    .filter((item) => item.type !== 'TRAINING' && !item.cancelled && item.startDate >= today)
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`))

  const go = (key) => {
    setProfileAthlete(null)
    setProfileCoach(null)
    setView(key)
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
    content = <AthletesPage athletes={athletes} title="All athletes" subtitle={REGISTRAR_ELIGIBILITY ? 'Every registered student-athlete — open a profile to request a Grade Evaluation' : 'Every registered student-athlete — open a profile to see their grades, portfolio, and documents'} onViewProfile={setProfileAthlete} />
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
        {pending.data?.length > 0 && <TrainingApprovals sessions={pending.data} session={session} onReviewed={onReviewed} />}
        <ManageScheduleCard
          title="Upcoming schedule"
          subtitle="Approved training, sports events, and competitions. Reschedule or cancel one here, or select it on the calendar. You will be asked for the reason."
          events={schedule.data || []}
          loading={schedule.loading}
          actionsFor={(event) => changeActions(event)}
          empty={<EmptyState icon="calendar" title="Nothing upcoming" message="Approved training and the events you publish appear here, ready to reschedule or cancel." action={addEventButton} />}
        />
        <Card>
          <CalendarView
            events={schedule.data || []}
            loading={schedule.loading}
            renderActions={(event, close) => <ChangeButtons actions={changeActions(event, close)} />}
          />
        </Card>
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
        <div className="stat-grid">
          <StatCard icon="users" label="Active athletes" value={activeAthletes.length} hint={`${noTeam.length} without a team`} onClick={() => navigate('athletes')} />
          <StatCard icon="coach" label="Coaches" value={coachList.filter(isActiveAccount).length} hint={`${coachList.length - coachList.filter(isActiveAccount).length} inactive or suspended`} tone="info" onClick={() => navigate('coaches')} />
          <StatCard icon="clock" label="Training approvals" value={pending.data?.length || 0} hint="Awaiting your review" tone="warning" onClick={() => navigate('schedule')} />
          {REGISTRAR_ELIGIBILITY
            ? <StatCard icon="alert" label="Ineligible athletes" value={ineligible.length} hint="Latest Registrar decisions" tone="danger" onClick={() => document.getElementById('director-ineligible')?.scrollIntoView({ behavior: 'smooth' })} />
            : <StatCard icon="lock" label="ICTD grades" value={latestGrades ? latestGrades.athletes : '—'} hint={latestGrades ? `Student-athletes graded · ${latestGrades.semester} ${latestGrades.academicYear}` : 'Waiting for ICTD to release grades'} onClick={() => navigate('grades')} />}
        </div>

        <TrainingApprovals sessions={pending.data || []} session={session} onReviewed={onReviewed} />

        <Card title="Coach overview" subtitle={REGISTRAR_ELIGIBILITY ? "Roster size, attendance, and eligibility for each coach's athletes" : "Roster size and attendance for each coach's athletes"}>
          {summaries.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Coach</th><th>Team</th><th className="numeric">Athletes</th><th>Avg. attendance</th>{REGISTRAR_ELIGIBILITY && <><th className="numeric">Ineligible</th><th className="numeric">Not evaluated</th></>}<th className="numeric">Pending requests</th></tr></thead>
                <tbody>
                  {summaries.map((summary) => (
                    <tr key={summary.coach.coachId}>
                      <td>
                        <button className="link-button" type="button" onClick={() => { setProfileCoach(summary.coach, 'coaches'); setView('coaches') }}>{fullName(summary.coach)}</button>
                        {!isActiveAccount(summary.coach) && <> <StatusBadge status={summary.coach.accountStatus} /></>}
                      </td>
                      <td>{summary.coach.teams?.map((team) => team.teamName).join(', ') || <span className="muted">No team</span>}</td>
                      <td className="numeric">{summary.athletes}</td>
                      <td><ProgressBar value={summary.attendance} /></td>
                      {REGISTRAR_ELIGIBILITY && <>
                        <td className={`numeric ${summary.ineligible ? 'text-danger' : ''}`}>{summary.ineligible}</td>
                        <td className="numeric">{summary.notEvaluated}</td>
                      </>}
                      <td className="numeric">{summary.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon="coach" title="No coaches yet" />}
        </Card>

        <div className="dashboard-grid">
          {REGISTRAR_ELIGIBILITY ? (
            <Card className="scroll-target" id="director-ineligible" title="Ineligible athletes" subtitle="Based on the latest Registrar decision">
              {ineligible.length ? (
                <ul className="row-list">
                  {ineligible.slice(0, 8).map((athlete) => (
                    <li className="row" key={athlete.athleteId}>
                      <div className="row-main"><strong>{fullName(athlete)}</strong><span>{athlete.teamName || 'No active team'}</span><small>{athlete.eligibilityTerm}</small></div>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAthlete(athlete.athleteId)}>View</button>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon="check" title="No ineligible athletes" />}
            </Card>
          ) : (
            <Card title="ICTD grades" subtitle="Synced automatically from the ICTD university database. Grades themselves need your password." actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('grades')}><Icon name="lock" size={15} /> Grades →</button>}>
              {latestGrades ? (
                <dl className="detail-grid">
                  <div><dt>Latest semester</dt><dd>{latestGrades.semester} {latestGrades.academicYear}</dd></div>
                  <div><dt>Student-athletes</dt><dd>{latestGrades.athletes}</dd></div>
                  <div><dt>Synced</dt><dd>{formatDateTime(latestGrades.pulledAt)}</dd></div>
                  <div><dt>Coach evaluations</dt><dd>{latestGrades.evaluationsSubmitted} of {latestGrades.evaluationsSent} submitted</dd></div>
                </dl>
              ) : <EmptyState icon="file" title="No grades yet" message="Grades appear here automatically once the ICTD database releases a semester's final grades." />}
              <p className="grade-sync-note"><GradeSyncStatus status={gradeSync.data} /></p>
            </Card>
          )}
          <Card title="Upcoming events" subtitle="Sports events and competitions you published" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('schedule')}>Schedule →</button>}>
            {upcomingEvents.length ? (
              <ul className="row-list">
                {upcomingEvents.slice(0, 6).map((item) => (
                  <li className="row" key={item.id}>
                    <div className="row-main"><strong>{item.title}</strong><span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span><small>{item.location || 'Location TBA'}</small></div>
                    <div className="row-actions">
                      <span className={`badge type-${item.type.toLowerCase()}`}>{eventTypeLabel(item.type)}</span>
                      <ScheduleStatusBadge item={item} />
                      <ChangeButtons actions={changeActions(item)} small />
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="calendar" title="No upcoming events" action={addEventButton} />}
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
