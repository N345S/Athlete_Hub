import { useState } from 'react'
import { formatDate, fullName, timeAgo } from '../../lib/format.js'
import { useApiData, useHashView } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import { Alert, Card, EmptyState, Loading, PageHeader, StatCard, StatusBadge } from '../../components/ui.jsx'
import { HELP } from '../../lib/help.js'
import AccountsPage from '../accounts/AccountsPage.jsx'
import { ROLE_LABELS, roleName } from '../accounts/roles.js'

// The Admin role is hidden (backend Services/HiddenRoles.cs): the Sports Director manages accounts now, and
// App.jsx does not route anyone here. This portal is kept so the role can be brought back.

const VIEWS = ['dashboard', 'accounts']
const TITLES = { dashboard: 'Overview', accounts: 'Accounts' }

function Overview({ session, onFilter }) {
  const { data, loading, error } = useApiData('/api/AdminDashboard', session.token)
  return (
    <>
      <PageHeader title="Account overview" subtitle="Who has access to Athlete-Hub" />
      <Alert>{error}</Alert>
      {loading && !data ? <Loading /> : data && <>
        <div className="stat-grid">
          <StatCard icon="users" label="All accounts" value={data.totalAccounts} onClick={() => onFilter({})} />
          <StatCard icon="check" label="Active" value={data.active} hint="Can sign in" tone="success" onClick={() => onFilter({ status: 'ACTIVE' })} />
          <StatCard icon="alert" label="Suspended" value={data.suspended} hint="Blocked until reactivated" tone="danger" onClick={() => onFilter({ status: 'SUSPENDED' })} />
          <StatCard icon="clock" label="Inactive" value={data.inactive} hint="Left the school" tone="warning" onClick={() => onFilter({ status: 'INACTIVE' })} />
        </div>
        <div className="dashboard-grid">
          <Card title="Accounts by role" subtitle="Select a role to manage its accounts">
            <ul className="row-list">
              {data.byRole.map((row) => (
                <li className="row" key={row.role}>
                  <div className="row-main">
                    <button className="link-button" type="button" onClick={() => onFilter({ role: row.role })}>{ROLE_LABELS[row.role] || row.role} <span aria-hidden="true">→</span></button>
                    <span className="role-breakdown">
                      <span className="stacked-bar" aria-hidden="true">
                        <span className="tone-success" style={{ flexGrow: row.active }} />
                        <span className="tone-warning" style={{ flexGrow: row.inactive }} />
                        <span className="tone-danger" style={{ flexGrow: row.suspended }} />
                      </span>
                      <small>{row.active} active · {row.inactive} inactive · {row.suspended} suspended</small>
                    </span>
                  </div>
                  <strong className="row-figure">{row.total}</strong>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Newest accounts">
            {data.recentAccounts.length ? (
              <ul className="row-list">
                {data.recentAccounts.map((user) => (
                  <li className="row" key={user.userId}>
                    <div className="row-main">
                      <strong>{fullName(user)}</strong>
                      <span>{user.email}</span>
                      <small>{roleName(user.role)} · created {timeAgo(user.createdAt) || formatDate(user.createdAt)}</small>
                    </div>
                    <StatusBadge status={user.accountStatus} />
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="users" title="No accounts yet" />}
          </Card>
        </div>
      </>}
    </>
  )
}

export default function AdminPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  // Changing the key reopens the accounts list with the filter picked on the overview.
  const [filter, setFilter] = useState({ key: 0 })

  const showAccounts = ({ role = '', status = '' }) => {
    setFilter((current) => ({ key: current.key + 1, role, status }))
    setView('accounts')
  }

  return (
    <AppLayout
      portal="Admin Portal"
      roleLabel="Administrator"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Overview', shortLabel: 'Home', icon: 'dashboard' },
        { key: 'accounts', label: 'Accounts', icon: 'users' },
      ]}
      activeKey={view}
      pageTitle={TITLES[view]}
      onNavigate={setView}
      onLogout={onLogout}
      showNotifications={false}
      help={HELP.admin[view]}
    >
      {view === 'accounts'
        ? <AccountsPage key={filter.key} session={session} initialFilter={filter} />
        : <Overview session={session} onFilter={showAccounts} />}
    </AppLayout>
  )
}
