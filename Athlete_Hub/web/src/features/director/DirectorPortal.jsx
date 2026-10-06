import { useState } from 'react'
import { api } from '../../lib/api.js'
import { accountLabel, average, eventTypeLabel, formatDate, formatTimeRange, fullName, isActiveAccount, localDateISO, longToday, matchesSearch, mergeAthleteTeams } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { Alert, Avatar, Card, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader, ProgressBar, SearchInput, StatCard, StatusBadge } from '../../components/ui.jsx'
import AthletesPage from '../staff/AthletesPage.jsx'
import AthleteProfilePage from '../staff/AthleteProfilePage.jsx'
import PerformancePage from '../staff/PerformancePage.jsx'
import { EventScheduleModal } from '../staff/ScheduleModals.jsx'
import TrainingApprovals from '../staff/TrainingApprovals.jsx'

const VIEWS = ['dashboard', 'coaches', 'athletes', 'schedule', 'performance', 'notifications']
const TITLES = { dashboard: 'Dashboard', coaches: 'Coaches', athletes: 'All athletes', schedule: 'Schedule', performance: 'Performance', notifications: 'Notifications' }

function AssignAthleteModal({ coach, session, onClose, onAssigned }) {
  const { data, loading, error } = useApiData('/api/Director/athletes', session.token)
  const [athleteId, setAthleteId] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const athletes = (data?.athletes || []).filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.studentNumber))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      await api.post(`/api/Director/coaches/${coach.coachId}/assign-athlete`, { athleteId: Number(athleteId) }, session.token)
      onAssigned()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Assign athlete" subtitle={`Add an athlete to ${fullName(coach)}'s active team.`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="assign-form" disabled={saving || !athleteId}>{saving ? 'Assigning…' : 'Assign athlete'}</button>
      </>}>
      <form id="assign-form" className="stack-sm" onSubmit={submit}>
        <SearchInput value={search} onChange={setSearch} placeholder="Filter athletes…" label="Filter athletes" />
        <Field label="Athlete">
          <select value={athleteId} onChange={(event) => setAthleteId(event.target.value)} disabled={loading} required size={Math.min(8, Math.max(athletes.length, 2))}>
            {athletes.map((athlete) => (
              <option key={athlete.athleteId} value={athlete.athleteId}>
                {fullName(athlete)} · {athlete.studentNumber}{isActiveAccount(athlete) ? '' : ` · ${athlete.accountStatus}`}{athlete.currentCoach ? ` · currently ${athlete.currentCoach.teamName}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </form>
      <Alert>{error || saveError}</Alert>
    </Modal>
  )
}

/** One coach's teams and athletes, with each athlete's attendance and eligibility. */
function CoachProfile({ coach, session, athleteIndex, onOpenAthlete, onBack }) {
  const profile = useApiData(`/api/Director/coaches/${coach.coachId}`, session.token)
  const [showAssign, setShowAssign] = useState(false)
  const [unassigning, setUnassigning] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const data = profile.data
  const roster = (data?.assignedAthletes || []).map((athlete) => ({ ...athlete, ...athleteIndex.get(athlete.athleteId), teamName: athlete.teamName }))

  const unassign = async () => {
    setBusy(true)
    setError('')
    try {
      await api.del(`/api/Director/coaches/${coach.coachId}/unassign-athlete/${unassigning.athleteId}`, session.token)
      setUnassigning(null)
      profile.reload()
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
        <button className="btn btn-primary hero-action" type="button" onClick={() => setShowAssign(true)}>+ Assign athlete</button>
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
          <Card title="Assigned athletes" subtitle="Attendance and latest Registrar decision">
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
                        <td>{athlete.eligibilityStatus ? <StatusBadge status={athlete.eligibilityStatus} label={athlete.eligibilityStatus === 'PENDING' ? 'Awaiting decision' : undefined} /> : <span className="muted">Not evaluated</span>}</td>
                        <td className="table-action"><button className="btn btn-ghost btn-sm" type="button" onClick={() => setUnassigning(athlete)}>Unassign</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon="users" title="No athletes assigned" />}
          </Card>
        </div>
      </>}
      {showAssign && <AssignAthleteModal coach={coach} session={session} onClose={() => setShowAssign(false)} onAssigned={() => { setShowAssign(false); profile.reload() }} />}
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
        <div className="card-grid">
          {filtered.map(({ coach, athletes, attendance, ineligible }) => (
            <article className="person-card" key={coach.coachId}>
              <div className="person-card-top">
                <Avatar firstName={coach.firstName} lastName={coach.lastName} size="lg" />
                <div>
                  <strong>{fullName(coach)}</strong>
                  <small>{coach.email || 'Email unavailable'}</small>
                  <span className="muted">{coach.teams?.[0]?.teamName || coach.specialization || 'No team'}</span>
                  {!isActiveAccount(coach) && <StatusBadge status={coach.accountStatus} label={accountLabel(coach)} />}
                </div>
              </div>
              <dl className="person-card-stats">
                <div><dt>Athletes</dt><dd>{athletes}</dd></div>
                <div><dt>Attendance</dt><dd>{attendance == null ? '—' : `${attendance}%`}</dd></div>
                <div><dt>Ineligible</dt><dd className={ineligible ? 'text-danger' : ''}>{ineligible}</dd></div>
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
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [profileAthlete, setProfileAthlete] = useState(null)
  const [profileCoach, setProfileCoach] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const dashboard = useApiData('/api/DirectorDashboard', session.token)
  const coaches = useApiData('/api/Director/coaches', session.token)
  const pending = useApiData('/api/Training/pending', session.token, { initialData: [] })
  const schedule = useApiData('/api/Schedules/staff', session.token, { initialData: [] })

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
    .filter((item) => item.type !== 'TRAINING' && item.startDate >= today)
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`))

  const navigate = (key) => {
    setProfileAthlete(null)
    setProfileCoach(null)
    setView(key)
  }

  const openAthlete = (athleteId) => {
    const athlete = athleteIndex.get(athleteId)
    if (!athlete) return
    setProfileCoach(null)
    setProfileAthlete(athlete)
    setView('athletes')
  }

  const onReviewed = () => {
    pending.reload()
    schedule.reload()
  }

  const deleteEvent = async () => {
    setBusy(true)
    setActionError('')
    try {
      await api.del(`/api/Schedules/${deleting.sourceId}`, session.token)
      setDeleting(null)
      schedule.reload()
    } catch (err) {
      setActionError(err.message)
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const addEventButton = <button className="btn btn-primary" type="button" onClick={() => setShowEventModal(true)}>+ Add sports event</button>

  let content
  if (view === 'athletes' && profileAthlete) {
    content = <AthleteProfilePage athlete={profileAthlete} session={session} canEdit={false} onBack={() => setProfileAthlete(null)} />
  } else if (view === 'athletes') {
    content = <AthletesPage athletes={athletes} title="All athletes" subtitle="Every registered student-athlete — view only; coaches record athlete data" onViewProfile={setProfileAthlete} />
  } else if (view === 'coaches' && profileCoach) {
    content = <CoachProfile coach={profileCoach} session={session} athleteIndex={athleteIndex} onOpenAthlete={openAthlete} onBack={() => { setProfileCoach(null); coaches.reload(); dashboard.reload() }} />
  } else if (view === 'coaches') {
    content = <CoachesPage summaries={summaries} loading={coaches.loading} onOpen={setProfileCoach} />
  } else if (view === 'schedule') {
    content = <>
      <PageHeader title="Schedule" subtitle="Publish sports events and competitions, and approve coaches' training sessions" actions={addEventButton} />
      <Alert>{schedule.error || pending.error || actionError}</Alert>
      <div className="stack">
        {pending.data?.length > 0 && <TrainingApprovals sessions={pending.data} session={session} onReviewed={onReviewed} />}
        <Card>
          <CalendarView
            events={schedule.data || []}
            loading={schedule.loading}
            renderActions={(event, close) => event.type !== 'TRAINING' && (
              <button className="btn btn-danger-outline" type="button" onClick={() => { close(); setDeleting(event) }}>Delete event</button>
            )}
          />
        </Card>
      </div>
    </>
  } else if (view === 'performance') {
    content = <ErrorBoundary><PerformancePage athletes={athletes} session={session} canEdit={false} /></ErrorBoundary>
  } else if (view === 'notifications') {
    content = <NotificationsPage session={session} onChanged={refreshUnread} />
  } else {
    content = <>
      <PageHeader title="Director dashboard" subtitle={longToday()} actions={addEventButton} />
      <Alert>{dashboard.error || coaches.error || pending.error}</Alert>
      {dashboard.loading && !dashboard.data ? <Loading label="Loading dashboard…" /> : <>
        <div className="stat-grid">
          <StatCard icon="users" label="Active athletes" value={activeAthletes.length} hint={`${noTeam.length} without a team`} onClick={() => navigate('athletes')} />
          <StatCard icon="coach" label="Coaches" value={coachList.filter(isActiveAccount).length} hint={`${coachList.length - coachList.filter(isActiveAccount).length} inactive or suspended`} tone="info" onClick={() => navigate('coaches')} />
          <StatCard icon="clock" label="Training approvals" value={pending.data?.length || 0} hint="Awaiting your review" tone="warning" onClick={() => navigate('schedule')} />
          <StatCard icon="alert" label="Ineligible athletes" value={ineligible.length} hint="Latest Registrar decisions" tone="danger" />
        </div>

        <TrainingApprovals sessions={pending.data || []} session={session} onReviewed={onReviewed} />

        <Card title="Coach overview" subtitle="Roster size, attendance, and eligibility for each coach's athletes">
          {summaries.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Coach</th><th>Team</th><th className="numeric">Athletes</th><th>Avg. attendance</th><th className="numeric">Ineligible</th><th className="numeric">Not evaluated</th><th className="numeric">Pending requests</th></tr></thead>
                <tbody>
                  {summaries.map((summary) => (
                    <tr key={summary.coach.coachId}>
                      <td>
                        <button className="link-button" type="button" onClick={() => { setView('coaches'); setProfileCoach(summary.coach) }}>{fullName(summary.coach)}</button>
                        {!isActiveAccount(summary.coach) && <> <StatusBadge status={summary.coach.accountStatus} /></>}
                      </td>
                      <td>{summary.coach.teams?.map((team) => team.teamName).join(', ') || <span className="muted">No team</span>}</td>
                      <td className="numeric">{summary.athletes}</td>
                      <td><ProgressBar value={summary.attendance} /></td>
                      <td className={`numeric ${summary.ineligible ? 'text-danger' : ''}`}>{summary.ineligible}</td>
                      <td className="numeric">{summary.notEvaluated}</td>
                      <td className="numeric">{summary.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon="coach" title="No coaches yet" />}
        </Card>

        <div className="dashboard-grid">
          <Card title="Ineligible athletes" subtitle="Based on the latest Registrar decision">
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
          <Card title="Upcoming events" subtitle="Sports events and competitions you published" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('schedule')}>Schedule →</button>}>
            {upcomingEvents.length ? (
              <ul className="row-list">
                {upcomingEvents.slice(0, 6).map((item) => (
                  <li className="row" key={item.id}>
                    <div className="row-main"><strong>{item.title}</strong><span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span><small>{item.location || 'Location TBA'}</small></div>
                    <span className={`badge type-${item.type.toLowerCase()}`}>{eventTypeLabel(item.type)}</span>
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
        { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', badge: pending.data?.length || 0 },
        { key: 'coaches', label: 'Coaches', icon: 'coach' },
        { key: 'athletes', label: 'All athletes', icon: 'users' },
        { key: 'schedule', label: 'Schedule', icon: 'calendar' },
        { key: 'performance', label: 'Performance', icon: 'chart' },
        { key: 'notifications', label: 'Notifications', icon: 'bell', badge: unread },
      ]}
      activeKey={view}
      pageTitle={pageTitle}
      onNavigate={navigate}
      onLogout={onLogout}
      unreadCount={unread}
    >
      {content}
      {showEventModal && <EventScheduleModal session={session} onClose={() => setShowEventModal(false)} onCreated={() => { setShowEventModal(false); schedule.reload() }} />}
      {deleting && (
        <ConfirmDialog
          title="Delete event"
          message={`Delete “${deleting.title}” on ${formatDate(deleting.startDate)}? Athletes will no longer see it.`}
          confirmLabel="Delete event"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={deleteEvent}
        />
      )}
    </AppLayout>
  )
}
