import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, fullName, matchesSearch, statusLabel, timeAgo } from '../../lib/format.js'
import { useApiData, useHashView } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import { Alert, Card, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader, SearchInput, StatCard, StatusBadge } from '../../components/ui.jsx'

const VIEWS = ['dashboard', 'accounts']
const TITLES = { dashboard: 'Overview', accounts: 'Accounts' }
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
const ROLE_LABELS = { ATHLETE: 'Athletes', COACH: 'Coaches', DIRECTOR: 'Directors', REGISTRAR: 'Registrars', ADMIN: 'Admins' }
const EMPTY_FORM = { roleId: '', universityId: '', email: '', password: '', firstName: '', middleName: '', lastName: '', phone: '', accountStatus: 'ACTIVE' }

// What each status change means, shown in the confirmation dialog.
const STATUS_ACTIONS = {
  ACTIVE: { verb: 'Activate', message: 'They will be able to sign in again.' },
  SUSPENDED: { verb: 'Suspend', message: 'They are signed out immediately and cannot sign in until reactivated.' },
  INACTIVE: { verb: 'Deactivate', message: 'Use this when someone has left the school. They are signed out immediately and cannot sign in.' },
}

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
  const isSelf = user?.userId === session.userId
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
    <Modal title={user ? 'Edit account' : 'Create account'} subtitle={user ? fullName(user) : 'Profiles for athletes and coaches are created automatically.'} onClose={onClose} size="lg"
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
        <Field label="Role" hint={isSelf ? 'You cannot change your own role.' : undefined}>
          <select value={form.roleId} onChange={update('roleId')} required disabled={isSelf}>
            {roles.map((role) => <option key={role.roleId} value={role.roleId}>{role.roleName}</option>)}
          </select>
        </Field>
        {user && (
          <Field label="Status" hint={isSelf ? 'You cannot change your own status.' : undefined}>
            <select value={form.accountStatus} onChange={update('accountStatus')} disabled={isSelf}>
              {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </Field>
        )}
        <Field label={user ? 'Reset password' : 'Password'} className="span-2" hint={user ? 'Leave blank to keep the current password.' : 'At least 8 characters. Share it with the user securely.'}>
          <input type="password" value={form.password} onChange={update('password')} minLength={8} required={!user} autoComplete="new-password" />
        </Field>
      </form>
      <Alert>{error}</Alert>
    </Modal>
  )
}

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
                    <button className="link-button" type="button" onClick={() => onFilter({ role: row.role })}>{ROLE_LABELS[row.role] || row.role}</button>
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
                      <small>{user.role} · created {timeAgo(user.createdAt) || formatDate(user.createdAt)}</small>
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
  const users = useApiData('/api/Admin/users', session.token)
  const roles = useApiData('/api/Role', session.token, { initialData: [] })
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [statusChange, setStatusChange] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const userList = users.data?.users || []
  const filtered = userList
    .filter((user) => (!roleFilter || user.role === roleFilter) && (!statusFilter || user.accountStatus === statusFilter)
      && matchesSearch(search, user.firstName, user.lastName, user.email, user.universityId, user.role))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))

  const showAccounts = ({ role = '', status = '' }) => {
    setRoleFilter(role)
    setStatusFilter(status)
    setSearch('')
    setView('accounts')
  }

  const replaceUser = (updated) => users.setData((current) => ({ ...current, users: current.users.map((item) => item.userId === updated.userId ? { ...item, ...updated } : item) }))

  const applyStatus = async () => {
    setBusy(true)
    setError('')
    try {
      const updated = await api.put(`/api/Admin/users/${statusChange.user.userId}/status`, { status: statusChange.status }, session.token)
      replaceUser(updated)
      setNotice(`${fullName(statusChange.user)} is now ${statusLabel(statusChange.status).toLowerCase()}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setStatusChange(null)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await api.del(`/api/Admin/users/${deleting.userId}`, session.token)
      users.setData((current) => ({ ...current, users: current.users.filter((item) => item.userId !== deleting.userId) }))
      setNotice(`${fullName(deleting)}'s account was deleted.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  const content = view === 'accounts' ? <>
    <PageHeader title="User accounts" subtitle="Create accounts, reset passwords, and control who can sign in." actions={<button className="btn btn-primary" type="button" onClick={() => setEditing('new')}>+ Create account</button>} />
    <Alert>{users.error || error}</Alert>
    <Alert tone="success" onDismiss={() => setNotice('')}>{notice}</Alert>
    <div className="toolbar">
      <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, or ID…" label="Search accounts" />
      <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
        <option value="">All roles</option>
        {(roles.data || []).map((role) => <option key={role.roleId} value={role.roleName}>{role.roleName}</option>)}
      </select>
      <div className="segmented" role="group" aria-label="Filter by status">
        {[['', 'All'], ...STATUSES.map((status) => [status, statusLabel(status)])].map(([value, label]) => (
          <button key={value || 'all'} type="button" className={statusFilter === value ? 'active' : ''} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</button>
        ))}
      </div>
      <span className="muted">{filtered.length} of {userList.length}</span>
    </div>
    <Card>
      {users.loading && !users.data ? <Loading label="Loading accounts…" /> : filtered.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Account</th><th>University ID</th><th>Role</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {filtered.map((user) => {
                const isSelf = user.userId === session.userId
                return (
                  <tr key={user.userId}>
                    <td><strong>{fullName(user)}</strong>{isSelf && <small className="muted"> (you)</small>}<br /><small className="muted">{user.email}</small></td>
                    <td>{user.universityId}</td>
                    <td><span className="badge badge-neutral">{user.role}</span></td>
                    <td><StatusBadge status={user.accountStatus} /></td>
                    <td className="table-action">
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(user)}>Edit</button>
                        {!isSelf && (
                          <select
                            className="action-select"
                            value=""
                            aria-label={`More actions for ${fullName(user)}`}
                            onChange={(event) => {
                              const action = event.target.value
                              if (action === 'DELETE') setDeleting(user)
                              else if (action) setStatusChange({ user, status: action })
                            }}
                          >
                            <option value="">More…</option>
                            {STATUSES.filter((status) => status !== user.accountStatus).map((status) => (
                              <option key={status} value={status}>{STATUS_ACTIONS[status].verb}</option>
                            ))}
                            <option value="DELETE">Delete account</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon="users" title="No accounts match" message="Try another search or filter." />}
    </Card>
  </> : <Overview session={session} onFilter={showAccounts} />

  return (
    <AppLayout
      portal="Admin Portal"
      roleLabel="Administrator"
      session={session}
      nav={[
        { key: 'dashboard', label: 'Overview', icon: 'dashboard' },
        { key: 'accounts', label: 'Accounts', icon: 'users' },
      ]}
      activeKey={view}
      pageTitle={TITLES[view]}
      onNavigate={setView}
      onLogout={onLogout}
      showNotifications={false}
    >
      {content}
      {editing && <UserFormModal user={editing === 'new' ? null : editing} roles={roles.data || []} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice(editing === 'new' ? 'Account created.' : 'Account updated.'); users.reload() }} />}
      {statusChange && (
        <ConfirmDialog
          title={`${STATUS_ACTIONS[statusChange.status].verb} account`}
          message={`${STATUS_ACTIONS[statusChange.status].verb} ${fullName(statusChange.user)} (${statusChange.user.role})? ${STATUS_ACTIONS[statusChange.status].message}`}
          confirmLabel={STATUS_ACTIONS[statusChange.status].verb}
          tone={statusChange.status === 'ACTIVE' ? 'primary' : 'danger'}
          busy={busy}
          onCancel={() => setStatusChange(null)}
          onConfirm={applyStatus}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete account"
          message={`Permanently delete ${fullName(deleting)}'s account? Accounts with existing records cannot be deleted — deactivate them instead.`}
          confirmLabel="Delete account"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </AppLayout>
  )
}
