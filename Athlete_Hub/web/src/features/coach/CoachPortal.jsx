import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, formatTimeRange, fullName, greeting, isActiveAccount, localDateISO, longToday, mergeAthleteTeams } from '../../lib/format.js'
import { useApiData, useHashView, usePageDetail, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView, { ScheduleStatusBadge } from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Card, ConfirmDialog, EmptyState, Loading, PageHeader, SeeAllLink, StatCard, StatusBadge } from '../../components/ui.jsx'
import { HELP } from '../../lib/help.js'
import { PREVIEW_ROWS, useSeeMore } from '../../lib/lists.jsx'
import { goToRoute, NOTIFICATION_ROUTES } from '../../lib/notifications.js'
import { EligibilityRulesDialog } from '../../components/Eligibility.jsx'
import Icon from '../../components/icons.jsx'
import AthletesPage from '../staff/AthletesPage.jsx'
import AthleteProfilePage from '../staff/AthleteProfilePage.jsx'
import AttendancePage from '../staff/AttendancePage.jsx'
import LineupsPage from '../staff/LineupsPage.jsx'
import PerformancePage from '../staff/PerformancePage.jsx'
import ManageScheduleCard, { ChangeButtons } from '../staff/ManageSchedule.jsx'
import { ScheduleChangeModal, TrainingScheduleModal } from '../staff/ScheduleModals.jsx'

const VIEWS = ['dashboard', 'athletes', 'lineups', 'schedule', 'attendance', 'performance', 'notifications']
const TITLES = { dashboard: 'Dashboard', athletes: 'My athletes', lineups: 'Event lineups', schedule: 'Schedule', attendance: 'Attendance', performance: 'Performance', notifications: 'Notifications' }

export default function CoachPortal({ session, onLogout }) {
  const toast = useToast()
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [profileAthlete, setProfileAthlete] = usePageDetail(view)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  // { event, mode: 'cancel' | 'reschedule' } for the training session being changed.
  const [changing, setChanging] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [athleteFilter, setAthleteFilter] = useState(null)
  const [showRules, setShowRules] = useState(false)
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const dashboard = useApiData('/api/CoachDashboard', session.token)
  const upcoming = useApiData(`/api/Schedules/staff?from=${localDateISO()}`, session.token, { initialData: [] })
  const schedule = useApiData(view === 'schedule' ? '/api/Schedules/staff' : null, session.token, { initialData: [] })

  const teams = dashboard.data?.teams || []
  const athletes = mergeAthleteTeams(teams.flatMap((team) => (team.athletes || []).map((athlete) => ({ ...athlete, teamName: team.teamName, sport: team.sport }))))
  const pendingPortfolio = (dashboard.data?.portfolioItems || []).filter((item) => String(item.achievementStatus || item.verificationStatus || 'PENDING').toUpperCase() === 'PENDING')
  const restricted = athletes.filter((athlete) => athlete.eligibilityStatus === 'RESTRICTED')
  const lineups = dashboard.data?.lineups || { pending: 0, returned: 0, approved: 0 }
  const upcomingItems = [...(upcoming.data || [])].sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`))
  const pendingSessions = upcomingItems.filter((item) => item.type === 'TRAINING' && item.approvalStatus === 'PENDING')
  // Pending requests have their own card, so "Coming up" lists only what is confirmed.
  const confirmedItems = upcomingItems.filter((item) => !item.approvalStatus || item.approvalStatus === 'APPROVED' || item.cancelled)
  const [portfolioShown, portfolioMore] = useSeeMore(pendingPortfolio, PREVIEW_ROWS)
  // One row per athlete, most serious issue first, listing every issue that applies.
  const attentionRows = athletes
    .map((athlete) => {
      const issues = []
      // A restricted athlete's reasons already mention an inactive or suspended account.
      if (!isActiveAccount(athlete) && athlete.eligibilityStatus !== 'RESTRICTED') issues.push({ label: `Account ${athlete.accountStatus.toLowerCase()}`, status: athlete.accountStatus })
      if (athlete.eligibilityStatus === 'RESTRICTED') issues.push({ label: 'Restricted', status: 'RESTRICTED', detail: (athlete.eligibilityReasons || []).join(' · ') })
      if (isActiveAccount(athlete) && athlete.attendanceRate != null && athlete.attendanceRate < 60) issues.push({ label: `${athlete.attendanceRate}% attendance`, status: 'LATE' })
      return { athlete, issues }
    })
    .filter((row) => row.issues.length)
    // Restricted athletes first: they cannot be put in a lineup until it is fixed.
    .sort((a, b) => Number(b.issues.some((issue) => issue.status === 'RESTRICTED')) - Number(a.issues.some((issue) => issue.status === 'RESTRICTED')))

  const navigate = (key) => {
    setProfileAthlete(null)
    setAthleteFilter(null)
    setView(key)
  }

  const showAthletes = (filter) => {
    navigate('athletes')
    setAthleteFilter(filter)
  }

  const openAthlete = (athleteId) => {
    const athlete = athletes.find((item) => item.athleteId === athleteId)
    if (!athlete) return
    setProfileAthlete(athlete, 'athletes')
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
      toast.success(`Training request “${cancelling.title}” withdrawn.`)
      setCancelling(null)
      refreshSchedules()
    } catch (err) {
      setActionError(err.message)
      setCancelling(null)
    } finally {
      setBusy(false)
    }
  }

  // Coaches change their own upcoming training; rejected and cancelled sessions are final. `close` shuts the
  // calendar's event dialog first when the action starts there.
  const changeActions = (event, close = () => {}) => {
    if (event.type !== 'TRAINING' || event.cancelled || ['REJECTED', 'EXPIRED'].includes(event.approvalStatus) || event.startDate < localDateISO()) return []
    const open = (mode) => { close(); setChanging({ event, mode }) }
    return [
      { label: 'Reschedule', onSelect: () => open('reschedule') },
      event.approvalStatus === 'PENDING'
        ? { label: 'Withdraw request', tone: 'danger', onSelect: () => { close(); setCancelling(event) } }
        : { label: 'Cancel session', tone: 'danger', onSelect: () => open('cancel') },
    ]
  }

  const addScheduleButton = <button className="btn btn-primary" type="button" onClick={() => setShowScheduleModal(true)}>+ Request training session</button>

  let content
  if (view === 'athletes' && profileAthlete) {
    content = <AthleteProfilePage athlete={profileAthlete} session={session} canEdit onBack={() => { setProfileAthlete(null); dashboard.reload() }} />
  } else if (view === 'athletes') {
    content = <AthletesPage
      key={JSON.stringify(athleteFilter)}
      athletes={athletes}
      title="My athletes"
      subtitle="Student-athletes on the teams you coach. Restricted athletes cannot be put in an event lineup."
      initialFilter={athleteFilter}
      onViewProfile={setProfileAthlete}
      actions={<button className="btn btn-ghost" type="button" onClick={() => setShowRules(true)}><Icon name="help" size={16} />Eligibility rules</button>}
    />
  } else if (view === 'lineups') {
    content = <LineupsPage session={session} role="coach" onChanged={dashboard.reload} />
  } else if (view === 'schedule') {
    content = <>
      <PageHeader title="Schedule" subtitle="Your training sessions plus the Director's sports events and competitions" actions={addScheduleButton} />
      <Alert tone="info">New training sessions are sent to the Sports Director for approval before athletes can see them. Sports events and competitions are published by the Director.</Alert>
      <Alert>{schedule.error || actionError}</Alert>
      <div className="stack">
        <ManageScheduleCard
          id="training-approvals"
          title="Training approvals"
          subtitle="Your requests waiting for the Sports Director. Reschedule or withdraw one while it waits; a request not approved by its date expires."
          events={(schedule.data || []).filter((event) => event.approvalStatus === 'PENDING')}
          loading={schedule.loading}
          actionsFor={(event) => changeActions(event)}
          countLabel="waiting"
          empty={<EmptyState icon="check" title="Nothing waiting for approval" message="Training sessions you request appear here until the Sports Director approves them." />}
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
  } else if (view === 'attendance') {
    content = <AttendancePage teams={teams} session={session} />
  } else if (view === 'performance') {
    content = <ErrorBoundary><PerformancePage athletes={athletes} session={session} canEdit /></ErrorBoundary>
  } else if (view === 'notifications') {
    content = <NotificationsPage session={session} routes={NOTIFICATION_ROUTES.coach} onNavigate={navigate} onChanged={refreshUnread} />
  } else {
    content = <>
      <PageHeader title={`${greeting()}, ${session.firstName || 'Coach'}`} subtitle={longToday()} actions={addScheduleButton} />
      <Alert>{dashboard.error}</Alert>
      {dashboard.loading && !dashboard.data ? <Loading label="Loading your dashboard…" /> : (
        <div className="dashboard-stack">
          {dashboard.data?.message && <Alert tone="info">{dashboard.data.message}</Alert>}
          {/* Only what needs the coach's action. Each list shows a few and links to the rest. */}
          <section aria-label="Needs your action">
            <h2 className="section-label">Needs your action</h2>
            <div className="stat-grid stat-grid-actions">
              <StatCard icon="alert" label="Restricted" value={restricted.length} hint="Cannot be put in a lineup" tone="danger" onClick={() => showAthletes({ eligibility: 'RESTRICTED' })} />
              <StatCard icon="trophy" label="Portfolio reviews" value={pendingPortfolio.length} hint="Waiting for your verification" tone="info" onClick={() => document.getElementById('coach-portfolio')?.scrollIntoView({ behavior: 'smooth' })} />
              <StatCard icon="team" label="Event lineups" value={lineups.returned ? `${lineups.returned} returned` : lineups.pending ? `${lineups.pending} waiting` : lineups.approved} hint={lineups.returned ? 'Fix and resend to the Director' : lineups.pending ? 'Awaiting the Director' : 'Approved for upcoming events'} tone={lineups.returned ? 'danger' : 'brand'} onClick={() => navigate('lineups')} />
              <StatCard icon="clock" label="Training requests" value={pendingSessions.length} hint="Awaiting the Director's approval" tone="warning" onClick={() => document.getElementById('coach-requests')?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          </section>

          <div className="dashboard-grid">
            <Card className="scroll-target" id="coach-attention" title="Athletes needing attention" subtitle="Restricted, low attendance, or inactive">
              {attentionRows.length ? (
                <ul className="row-list">
                  {attentionRows.slice(0, PREVIEW_ROWS).map(({ athlete, issues }) => (
                    <li className="row" key={athlete.athleteId}>
                      <div className="row-main">
                        <strong>{fullName(athlete)}</strong>
                        <span>{athlete.teamName}</span>
                        {issues.filter((issue) => issue.detail).map((issue) => <small key={issue.label} className="text-danger">{issue.detail}</small>)}
                      </div>
                      <div className="row-actions">
                        {issues.map((issue) => <StatusBadge key={issue.label} status={issue.status} label={issue.label} />)}
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAthlete(athlete.athleteId)}>View</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon="check" title="All clear" message="No athlete is restricted, inactive, or below 60% attendance." />}
              <SeeAllLink total={attentionRows.length} label={`See all ${attentionRows.length} in My athletes`} onClick={() => navigate('athletes')} />
            </Card>

            <Card className="scroll-target" id="coach-portfolio" title="Portfolio verification" subtitle="Submissions waiting for your review, newest first">
              {pendingPortfolio.length ? <>
                <ul className="row-list">
                  {portfolioShown.map((item) => (
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
                {portfolioMore}
              </> : <EmptyState icon="trophy" title="All caught up" message="No portfolio submissions are waiting for review." />}
            </Card>

            <Card className="scroll-target" id="coach-requests" title="Training requests" subtitle="Waiting for the Director's approval, soonest first">
              {pendingSessions.length ? (
                <ul className="row-list">
                  {pendingSessions.slice(0, PREVIEW_ROWS).map((item) => (
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
              <SeeAllLink total={pendingSessions.length} label={`See all ${pendingSessions.length} in Schedule`} onClick={() => goToRoute({ view: 'schedule', target: 'training-approvals' }, navigate)} />
            </Card>

            <Card title="Coming up" subtitle="Your next approved training and events">
              {upcoming.loading && !upcomingItems.length ? <Loading /> : confirmedItems.length ? (
                <ul className="row-list">
                  {confirmedItems.slice(0, PREVIEW_ROWS).map((item) => (
                    <li className="row" key={item.id}>
                      <div className="row-main">
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</span>
                        <small>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''}</small>
                      </div>
                      <div className="row-actions">
                        {item.type !== 'TRAINING' && <span className={`badge type-${item.type.toLowerCase()}`}>{item.type === 'COMPETITION' ? 'Competition' : 'Sports event'}</span>}
                        <ScheduleStatusBadge item={item} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon="calendar" title="Nothing scheduled" message="No upcoming training or events." />}
              <SeeAllLink total={confirmedItems.length} label="See the full schedule" onClick={() => navigate('schedule')} />
            </Card>
          </div>
        </div>
      )}
    </>
  }

  return (
    <AppLayout
      portal="Coach Portal"
      roleLabel="Coach"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: 'dashboard' },
        { key: 'athletes', label: 'My athletes', shortLabel: 'Athletes', icon: 'users' },
        { key: 'lineups', label: 'Event lineups', shortLabel: 'Lineups', icon: 'team', badge: lineups.returned },
        { key: 'schedule', label: 'Schedule', icon: 'calendar' },
        { key: 'attendance', label: 'Attendance', icon: 'clipboard' },
        { key: 'performance', label: 'Performance', shortLabel: 'Stats', icon: 'chart' },
      ]}
      activeKey={view}
      pageTitle={profileAthlete && view === 'athletes' ? 'Athlete profile' : TITLES[view]}
      onNavigate={navigate}
      onLogout={onLogout}
      unreadCount={unread}
      notificationRoutes={NOTIFICATION_ROUTES.coach}
      onNotificationsChanged={refreshUnread}
      help={HELP.coach[view]}
    >
      {content}
      {showRules && <EligibilityRulesDialog session={session} onClose={() => setShowRules(false)} />}
      {showScheduleModal && <TrainingScheduleModal teams={teams} session={session} onClose={() => setShowScheduleModal(false)} onCreated={() => { toast.success('Training request sent. The Sports Director will review it.'); refreshSchedules() }} />}
      {changing && (
        <ScheduleChangeModal
          event={changing.event}
          mode={changing.mode}
          role="coach"
          session={session}
          onClose={() => setChanging(null)}
          onDone={() => {
            toast.success(changing.mode === 'cancel' ? `“${changing.event.title}” cancelled. Everyone affected has been notified.` : `“${changing.event.title}” rescheduled. Everyone affected has been notified.`)
            setChanging(null)
            refreshSchedules()
          }}
        />
      )}
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
