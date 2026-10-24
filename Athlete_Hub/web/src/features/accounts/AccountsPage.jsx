import { useState } from 'react'
import { api } from '../../lib/api.js'
import { fullName, matchesSearch, statusLabel } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import { useToast } from '../../components/toast.jsx'
import { roleName } from './roles.js'
import ImportAccountsModal from './ImportAccounts.jsx'
import { ActionMenu, Alert, Card, ConfirmDialog, EmptyState, Field, Loading, Modal, PageHeader, SearchInput, StatusBadge } from '../../components/ui.jsx'

const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
const EMPTY_FORM = { roleId: '', universityId: '', relationship: '', email: '', password: '', firstName: '', middleName: '', lastName: '', phone: '', accountStatus: 'ACTIVE' }

// How many search matches the athlete picker lists at once.
const PICKER_LIMIT = 8

/** "Juan Dela Cruz (SEED-A-001)" for each athlete a parent is linked to. */
const linkedLabel = (user) => (user.linkedAthletes || []).map((child) => `${fullName(child)} (${child.universityId})`).join(', ')

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

/**
 * Chooses the student-athletes a parent monitors: the chosen ones as removable chips, then a search that lists
 * matching athletes to tick once something is typed. `selected` is a Set of athlete user IDs.
 */
function AthletePicker({ athletes, selected, onChange }) {
  const [search, setSearch] = useState('')
  const chosen = athletes.filter((athlete) => selected.has(athlete.userId))
  const matches = athletes
    .filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.email, athlete.universityId))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
  const toggle = (userId) => {
    const next = new Set(selected)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    onChange(next)
  }

  return (
    <div className="athlete-picker">
      {chosen.length > 0 ? (
        <ul className="chip-list" aria-label="Chosen children">
          {chosen.map((athlete) => (
            <li className="chip" key={athlete.userId}>
              {fullName(athlete)} ({athlete.universityId})
              <button type="button" onClick={() => toggle(athlete.userId)} aria-label={`Remove ${fullName(athlete)}`}>×</button>
            </li>
          ))}
        </ul>
      ) : <small className="muted">No children chosen yet.</small>}
      <SearchInput value={search} onChange={setSearch} placeholder="Search athletes by name or University ID…" label="Search athletes to link" />
      {!search.trim() ? null : matches.length ? (
        <ul className="row-list athlete-picker-list">
          {matches.slice(0, PICKER_LIMIT).map((athlete) => (
            <li className="row" key={athlete.userId}>
              <label className="row-main">
                <span><input type="checkbox" checked={selected.has(athlete.userId)} onChange={() => toggle(athlete.userId)} /> <strong>{fullName(athlete)}</strong></span>
                <small>{athlete.universityId} · {athlete.email}</small>
              </label>
              {athlete.accountStatus !== 'ACTIVE' && <StatusBadge status={athlete.accountStatus} />}
            </li>
          ))}
        </ul>
      ) : <small className="muted">No athletes match “{search}”.</small>}
      {search.trim() && matches.length > PICKER_LIMIT && <small className="muted">Showing {PICKER_LIMIT} of {matches.length}. Type more of the name or ID to narrow the list.</small>}
    </div>
  )
}

function UserFormModal({ user, roles, athletes, session, onClose, onSaved }) {
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
  const savedChildren = (user?.linkedAthletes || []).map((child) => child.athleteUserId)
  const [children, setChildren] = useState(() => new Set(savedChildren))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const isSelf = user?.userId === session.userId
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (isParent && !children.size) {
      setError('Choose at least one child for this parent.')
      return
    }
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
      const relationship = form.relationship.trim() || null
      if (user) {
        await api.put(`/api/Accounts/users/${user.userId}`, { ...body, password: form.password || null, accountStatus: form.accountStatus }, session.token)
        const changed = children.size !== savedChildren.length || savedChildren.some((id) => !children.has(id))
        if (isParent && (changed || relationship)) await api.put(`/api/Accounts/users/${user.userId}/children`, { athleteUserIds: [...children], relationship }, session.token)
      } else await api.post('/api/Accounts/users', {
        ...body,
        password: form.password,
        ...(isParent && { childUniversityIds: athletes.filter((athlete) => children.has(athlete.userId)).map((athlete) => athlete.universityId), relationship }),
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
        {!isParent && <Field label="University ID" required hint="Students: A (regular) or T (transfer), entry year, student number, e.g. A24-31842. Coaches C, Director D, e.g. C18-20415."><input value={form.universityId} onChange={update('universityId')} required /></Field>}
        {isParent && <>
          <div className="field span-2">
            <span className="field-label">Children<span className="field-required" aria-hidden="true"> *</span></span>
            <AthletePicker athletes={athletes} selected={children} onChange={setChildren} />
            <small className="field-hint">Parents have no University ID. Tick each of their children; they see only these athletes' training and notifications.</small>
          </div>
          <Field label="Relationship" optional hint={user ? 'e.g. Mother, Father, Guardian. Leave blank to keep the saved one.' : 'e.g. Mother, Father, Guardian. Applies to every child.'}>
            <input value={form.relationship} onChange={update('relationship')} maxLength={50} />
          </Field>
        </>}
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

/**
 * Create accounts, reset passwords, and control who can sign in. Used by the Sports Director; `initialFilter`
 * ({ role, status }) opens the list already filtered.
 */
export default function AccountsPage({ session, initialFilter = {} }) {
  const toast = useToast()
  const users = useApiData('/api/Accounts/users', session.token)
  const roles = useApiData('/api/Role', session.token, { initialData: [] })
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [statusChange, setStatusChange] = useState(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(initialFilter.role || '')
  const [statusFilter, setStatusFilter] = useState(initialFilter.status || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const userList = users.data?.users || []
  const athletes = userList.filter((user) => user.role === 'ATHLETE')
  const filtered = userList
    .filter((user) => (!roleFilter || user.role === roleFilter) && (!statusFilter || user.accountStatus === statusFilter)
      && matchesSearch(search, user.firstName, user.lastName, user.email, user.universityId, user.role, linkedLabel(user)))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
  const clearFilters = () => { setSearch(''); setRoleFilter(''); setStatusFilter('') }

  const replaceUser = (updated) => users.setData((current) => ({ ...current, users: current.users.map((item) => item.userId === updated.userId ? { ...item, ...updated } : item) }))

  const applyStatus = async () => {
    setBusy(true)
    setError('')
    try {
      const updated = await api.put(`/api/Accounts/users/${statusChange.user.userId}/status`, { status: statusChange.status }, session.token)
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
      await api.del(`/api/Accounts/users/${deleting.userId}`, session.token)
      users.setData((current) => ({ ...current, users: current.users.filter((item) => item.userId !== deleting.userId) }))
      toast.success(`${fullName(deleting)}'s account was deleted.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  return (
    <>
      <PageHeader title="User accounts" subtitle="Create accounts, reset passwords, and control who can sign in." actions={<>
        <button className="btn btn-secondary" type="button" onClick={() => setImporting(true)}>Import CSV</button>
        <button className="btn btn-primary" type="button" onClick={() => setEditing('new')}>+ Create account</button>
      </>} />
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
        {(search || roleFilter || statusFilter) && <button className="btn btn-ghost btn-sm" type="button" onClick={clearFilters}>Clear filters</button>}
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
                                { label: 'Link children', onSelect: () => setEditing(user), hidden: user.role !== 'PARENT' },
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
        ) : <EmptyState icon="users" title="No accounts match" message="Try another search or filter." action={(search || roleFilter || statusFilter) && <button className="btn btn-secondary btn-sm" type="button" onClick={clearFilters}>Clear filters</button>} />}
      </Card>

      {editing && <UserFormModal user={editing === 'new' ? null : editing} roles={roles.data || []} athletes={athletes} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast.success(editing === 'new' ? 'Account created. Share the password with the user securely.' : `${fullName(editing)}'s account was updated.`); users.reload() }} />}
      {importing && (
        <ImportAccountsModal
          session={session}
          onClose={() => setImporting(false)}
          onImported={(count, mode) => { if (count) toast.success(mode === 'accounts' ? `${count} account${count === 1 ? '' : 's'} created.` : `${count} athlete profile${count === 1 ? '' : 's'} updated.`); users.reload() }}
        />
      )}
      {statusChange && (
        <ConfirmDialog
          title={`${STATUS_ACTIONS[statusChange.status].verb} account`}
          message={`${STATUS_ACTIONS[statusChange.status].verb} ${fullName(statusChange.user)} (${roleName(statusChange.user.role)})? ${STATUS_ACTIONS[statusChange.status].message}`}
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
    </>
  )
}
