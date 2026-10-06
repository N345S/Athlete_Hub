import { useState } from 'react'
import { api } from '../../lib/api.js'
import { accountLabel, formatDate, fullName, isActiveAccount, longToday, matchesSearch, mergeAthleteTeams } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { Alert, Avatar, Card, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader, SearchInput, StatCard, StatusBadge } from '../../components/ui.jsx'
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

function CoachProfile({ coach, session, onBack }) {
  const profile = useApiData(`/api/Director/coaches/${coach.coachId}`, session.token)
  const [showAssign, setShowAssign] = useState(false)
  const [unassigning, setUnassigning] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const data = profile.data

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
        <button className="btn btn-primary hero-action" type="button" onClick={() => setShowAssign(true)}>+ Assign athlete</button>
      </section>
      <Alert>{profile.error || error}</Alert>
      {profile.loading && !data ? <Loading label="Loading coach profile…" /> : <>
        <dl className="detail-grid">
          <div><dt>Specialization</dt><dd>{data?.specialization || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{data?.phone || '—'}</dd></div>
          <div><dt>Assigned athletes</dt><dd>{data?.totalAssignedAthletes ?? 0}</dd></div>
          <div><dt>Teams</dt><dd>{data?.teams?.length || 0}</dd></div>
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
            ) : <EmptyState title="No teams" message="This coach is not assigned to a team, so athletes cannot be assigned yet." />}
          </Card>
          <Card title="Assigned athletes">
            {data?.assignedAthletes?.length ? (
              <ul className="row-list">
                {data.assignedAthletes.map((athlete) => (
                  <li className="row" key={athlete.athleteId}>
                    <div className="row-main">
                      <strong>{fullName(athlete)}</strong>
                      <span>{athlete.studentNumber || 'Student ID pending'} · {athlete.teamName}</span>
                      <small>{athlete.course || 'Program not set'}{athlete.yearLevel ? ` · Year ${athlete.yearLevel}` : ''}</small>
                    </div>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setUnassigning(athlete)}>Unassign</button>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No athletes assigned" />}
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

function CoachesPage({ coaches, loading, onOpen }) {
  const [search, setSearch] = useState('')
  const filtered = coaches.filter((coach) => matchesSearch(search, coach.firstName, coach.lastName, coach.email, coach.specialization))
  return (
    <>
      <PageHeader title="Coaches" subtitle="Coach accounts and the athletes assigned to them" actions={<span className="badge badge-neutral">{coaches.length} total</span>} />
      <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search coaches…" label="Search coaches" /></div>
      {loading && !coaches.length ? <Loading label="Loading coaches…" /> : filtered.length ? (
        <div className="card-grid">
          {filtered.map((coach) => (
            <article className="person-card" key={coach.coachId}>
              <div className="person-card-top">
                <Avatar firstName={coach.firstName} lastName={coach.lastName} size="lg" />
                <div>
                  <strong>{fullName(coach)}</strong>
                  <small>{coach.email || 'Email unavailable'}</small>
                  <span className="muted">{coach.specialization || 'Coach'}</span>
                  {!isActiveAccount(coach) && <StatusBadge status={coach.accountStatus} label={accountLabel(coach)} />}
                </div>
              </div>
              <dl className="person-card-stats">
                <div><dt>Athletes</dt><dd>{coach.assignedAthletesCount || 0}</dd></div>
                <div><dt>Teams</dt><dd>{coach.teams?.length || 0}</dd></div>
              </dl>
              <button className="btn btn-secondary btn-block" type="button" onClick={() => onOpen(coach)}>View profile</button>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No coaches found" />}
    </>
  )
}

export default function DirectorPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [profileAthlete, setProfileAthlete] = useState(null)
  const [profileCoach, setProfileCoach] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const dashboard = useApiData('/api/DirectorDashboard', session.token)
  const coaches = useApiData('/api/Director/coaches', session.token)
  const pending = useApiData('/api/Training/pending', session.token, { initialData: [] })
  const schedule = useApiData(view === 'schedule' ? '/api/Schedules/staff' : null, session.token, { initialData: [] })

  const athletes = mergeAthleteTeams((dashboard.data?.athletes || []).flatMap((athlete) => athlete.teams?.length
    ? athlete.teams.map((team) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))
    : [athlete]))
  const coachList = coaches.data?.coaches || []
  const recentPortfolio = (dashboard.data?.portfolioItems || []).slice(0, 6)
  const notEvaluated = (dashboard.data?.athletes || []).filter((athlete) => !athlete.eligibilityStatus).length
  const ineligible = (dashboard.data?.athletes || []).filter((athlete) => athlete.eligibilityStatus === 'INELIGIBLE').length

  const navigate = (key) => {
    setProfileAthlete(null)
    setProfileCoach(null)
    setView(key)
  }

  const onReviewed = () => {
    pending.reload()
    schedule.reload()
  }

  let content
  if (view === 'athletes' && profileAthlete) {
    content = <AthleteProfilePage athlete={profileAthlete} session={session} canReview={false} onBack={() => setProfileAthlete(null)} />
  } else if (view === 'athletes') {
    content = <AthletesPage athletes={athletes} title="All athletes" subtitle="Every registered student-athlete" onViewProfile={setProfileAthlete} />
  } else if (view === 'coaches' && profileCoach) {
    content = <CoachProfile coach={profileCoach} session={session} onBack={() => { setProfileCoach(null); coaches.reload(); dashboard.reload() }} />
  } else if (view === 'coaches') {
    content = <CoachesPage coaches={coachList} loading={coaches.loading} onOpen={setProfileCoach} />
  } else if (view === 'schedule') {
    content = <>
      <PageHeader title="Schedule" subtitle="Sports events, competitions, and approved training" actions={<button className="btn btn-primary" type="button" onClick={() => setShowEventModal(true)}>+ Add sports event</button>} />
      <Alert>{schedule.error || pending.error}</Alert>
      <div className="stack">
        {pending.data?.length > 0 && <TrainingApprovals sessions={pending.data} session={session} onReviewed={onReviewed} />}
        <Card><CalendarView events={schedule.data || []} loading={schedule.loading} /></Card>
      </div>
    </>
  } else if (view === 'performance') {
    content = <ErrorBoundary><PerformancePage athletes={athletes} session={session} canEdit={false} /></ErrorBoundary>
  } else if (view === 'notifications') {
    content = <NotificationsPage session={session} onChanged={refreshUnread} />
  } else {
    content = <>
      <PageHeader title="Director dashboard" subtitle={longToday()} />
      <Alert>{dashboard.error || coaches.error || pending.error}</Alert>
      {dashboard.loading && !dashboard.data ? <Loading label="Loading dashboard…" /> : <>
        <div className="stat-grid">
          <StatCard label="Athletes" value={dashboard.data?.athleteCount || 0} hint="Registered student-athletes" />
          <StatCard label="Coaches" value={coachList.length} hint="Coach accounts" tone="info" />
          <StatCard label="Training approvals" value={pending.data?.length || 0} hint="Awaiting your review" tone="warning" />
          <StatCard label="Ineligible" value={ineligible} hint={`${notEvaluated} not yet evaluated`} tone="danger" />
        </div>
        <div className="stack">
          <TrainingApprovals sessions={pending.data || []} session={session} onReviewed={onReviewed} />
          <Card title="Recent portfolio submissions" subtitle="Latest athlete achievements across all teams">
            {recentPortfolio.length ? (
              <ul className="row-list">
                {recentPortfolio.map((item) => (
                  <li className="row" key={item.portfolioItemId}>
                    <div className="row-main">
                      <strong>{item.title}</strong>
                      <span>{item.athleteName} · {item.studentNumber}</span>
                      <small>{formatDate(item.createdAt)}</small>
                    </div>
                    <StatusBadge status={item.verificationStatus || 'PENDING'} />
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No submissions yet" />}
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
        { key: 'dashboard', label: 'Dashboard', badge: pending.data?.length || 0 },
        { key: 'coaches', label: 'Coaches' },
        { key: 'athletes', label: 'All athletes' },
        { key: 'schedule', label: 'Schedule' },
        { key: 'performance', label: 'Performance' },
        { key: 'notifications', label: 'Notifications', badge: unread },
      ]}
      activeKey={view}
      pageTitle={pageTitle}
      onNavigate={navigate}
      onLogout={onLogout}
      unreadCount={unread}
    >
      {content}
      {showEventModal && <EventScheduleModal session={session} onClose={() => setShowEventModal(false)} onCreated={() => { setShowEventModal(false); schedule.reload() }} />}
    </AppLayout>
  )
}
