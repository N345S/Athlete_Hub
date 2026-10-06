import { useState } from 'react'
import { formatDate, formatTimeRange, fullName, greeting, localDateISO, longToday, mergeAthleteTeams } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { Alert, Card, EmptyState, Loading, PageHeader, StatCard, StatusBadge } from '../../components/ui.jsx'
import AthletesPage from '../staff/AthletesPage.jsx'
import AthleteProfilePage from '../staff/AthleteProfilePage.jsx'
import AttendancePage from '../staff/AttendancePage.jsx'
import PerformancePage from '../staff/PerformancePage.jsx'
import { TrainingScheduleModal } from '../staff/ScheduleModals.jsx'

const VIEWS = ['dashboard', 'athletes', 'schedule', 'attendance', 'performance', 'notifications']
const TITLES = { dashboard: 'Dashboard', athletes: 'Athletes', schedule: 'Schedule', attendance: 'Attendance', performance: 'Performance', notifications: 'Notifications' }

function addDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDateISO(date)
}

export default function CoachPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [profileAthlete, setProfileAthlete] = useState(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const dashboard = useApiData('/api/CoachDashboard', session.token)
  const upcoming = useApiData(`/api/Schedules/staff?from=${localDateISO()}&to=${addDays(14)}`, session.token, { initialData: [] })
  const schedule = useApiData(view === 'schedule' ? '/api/Schedules/staff' : null, session.token, { initialData: [] })

  const teams = dashboard.data?.teams || []
  const athletes = mergeAthleteTeams(teams.flatMap((team) => (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))))
  const pendingPortfolio = (dashboard.data?.portfolioItems || []).filter((item) => String(item.achievementStatus || item.verificationStatus || 'PENDING').toUpperCase() === 'PENDING')
  const needsAttention = athletes.filter((athlete) => athlete.eligibilityStatus && athlete.eligibilityStatus !== 'ELIGIBLE')
  const eligibleCount = athletes.filter((athlete) => athlete.eligibilityStatus === 'ELIGIBLE').length

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

  const addScheduleButton = <button className="btn btn-primary" type="button" onClick={() => setShowScheduleModal(true)}>+ Add training schedule</button>

  let content
  if (view === 'athletes' && profileAthlete) {
    content = <AthleteProfilePage athlete={profileAthlete} session={session} canReview onBack={() => { setProfileAthlete(null); dashboard.reload() }} />
  } else if (view === 'athletes') {
    content = <AthletesPage athletes={athletes} title="My athletes" subtitle="Student-athletes on the teams you coach" onViewProfile={setProfileAthlete} />
  } else if (view === 'schedule') {
    content = <>
      <PageHeader title="Schedule" subtitle="Training, sports events, and competitions for your teams" actions={addScheduleButton} />
      <Alert>{schedule.error}</Alert>
      <Card><CalendarView events={schedule.data || []} loading={schedule.loading} /></Card>
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
          <StatCard label="Athletes" value={dashboard.data?.athleteCount || 0} hint={`Across ${teams.length} team${teams.length === 1 ? '' : 's'}`} />
          <StatCard label="Eligible" value={eligibleCount} hint="Registrar decision" tone="success" />
          <StatCard label="Need attention" value={needsAttention.length} hint="Ineligible or awaiting evaluation" tone="warning" />
          <StatCard label="Portfolio reviews" value={pendingPortfolio.length} hint="Waiting for your verification" tone="info" />
        </div>

        <div className="dashboard-grid">
          <Card title="Portfolio verification" subtitle="Recent submissions awaiting your review">
            {pendingPortfolio.length ? (
              <ul className="row-list">
                {pendingPortfolio.slice(0, 5).map((item) => (
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
            ) : <EmptyState title="All caught up" message="No portfolio submissions are waiting for review." />}
          </Card>

          <Card title="Academic eligibility alerts" subtitle="Athletes who are ineligible or awaiting a Registrar decision">
            {needsAttention.length ? (
              <ul className="row-list">
                {needsAttention.map((athlete) => (
                  <li className="row" key={`${athlete.teamName}-${athlete.athleteId}`}>
                    <div className="row-main">
                      <strong>{fullName(athlete)}</strong>
                      <span>{athlete.teamName}</span>
                    </div>
                    <div className="row-actions">
                      <StatusBadge status={athlete.eligibilityStatus} />
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAthlete(athlete.athleteId)}>View</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No alerts" message="No athlete is currently ineligible or awaiting evaluation." />}
          </Card>

          <Card title="Upcoming schedule" subtitle="Next two weeks" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('schedule')}>Full schedule →</button>}>
            {upcoming.loading && !upcoming.data?.length ? <Loading /> : upcoming.data?.length ? (
              <ul className="row-list">
                {[...upcoming.data].sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`)).map((item) => (
                  <li className="row" key={item.id}>
                    <div className="row-main">
                      <strong>{item.title}</strong>
                      <span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span>
                      <small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small>
                      {item.rejectionReason && <small className="text-danger">Reason: {item.rejectionReason}</small>}
                    </div>
                    {item.approvalStatus && item.approvalStatus !== 'APPROVED' && <StatusBadge status={item.approvalStatus} label={item.approvalStatus === 'PENDING' ? 'Awaiting approval' : undefined} />}
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="Nothing scheduled" message="No training or events in the next two weeks." />}
          </Card>

          <Card title="My teams">
            {teams.length ? (
              <ul className="row-list">
                {teams.map((team) => (
                  <li className="row" key={team.teamId}>
                    <div className="row-main"><strong>{team.teamName}</strong><span>{team.sport}</span></div>
                    <span className="badge badge-neutral">{team.athleteCount} athlete{team.athleteCount === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No teams assigned" message="Ask the Sports Director to assign you to a team." />}
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
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'athletes', label: 'Athletes' },
        { key: 'schedule', label: 'Schedule' },
        { key: 'attendance', label: 'Attendance' },
        { key: 'performance', label: 'Performance' },
        { key: 'notifications', label: 'Notifications', badge: unread },
      ]}
      activeKey={view}
      pageTitle={profileAthlete && view === 'athletes' ? 'Athlete profile' : TITLES[view]}
      onNavigate={navigate}
      onLogout={onLogout}
      unreadCount={unread}
    >
      {content}
      {showScheduleModal && <TrainingScheduleModal teams={teams} session={session} onClose={() => setShowScheduleModal(false)} onCreated={refreshSchedules} />}
    </AppLayout>
  )
}
