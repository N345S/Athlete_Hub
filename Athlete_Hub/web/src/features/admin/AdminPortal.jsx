import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, fullName, matchesSearch, statusLabel, timeAgo } from '../../lib/format.js'
import { useApiData, useHashView } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import { useToast } from '../../components/toast.jsx'
import { ActionMenu, Alert, Card, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader, SearchInput, StatCard, StatusBadge } from '../../components/ui.jsx'
import { HELP } from '../../lib/help.js'

const VIEWS = ['dashboard', 'accounts']
const TITLES = { dashboard: 'Overview', accounts: 'Accounts' }
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
const ROLE_LABELS = { ATHLETE: 'Athletes', COACH: 'Coaches', DIRECTOR: 'Directors', REGISTRAR: 'Registrars', ADMIN: 'Admins', PARENT: 'Parents' }
const EMPTY_FORM = { roleId: '', universityId: '', childUniversityIds: '', relationship: '', email: '', password: '', firstName: '', middleName: '', lastName: '', phone: '', accountStatus: 'ACTIVE' }

/** Parents have no university ID; the admin enters their children's IDs instead (comma or line separated). */
const splitIds = (text) => text.split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean)

/** "Juan Dela Cruz (SEED-A-001)" for each athlete a parent is linked to. */
const linkedLabel = (user) => (user.linkedAthletes || []).map((child) => `${fullName(child)} (${child.universityId})`).join(', ')

const ROLE_NAMES = { ATHLETE: 'Athlete', COACH: 'Coach', DIRECTOR: 'Sports Director', REGISTRAR: 'Registrar', ADMIN: 'Administrator', PARENT: 'Parent' }
const roleName = (role) => ROLE_NAMES[role] || role

/** A readable temporary password: two words, digits, and a symbol (meets the 8-character minimum). */
function generatePassword() {
  const words = ['Eagle', 'Spike', 'Court', 'Sprint', 'Relay', 'Serve', 'Medal', 'Coach', 'Score', 'Pitch']
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length]
  const digits = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900 + 100)
  return `${pick()}${pick()}${digits}!`
}

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
  const isParent = roles.find((role) => String(role.roleId) === String(form.roleId))?.roleName === 'PARENT'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const isSelf = user?.userId === session.userId
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      roleId: Number(form.roleId),
      universityId: isParent ? null : form.universityId.trim(),
      email: form.email.trim().toLowerCase(),
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || null,
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
    }
    try {
      if (user) await api.put(`/api/Admin/users/${user.userId}`, { ...body, password: form.password || null, accountStatus: form.accountStatus }, session.token)
      else await api.post('/api/Admin/users', {
        ...body,
        password: form.password,
        ...(isParent && { childUniversityIds: splitIds(form.childUniversityIds), relationship: form.relationship.trim() || null }),
      }, session.token)
      onSaved()
    } catch (err) {
      setError(err.data?.errors ? Object.values(err.data.errors).flat().join(' ') : err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={user ? 'Edit account' : 'Create account'} subtitle={user ? fullName(user) : "Profiles for athletes and coaches are created automatically. Parents are linked to their children by the children's university IDs."} onClose={onClose} size="lg" closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="user-form" disabled={saving}>{saving ? 'Saving…' : user ? 'Save changes' : 'Create account'}</button>
      </>}>
      <form id="user-form" className="form-grid" onSubmit={submit}>
        <Field label="Role" required hint={isSelf ? 'You cannot change your own role.' : 'Decides which portal this person sees.'} className="span-2">
          <select value={form.roleId} onChange={update('roleId')} required disabled={isSelf}>
            {roles.map((role) => <option key={role.roleId} value={role.roleId}>{roleName(role.roleName)}</option>)}
          </select>
        </Field>
        <Field label="First name" required><input value={form.firstName} onChange={update('firstName')} required /></Field>
        <Field label="Last name" required><input value={form.lastName} onChange={update('lastName')} required /></Field>
        <Field label="Middle name" optional><input value={form.middleName} onChange={update('middleName')} /></Field>
        <Field label="Phone" optional><input type="tel" value={form.phone} onChange={update('phone')} placeholder="e.g. 0917 123 4567" /></Field>
        <Field label="Email" required hint="Used to sign in."><input type="email" value={form.email} onChange={update('email')} required placeholder="name@university.edu" /></Field>
        {!isParent && <Field label="University ID" required hint="The school-issued ID number."><input value={form.universityId} onChange={update('universityId')} required /></Field>}
        {isParent && !user && <>
          <Field label="Child's University ID(s)" required hint="The athlete's University ID. Separate several children with commas.">
            <input value={form.childUniversityIds} onChange={update('childUniversityIds')} placeholder="e.g. 2024-00123" required />
          </Field>
          <Field label="Relationship" optional hint="e.g. Mother, Father, Guardian.">
            <input value={form.relationship} onChange={update('relationship')} maxLength={50} />
          </Field>
        </>}
        {isParent && user && (
          <Field label="Linked children" className="span-2" hint="Parents have no university ID. Use More → Link children to change who they monitor.">
            <input value={linkedLabel(user) || 'None linked yet'} readOnly />
          </Field>
        )}
        {user && (
          <Field label="Status" hint={isSelf ? 'You cannot change your own status.' : undefined}>
            <select value={form.accountStatus} onChange={update('accountStatus')} disabled={isSelf}>
              {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </Field>
        )}
        <Field label={user ? 'Reset password' : 'Password'} required={!user} optional={Boolean(user)} className="span-2" hint={user ? 'Leave blank to keep the current password.' : 'At least 8 characters. Share it with the user securely.'}>
          <span className="password-field">
            <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={update('password')} minLength={8} required={!user} autoComplete="new-password" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setForm((current) => ({ ...current, password: generatePassword() })); setShowPassword(true) }}>Generate</button>
          </span>
        </Field>
      </form>
      <Alert>{error}</Alert>
    </Modal>
  )
}

/** Chooses which athlete accounts a parent may monitor. Parents see only these children's training. */
function ParentChildrenModal({ parent, athletes, session, onClose, onSaved }) {
  const linked = useApiData(`/api/Admin/users/${parent.userId}/children`, session.token)
  const [picked, setPicked] = useState(null)
  const [relationship, setRelationship] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Start from the saved links until the admin changes something.
  const selected = picked ?? new Set((linked.data || []).map((child) => child.athleteUserId))
  const shown = athletes
    .filter((athlete) => selected.has(athlete.userId) || matchesSearch(search, athlete.firstName, athlete.lastName, athlete.email, athlete.universityId))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))

  const toggle = (userId) => {
    const next = new Set(selected)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setPicked(next)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`/api/Admin/users/${parent.userId}/children`, { athleteUserIds: [...selected], relationship: relationship.trim() || null }, session.token)
      onSaved(selected.size)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Link children" subtitle={`${fullName(parent)} will see only these athletes' training sessions and notifications.`} onClose={onClose} size="lg" closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="button" onClick={save} disabled={saving || linked.loading}>{saving ? 'Saving…' : `Save ${selected.size} linked`}</button>
      </>}>
      <Alert>{linked.error || error}</Alert>
      <div className="form-grid">
        <SearchInput value={search} onChange={setSearch} placeholder="Search athletes by name, email, or ID…" label="Search athletes" />
        <Field label="Relationship" hint="Optional, e.g. Mother, Father, Guardian. Applies to every linked child.">
          <input value={relationship} onChange={(event) => setRelationship(event.target.value)} maxLength={50} />
        </Field>
      </div>
      {linked.loading ? <Loading label="Loading linked children…" /> : shown.length ? (
        <ul className="row-list">
          {shown.slice(0, 50).map((athlete) => (
            <li className="row" key={athlete.userId}>
              <label className="row-main">
                <span><input type="checkbox" checked={selected.has(athlete.userId)} onChange={() => toggle(athlete.userId)} /> <strong>{fullName(athlete)}</strong></span>
                <small>{athlete.universityId} · {athlete.email}</small>
              </label>
              {athlete.accountStatus !== 'ACTIVE' && <StatusBadge status={athlete.accountStatus} />}
            </li>
          ))}
        </ul>
      ) : <EmptyState icon="users" title="No athletes match" message="Try another name or university ID." />}
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
  const toast = useToast()
  const [view, setView] = useHashView('dashboard', VIEWS)
  const users = useApiData('/api/Admin/users', session.token)
  const roles = useApiData('/api/Role', session.token, { initialData: [] })
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [statusChange, setStatusChange] = useState(null)
  const [linking, setLinking] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const userList = users.data?.users || []
  const filtered = userList
    .filter((user) => (!roleFilter || user.role === roleFilter) && (!statusFilter || user.accountStatus === statusFilter)
      && matchesSearch(search, user.firstName, user.lastName, user.email, user.universityId, user.role, linkedLabel(user)))
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
      toast.success(`${fullName(statusChange.user)} is now ${statusLabel(statusChange.status).toLowerCase()}.`)
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
      toast.success(`${fullName(deleting)}'s account was deleted.`)
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
    <div className="toolbar">
      <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, or ID…" label="Search accounts" />
      <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
        <option value="">All roles</option>
        {(roles.data || []).map((role) => <option key={role.roleId} value={role.roleName}>{roleName(role.roleName)}</option>)}
      </select>
      <div className="segmented" role="group" aria-label="Filter by status">
        {[['', 'All'], ...STATUSES.map((status) => [status, statusLabel(status)])].map(([value, label]) => (
          <button key={value || 'all'} type="button" className={statusFilter === value ? 'active' : ''} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</button>
        ))}
      </div>
      <span className="muted">Showing {filtered.length} of {userList.length}</span>
      {(search || roleFilter || statusFilter) && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter('') }}>Clear filters</button>}
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
                    <td>{user.role === 'PARENT'
                      ? <small className="muted">{user.linkedAthletes?.length ? `Parent of ${linkedLabel(user)}` : 'No children linked'}</small>
                      : user.universityId}</td>
                    <td><span className="badge badge-neutral">{roleName(user.role)}</span></td>
                    <td><StatusBadge status={user.accountStatus} /></td>
                    <td className="table-action">
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(user)}>Edit</button>
                        {!isSelf && (
                          <ActionMenu
                            ariaLabel={`More actions for ${fullName(user)}`}
                            items={[
                              { label: 'Link children', onSelect: () => setLinking(user), hidden: user.role !== 'PARENT' },
                              ...STATUSES.filter((status) => status !== user.accountStatus).map((status) => ({
                                label: STATUS_ACTIONS[status].verb,
                                tone: status === 'ACTIVE' ? 'success' : 'warning',
                                onSelect: () => setStatusChange({ user, status }),
                              })),
                              { label: 'Delete account', tone: 'danger', onSelect: () => setDeleting(user) },
                            ]}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon="users" title="No accounts match" message="Try another search or filter." action={(search || roleFilter || statusFilter) && <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter('') }}>Clear filters</button>} />}
    </Card>
  </> : <Overview session={session} onFilter={showAccounts} />

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
      {content}
      {editing && <UserFormModal user={editing === 'new' ? null : editing} roles={roles.data || []} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast.success(editing === 'new' ? 'Account created. Share the password with the user securely.' : `${fullName(editing)}'s account was updated.`); users.reload() }} />}
      {linking && (
        <ParentChildrenModal
          parent={linking}
          athletes={userList.filter((user) => user.role === 'ATHLETE')}
          session={session}
          onClose={() => setLinking(null)}
          onSaved={(count) => { toast.success(`${fullName(linking)} is now linked to ${count} athlete${count === 1 ? '' : 's'}.`); setLinking(null); users.reload() }}
        />
      )}
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
