import { useState } from 'react'
import { formatDate, formatTimeRange, fullName, greeting, localDateISO, longToday, timeAgo } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import CalendarView from '../../components/CalendarView.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { Alert, Avatar, Card, EmptyState, Loading, PageHeader, ProgressBar, StatCard, StatusBadge, Tabs } from '../../components/ui.jsx'
import { HELP } from '../../lib/help.js'

const VIEWS = ['dashboard', 'training', 'notifications']
const TITLES = { dashboard: 'Dashboard', training: 'Training sessions', notifications: 'Notifications' }
const TRAINING_ONLY = ['TRAINING']

const byStart = (a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`)

/** Each session lists only this parent's children; flatten to one row per child per session. */
function childRows(sessions, athleteId) {
  return sessions.flatMap((session) => session.children
    .filter((child) => !athleteId || child.athleteId === athleteId)
    .map((child) => ({ session, child })))
}

/** Share of recorded sessions attended (present or late), matching the coach dashboard. */
function attendanceRate(rows) {
  const recorded = rows.filter((row) => row.child.attendanceStatus)
  if (!recorded.length) return null
  return Math.round(100 * recorded.filter((row) => ['PRESENT', 'LATE'].includes(row.child.attendanceStatus)).length / recorded.length)
}

function AttendanceBadge({ status, sessionDate }) {
  if (status) return <StatusBadge status={status} />
  return <span className="badge badge-neutral">{sessionDate > localDateISO() ? 'Upcoming' : 'Not recorded'}</span>
}

function Dashboard({ session, athletes, sessions, loading, onNavigate }) {
  const updates = useApiData('/api/Notifications/me', session.token, { initialData: [] })
  const today = localDateISO()
  const upcoming = sessions.filter((item) => item.startDate >= today).sort(byStart)
  const thisMonth = sessions.filter((item) => item.startDate.slice(0, 7) === today.slice(0, 7)).length
  const familyRate = attendanceRate(childRows(sessions.filter((item) => item.startDate <= today)))

  return (
    <>
      <PageHeader title={`${greeting()}, ${session.firstName || 'there'}`} subtitle={longToday()} />
      {loading && !athletes.length ? <Loading label="Loading your dashboard…" /> : !athletes.length ? (
        <Card>
          <EmptyState icon="users" title="No athletes linked yet" message="Ask the athletics office to link your account to your child's athlete account." />
        </Card>
      ) : <>
        <div className="stat-grid">
          <StatCard icon="users" label={athletes.length === 1 ? 'My child' : 'My children'} value={athletes.length} hint={athletes.map((child) => child.firstName).join(', ')} />
          <StatCard icon="calendar" label="Next training" value={upcoming[0] ? formatDate(upcoming[0].startDate) : '—'} hint={upcoming[0] ? `${upcoming[0].title} · ${formatTimeRange(upcoming[0].startTime)}` : 'No upcoming session'} tone="brand" onClick={() => onNavigate('training')} />
          <StatCard icon="clock" label="Sessions this month" value={thisMonth} hint="Approved training" tone="info" onClick={() => onNavigate('training')} />
          <StatCard icon="check" label="Attendance" value={familyRate == null ? '—' : `${familyRate}%`} hint="Present or late, of recorded sessions" tone="success" />
        </div>

        <div className="dashboard-grid">
          {athletes.map((child) => {
            const rows = childRows(sessions, child.athleteId)
            const next = rows.filter((row) => row.session.startDate >= today).sort((a, b) => byStart(a.session, b.session))[0]
            const recent = rows.filter((row) => row.session.startDate <= today).sort((a, b) => byStart(b.session, a.session)).slice(0, 4)
            const rate = attendanceRate(rows.filter((row) => row.session.startDate <= today))
            return (
              <Card key={child.athleteId}
                title={fullName(child)}
                subtitle={child.teams.length ? child.teams.map((team) => `${team.teamName} · ${team.sport}`).join(', ') : 'Not on a team yet'}
                actions={<Avatar firstName={child.firstName} lastName={child.lastName} size="sm" />}>
                {child.accountStatus && child.accountStatus !== 'ACTIVE' && <Alert tone="warning">This athlete account is {child.accountStatus.toLowerCase()}.</Alert>}
                <div className="metric-line"><span className="muted">Training attendance</span><ProgressBar value={rate} label="Training attendance" /></div>
                <ul className="row-list">
                  <li className="row">
                    <div className="row-main">
                      <strong>Next session</strong>
                      {next ? <>
                        <span>{next.session.title} · {formatDate(next.session.startDate)} · {formatTimeRange(next.session.startTime, next.session.endTime)}</span>
                        <small>{next.session.location || 'Location TBA'} · {next.session.teamName}</small>
                      </> : <span>No upcoming training</span>}
                    </div>
                  </li>
                  {recent.map(({ session: item, child: entry }) => (
                    <li className="row" key={item.id}>
                      <div className="row-main">
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.startDate)} · {item.teamName}</span>
                        {entry.remarks && <small>Coach remark: {entry.remarks}</small>}
                      </div>
                      <AttendanceBadge status={entry.attendanceStatus} sessionDate={item.startDate} />
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}

          <Card title="Latest updates" subtitle="New, cancelled, and attended training sessions" actions={<button className="btn btn-ghost btn-sm" type="button" onClick={() => onNavigate('notifications')}>All notifications →</button>}>
            {(updates.data || []).length ? (
              <ul className="row-list">
                {updates.data.slice(0, 5).map((item) => (
                  <li className="row" key={item.notificationId}>
                    <div className="row-main">
                      <strong className={item.isRead ? '' : 'text-brand'}>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>{timeAgo(item.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="bell" title="No updates yet" message="You'll be notified when training is scheduled, cancelled, or attendance is recorded." />}
          </Card>
        </div>
      </>}
    </>
  )
}

function TrainingPage({ athletes, sessions, loading, error }) {
  const [athleteId, setAthleteId] = useState('all')
  const selectedId = athleteId === 'all' ? null : Number(athleteId)
  const visible = selectedId ? sessions.filter((item) => item.children.some((child) => child.athleteId === selectedId)) : sessions
  const today = localDateISO()
  const history = childRows(visible.filter((item) => item.startDate <= today), selectedId).sort((a, b) => byStart(b.session, a.session))

  return (
    <>
      <PageHeader
        title="Training sessions"
        subtitle="Approved training for your children, with attendance recorded by the coach"
        actions={athletes.length > 1 && (
          <Tabs label="Show training for" value={athleteId} onChange={setAthleteId}
            options={[['all', 'All children'], ...athletes.map((child) => [String(child.athleteId), child.firstName])]} />
        )}
      />
      <Alert>{error}</Alert>
      <Card>
        <CalendarView
          events={visible}
          loading={loading}
          eventTypes={TRAINING_ONLY}
          renderDetails={(event) => <>
            {event.coachName && <div><dt>Coach</dt><dd>{event.coachName}</dd></div>}
            {event.children.filter((child) => !selectedId || child.athleteId === selectedId).map((child) => (
              <div key={child.athleteId}>
                <dt>{child.firstName}</dt>
                <dd><AttendanceBadge status={child.attendanceStatus} sessionDate={event.startDate} />{child.remarks ? ` ${child.remarks}` : ''}</dd>
              </div>
            ))}
          </>}
        />
      </Card>
      <Card title="Attendance history" subtitle="Past sessions, most recent first">
        {history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Session</th><th>Team</th><th>Athlete</th><th>Attendance</th></tr></thead>
              <tbody>
                {history.map(({ session: item, child }) => (
                  <tr key={`${item.id}-${child.athleteId}`}>
                    <td>{formatDate(item.startDate)}<br /><small className="muted">{formatTimeRange(item.startTime, item.endTime)}</small></td>
                    <td><strong>{item.title}</strong>{child.remarks && <><br /><small className="muted">{child.remarks}</small></>}</td>
                    <td>{item.teamName}</td>
                    <td>{child.firstName}</td>
                    <td><AttendanceBadge status={child.attendanceStatus} sessionDate={item.startDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="clipboard" title="No past sessions yet" message="Attendance appears here once your child's coach records it." />}
      </Card>
    </>
  )
}

export default function ParentPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const children = useApiData('/api/Parent/children', session.token, { initialData: [] })
  const training = useApiData('/api/Parent/training', session.token, { initialData: [] })
  const childList = children.data || []
  const sessions = training.data || []

  let content
  if (view === 'training') {
    content = <TrainingPage athletes={childList} sessions={sessions} loading={training.loading} error={training.error} />
  } else if (view === 'notifications') {
    content = <NotificationsPage session={session} onChanged={() => { refreshUnread(); training.reload() }} />
  } else {
    content = <>
      <Alert>{children.error || training.error}</Alert>
      <Dashboard session={session} athletes={childList} sessions={sessions} loading={children.loading} onNavigate={setView} />
    </>
  }

  return (
    <AppLayout
      portal="Parent Portal"
      roleLabel="Parent"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { key: 'training', label: 'Training sessions', icon: 'calendar' },
        { key: 'notifications', label: 'Notifications', icon: 'bell', badge: unread },
      ]}
      activeKey={view}
      pageTitle={TITLES[view]}
      onNavigate={setView}
      onLogout={onLogout}
      unreadCount={unread}
      help={HELP.parent[view]}
    >
      {content}
    </AppLayout>
  )
}
