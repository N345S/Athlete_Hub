import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, fullName, matchesSearch } from '../../lib/format.js'
import { useApiData, useHashView, useUnreadNotifications } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import NotificationsPage from '../../components/NotificationsPage.jsx'
import { Alert, Card, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader, SearchInput, StatCard, StatusBadge } from '../../components/ui.jsx'

const VIEWS = ['dashboard', 'accounts', 'notifications']
const TITLES = { dashboard: 'Overview', accounts: 'Accounts', notifications: 'Notifications' }
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
const EMPTY_FORM = { roleId: '', universityId: '', email: '', password: '', firstName: '', middleName: '', lastName: '', phone: '', accountStatus: 'ACTIVE' }

function UserFormModal({ user, roles, session, onClose, onSaved }) {
  const roleIdFor = (name) => String(roles.find((role) => role.roleName === name)?.roleId || roles[0]?.roleId || '')
  const [form, setForm] = useState(user ? {
    roleId: roleIdFor(user.role),
    universityId: user.universityId || '',
    email: user.email || '',
    password: '',
    firstName: user.firstName || '',
    middleName: user.middleName || '',
    lastName: user.lastName || '',
    phone: user.phone || '',
    accountStatus: user.accountStatus || 'ACTIVE',
  } : { ...EMPTY_FORM, roleId: roleIdFor('ATHLETE') })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      roleId: Number(form.roleId),
      universityId: form.universityId.trim(),
      email: form.email.trim().toLowerCase(),
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || null,
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
    }
    try {
      if (user) await api.put(`/api/Admin/users/${user.userId}`, { ...body, password: form.password || null, accountStatus: form.accountStatus }, session.token)
      else await api.post('/api/Admin/users', { ...body, password: form.password }, session.token)
      onSaved()
    } catch (err) {
      setError(err.data?.errors ? Object.values(err.data.errors).flat().join(' ') : err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={user ? 'Edit account' : 'Create account'} subtitle={user ? fullName(user) : 'Add a new platform account.'} onClose={onClose} size="lg"
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="user-form" disabled={saving}>{saving ? 'Saving…' : user ? 'Save changes' : 'Create account'}</button>
      </>}>
      <form id="user-form" className="form-grid" onSubmit={submit}>
        <Field label="First name"><input value={form.firstName} onChange={update('firstName')} required /></Field>
        <Field label="Last name"><input value={form.lastName} onChange={update('lastName')} required /></Field>
        <Field label="Middle name"><input value={form.middleName} onChange={update('middleName')} /></Field>
        <Field label="Phone"><input type="tel" value={form.phone} onChange={update('phone')} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={update('email')} required /></Field>
        <Field label="University ID"><input value={form.universityId} onChange={update('universityId')} required /></Field>
        <Field label="Role">
          <select value={form.roleId} onChange={update('roleId')} required>
            {roles.map((role) => <option key={role.roleId} value={role.roleId}>{role.roleName}</option>)}
          </select>
        </Field>
        {user && (
          <Field label="Status">
            <select value={form.accountStatus} onChange={update('accountStatus')}>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
        )}
        <Field label="Password" className="span-2" hint={user ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}>
          <input type="password" value={form.password} onChange={update('password')} minLength={8} required={!user} autoComplete="new-password" />
        </Field>
      </form>
      <Alert>{error}</Alert>
    </Modal>
  )
}

export default function AdminPortal({ session, onLogout }) {
  const [view, setView] = useHashView('dashboard', VIEWS)
  const [unread, refreshUnread] = useUnreadNotifications(session.token)
  const overview = useApiData(view === 'dashboard' ? '/api/AdminDashboard' : null, session.token)
  const users = useApiData('/api/Admin/users', session.token)
  const roles = useApiData('/api/Role', session.token, { initialData: [] })
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const userList = users.data?.users || []
  const filtered = userList.filter((user) => (!roleFilter || user.role === roleFilter)
    && matchesSearch(search, user.firstName, user.lastName, user.email, user.universityId, user.role))

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await api.del(`/api/Admin/users/${deleting.userId}`, session.token)
      users.setData((current) => ({ ...current, users: current.users.filter((item) => item.userId !== deleting.userId) }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  const stats = overview.data?.overview
  let content
  if (view === 'notifications') {
    content = <NotificationsPage session={session} onChanged={refreshUnread} />
  } else if (view === 'accounts') {
    content = <>
      <PageHeader title="User accounts" subtitle="Create, edit, deactivate, or remove platform accounts." actions={<button className="btn btn-primary" type="button" onClick={() => setEditing('new')}>+ Create account</button>} />
      <Alert>{users.error || error}</Alert>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, or ID…" label="Search accounts" />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {(roles.data || []).map((role) => <option key={role.roleId} value={role.roleName}>{role.roleName}</option>)}
        </select>
        <span className="muted">{filtered.length} shown</span>
      </div>
      <Card>
        {users.loading && !users.data ? <Loading label="Loading accounts…" /> : filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>University ID</th><th>Role</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.userId}>
                    <td>{fullName(user)}</td>
                    <td>{user.email}</td>
                    <td>{user.universityId}</td>
                    <td><span className="badge badge-neutral">{user.role}</span></td>
                    <td><StatusBadge status={user.accountStatus} /></td>
                    <td className="table-action">
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(user)}>Edit</button>
                      {user.userId !== session.userId && <button className="btn btn-ghost btn-sm text-danger" type="button" onClick={() => setDeleting(user)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No accounts found" />}
      </Card>
    </>
  } else {
    content = <>
      <PageHeader title="System overview" subtitle="Platform activity at a glance" />
      <Alert>{overview.error}</Alert>
      {overview.loading && !overview.data ? <Loading /> : <>
        <div className="stat-grid">
          <StatCard label="Accounts" value={userList.length} hint={`${userList.filter((user) => user.accountStatus !== 'ACTIVE').length} not active`} />
          <StatCard label="Athletes" value={stats?.totalAthletes ?? 0} tone="info" />
          <StatCard label="Coaches" value={stats?.totalCoaches ?? 0} tone="success" />
          <StatCard label="Teams" value={stats?.totalTeams ?? 0} tone="warning" />
        </div>
        <div className="dashboard-grid">
          <Card title="Recent achievements">
            {overview.data?.recentAchievements?.length ? (
              <ul className="row-list">
                {overview.data.recentAchievements.map((item) => (
                  <li className="row" key={item.achievementId}>
                    <div className="row-main"><strong>{item.title}</strong><span>{item.athleteName}</span><small>{formatDate(item.createdAt)}</small></div>
                    <StatusBadge status={item.verificationStatus} />
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No achievements yet" />}
          </Card>
          <Card title="Teams">
            {overview.data?.teams?.length ? (
              <ul className="row-list">
                {overview.data.teams.map((team) => (
                  <li className="row" key={team.teamId}>
                    <div className="row-main"><strong>{team.teamName}</strong><span>{team.sport} · Coach {team.coachName}</span></div>
                    <StatusBadge status={team.status} />
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No teams yet" />}
          </Card>
        </div>
      </>}
    </>
  }

  return (
    <AppLayout
      portal="Admin Portal"
      roleLabel="Administrator"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Overview' },
        { key: 'accounts', label: 'Accounts' },
        { key: 'notifications', label: 'Notifications', badge: unread },
      ]}
      activeKey={view}
      pageTitle={TITLES[view]}
      onNavigate={setView}
      onLogout={onLogout}
      unreadCount={unread}
    >
      {content}
      {editing && <UserFormModal user={editing === 'new' ? null : editing} roles={roles.data || []} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); users.reload() }} />}
      {deleting && (
        <ConfirmDialog
          title="Delete account"
          message={`Permanently delete ${fullName(deleting)}'s account? Accounts with existing records cannot be deleted — set them to Inactive instead.`}
          confirmLabel="Delete account"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </AppLayout>
  )
}
