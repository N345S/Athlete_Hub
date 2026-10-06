import { useState } from 'react'
import { api } from '../../lib/api.js'
import { average, formatDate, formatTimeRange, fullName, greeting, isActiveAccount, localDateISO, longToday, mergeAthleteTeams } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { Alert, Card, ConfirmDialog, EmptyState, Loading, PageHeader, ProgressBar, StatCard, StatusBadge } from '../../components/ui.jsx'
import AthletesPage from '../staff/AthletesPage.jsx'
import AthleteProfilePage from '../staff/AthleteProfilePage.jsx'
import AttendancePage from '../staff/AttendancePage.jsx'
import PerformancePage from '../staff/PerformancePage.jsx'
import { TrainingScheduleModal } from '../staff/ScheduleModals.jsx'

const VIEWS = ['dashboard', 'athletes', 'schedule', 'attendance', 'performance', 'notifications']
const TITLES = { dashboard: 'Dashboard', athletes: 'My athletes', schedule: 'Schedule', attendance: 'Attendance', performance: 'Performance', notifications: 'Notifications' }

function addDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDateISO(date)
}

export default function CoachPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [profileAthlete, setProfileAthlete] = useState(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const dashboard = useApiData('/api/CoachDashboard', session.token)
  const upcoming = useApiData(`/api/Schedules/staff?from=${localDateISO()}&to=${addDays(14)}`, session.token, { initialData: [] })
  const schedule = useApiData(view === 'schedule' ? '/api/Schedules/staff' : null, session.token, { initialData: [] })

  const teams = dashboard.data?.teams || []
  const athletes = mergeAthleteTeams(teams.flatMap((team) => (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))))
  const activeAthletes = athletes.filter(isActiveAccount)
  const pendingPortfolio = (dashboard.data?.portfolioItems || []).filter((item) => String(item.achievementStatus || item.verificationStatus || 'PENDING').toUpperCase() === 'PENDING')
  const awaiting = athletes.filter((athlete) => athlete.eligibilityStatus === 'PENDING')
  const notEvaluated = activeAthletes.filter((athlete) => !athlete.eligibilityStatus)
  const pendingSessions = (upcoming.data || []).filter((item) => item.type === 'TRAINING' && item.approvalStatus === 'PENDING')
  // One row per athlete, most serious issue first, listing every issue that applies.
  const attentionRows = athletes
    .map((athlete) => {
      const issues = []
      if (!isActiveAccount(athlete)) issues.push({ label: `Account ${athlete.accountStatus.toLowerCase()}`, status: athlete.accountStatus })
      if (athlete.eligibilityStatus === 'INELIGIBLE') issues.push({ label: 'Ineligible', status: 'INELIGIBLE' })
      if (isActiveAccount(athlete) && athlete.attendanceRate != null && athlete.attendanceRate < 60) issues.push({ label: `${athlete.attendanceRate}% attendance`, status: 'LATE' })
      return { athlete, issues }
    })
    .filter((row) => row.issues.length)

  const navigate = (key) => {
    setProfileAthlete(null)
    setView(key)
  }

  const openAthlete = (athleteId) => {
    const athlete = athletes.find((item) => item.athleteId === athleteId)
    if (!athlete) return
    setProfileAthlete(athlete)
    setView('athletes')
  }

  const refreshSchedules = () => {
    setShowScheduleModal(false)
    upcoming.reload()
    schedule.reload()
    dashboard.reload()
  }

  const cancelRequest = async () => {
    setBusy(true)
    setActionError('')
    try {
      await api.del(`/api/Training/sessions/${cancelling.sourceId}`, session.token)
      setCancelling(null)
      refreshSchedules()
    } catch (err) {
      setActionError(err.message)
      setCancelling(null)
    } finally {
      setBusy(false)
    }
  }

  const addScheduleButton = <button className="btn btn-primary" type="button" onClick={() => setShowScheduleModal(true)}>+ Request training session</button>

  let content
  if (view === 'athletes' && profileAthlete) {
    content = <AthleteProfilePage athlete={profileAthlete} session={session} canEdit onBack={() => { setProfileAthlete(null); dashboard.reload() }} />
  } else if (view === 'athletes') {
    content = <AthletesPage athletes={athletes} title="My athletes" subtitle="Student-athletes on the teams you coach" onViewProfile={setProfileAthlete} />
  } else if (view === 'schedule') {
    content = <>
      <PageHeader title="Schedule" subtitle="Your training sessions plus the Director's sports events and competitions" actions={addScheduleButton} />
      <Alert tone="info">New training sessions are sent to the Sports Director for approval before athletes can see them. Sports events and competitions are published by the Director.</Alert>
      <Alert>{schedule.error || actionError}</Alert>
      <Card>
        <CalendarView
          events={schedule.data || []}
          loading={schedule.loading}
          renderActions={(event, close) => event.type === 'TRAINING' && event.approvalStatus === 'PENDING' && (
            <button className="btn btn-danger-outline" type="button" onClick={() => { close(); setCancelling(event) }}>Cancel request</button>
          )}
        />
      </Card>
    </>
  } else if (view === 'attendance') {
    content = <AttendancePage teams={teams} session={session} />
  } else if (view === 'performance') {
    content = <ErrorBoundary><PerformancePage athletes={athletes} session={session} canEdit /></ErrorBoundary>
  } else if (view === 'notifications') {
    content = <NotificationsPage session={session} onChanged={refreshUnread} />
  } else {
    content = <>
      <PageHeader title={`${greeting()}, ${session.firstName || 'Coach'}`} subtitle={longToday()} actions={addScheduleButton} />
      <Alert>{dashboard.error}</Alert>
      {dashboard.loading && !dashboard.data ? <Loading label="Loading your dashboard…" /> : <>
        {dashboard.data?.message && <Alert tone="info">{dashboard.data.message}</Alert>}
        <div className="stat-grid">
          <StatCard icon="users" label="My athletes" value={activeAthletes.length} hint={`Across ${teams.length} team${teams.length === 1 ? '' : 's'}`} onClick={() => navigate('athletes')} />
          <StatCard icon="check" label="Eligible" value={athletes.filter((athlete) => athlete.eligibilityStatus === 'ELIGIBLE').length} hint={`${notEvaluated.length} not yet evaluated`} tone="success" />
          <StatCard icon="alert" label="Need attention" value={attentionRows.length} hint="Ineligible, low attendance, or inactive" tone="warning" />
          <StatCard icon="trophy" label="Portfolio reviews" value={pendingPortfolio.length} hint="Waiting for your verification" tone="info" />
        </div>

        <Card title="Team overview" subtitle="Average attendance and eligibility per team">
          {teams.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Team</th><th className="numeric">Athletes</th><th>Avg. attendance</th><th className="numeric">Eligible</th><th className="numeric">Ineligible</th><th className="numeric">Awaiting / not evaluated</th></tr></thead>
                <tbody>
                  {teams.map((team) => {
                    const members = (team.athletes || []).filter(isActiveAccount)
                    return (
                      <tr key={team.teamId}>
                        <td><strong>{team.teamName}</strong><br /><small className="muted">{team.sport}</small></td>
                        <td className="numeric">{members.length}</td>
                        <td><ProgressBar value={average(members.map((member) => member.attendanceRate))} /></td>
                        <td className="numeric">{members.filter((member) => member.eligibilityStatus === 'ELIGIBLE').length}</td>
                        <td className="numeric">{members.filter((member) => member.eligibilityStatus === 'INELIGIBLE').length}</td>
                        <td className="numeric">{members.filter((member) => !member.eligibilityStatus || member.eligibilityStatus === 'PENDING').length}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon="team" title="No teams assigned" message="Ask the Sports Director to assign you to a team." />}
        </Card>

        <div className="dashboard-grid">
          <Card title="Athletes needing attention" subtitle="Eligibility, attendance, or account issues">
            {attentionRows.length ? (
              <ul className="row-list">
                {attentionRows.slice(0, 8).map(({ athlete, issues }) => (
                  <li className="row" key={athlete.athleteId}>
                    <div className="row-main">
                      <strong>{fullName(athlete)}</strong>
                      <span>{athlete.teamName}</span>
                    </div>
                    <div className="row-actions">
                      {issues.map((issue) => <StatusBadge key={issue.label} status={issue.status} label={issue.label} />)}
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAthlete(athlete.athleteId)}>View</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="check" title="All clear" message="No athlete is ineligible, inactive, or below 60% attendance." />}
            {awaiting.length > 0 && <p className="card-footnote">{awaiting.length} athlete{awaiting.length === 1 ? ' is' : 's are'} awaiting a Registrar decision.</p>}
          </Card>

          <Card title="Portfolio verification" subtitle="Submissions waiting for your review">
            {pendingPortfolio.length ? (
              <ul className="row-list">
                {pendingPortfolio.slice(0, 6).map((item) => (
                  <li className="row" key={item.portfolioItemId}>
                    <div className="row-main">
                      <strong>{item.title || 'Untitled submission'}</strong>
                      <span>{item.athleteName}{item.studentNumber ? ` · ${item.studentNumber}` : ''}</span>
                      <small>Submitted {formatDate(item.createdAt)}</small>
                    </div>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => openAthlete(item.athleteId)}>Review</button>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="trophy" title="All caught up" message="No portfolio submissions are waiting for review." />}
          </Card>

          <Card title="Upcoming schedule" subtitle="Next two weeks" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('schedule')}>Full schedule →</button>}>
            {upcoming.loading && !upcoming.data?.length ? <Loading /> : upcoming.data?.length ? (
              <ul className="row-list">
                {[...upcoming.data].sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`)).slice(0, 6).map((item) => (
                  <li className="row" key={item.id}>
                    <div className="row-main">
                      <strong>{item.title}</strong>
                      <span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span>
                      <small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small>
                    </div>
                    {item.type !== 'TRAINING'
                      ? <span className={`badge type-${item.type.toLowerCase()}`}>{item.type === 'COMPETITION' ? 'Competition' : 'Sports event'}</span>
                      : item.approvalStatus && item.approvalStatus !== 'APPROVED' && <StatusBadge status={item.approvalStatus} label={item.approvalStatus === 'PENDING' ? 'Awaiting approval' : undefined} />}
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="calendar" title="Nothing scheduled" message="No training or events in the next two weeks." />}
          </Card>

          <Card title="Training requests" subtitle="Sessions waiting for the Director's approval">
            {pendingSessions.length ? (
              <ul className="row-list">
                {pendingSessions.map((item) => (
                  <li className="row" key={item.id}>
                    <div className="row-main">
                      <strong>{item.title}</strong>
                      <span>{formatDate(item.startDate)} · {item.teamName}</span>
                    </div>
                    <StatusBadge status="PENDING" label="Awaiting approval" />
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="clock" title="No pending requests" message="Request a training session and it will appear here until approved." />}
          </Card>
        </div>
      </>}
    </>
  }

  return (
    <AppLayout
      portal="Coach Portal"
      roleLabel="Coach"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { key: 'athletes', label: 'My athletes', icon: 'users' },
        { key: 'schedule', label: 'Schedule', icon: 'calendar' },
        { key: 'attendance', label: 'Attendance', icon: 'clipboard' },
        { key: 'performance', label: 'Performance', icon: 'chart' },
        { key: 'notifications', label: 'Notifications', icon: 'bell', badge: unread },
      ]}
      activeKey={view}
      pageTitle={profileAthlete && view === 'athletes' ? 'Athlete profile' : TITLES[view]}
      onNavigate={navigate}
      onLogout={onLogout}
      unreadCount={unread}
    >
      {content}
      {showScheduleModal && <TrainingScheduleModal teams={teams} session={session} onClose={() => setShowScheduleModal(false)} onCreated={refreshSchedules} />}
      {cancelling && (
        <ConfirmDialog
          title="Cancel training request"
          message={`Withdraw “${cancelling.title}” on ${formatDate(cancelling.startDate)}? The Director will no longer see it.`}
          confirmLabel="Cancel request"
          busy={busy}
          onCancel={() => setCancelling(null)}
          onConfirm={cancelRequest}
        />
      )}
    </AppLayout>
  )
}
