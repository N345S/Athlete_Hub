import { useState } from 'react'
import { useApiData } from '../../lib/hooks.js'
import { Alert, Card, EmptyState, Field, Loading, Modal, PageHeader } from '../../components/ui.jsx'

const TEXT = {
  unlock: { title: 'Enter your page password', button: 'Open', busy: 'Checking…' },
  setUp: { title: 'Make a password for these pages', button: 'Save and open', busy: 'Saving…' },
  change: { title: 'Change your page password', button: 'Save and open', busy: 'Saving…' },
}

/**
 * Asks for the director's page password before Grades or Accounts open. The first time, there is none yet, so the
 * dialog sets one up instead; it can also be changed from here. `access` is useSensitiveAccess(); `onOpened` runs in
 * the same render as the unlock.
 */
export function UnlockDialog({ session, access, section, onOpened, onCancel }) {
  const status = useApiData('/api/Auth/confidential-password', session.token)
  const [chosen, setChosen] = useState(null)
  const mode = chosen || (status.data?.isSet === false ? 'setUp' : 'unlock')
  const [form, setForm] = useState({ password: '', current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const switchTo = (next) => {
    setChosen(next)
    setForm({ password: '', current: '', next: '', confirm: '' })
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (mode !== 'unlock') {
      if (form.next.length < 8) return setError('The new password must have at least 8 characters.')
      if (form.next !== form.confirm) return setError('The two new passwords are not the same. Please type them again.')
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'unlock') await access.unlock(form.password, onOpened)
      else if (mode === 'setUp') await access.setUp(form.current, form.next, onOpened)
      else await access.change(form.current, form.next, onOpened)
    } catch (err) {
      // Someone else's dialog may have set the password up meanwhile, or it was reset: show the right form.
      if (err.data?.code === 'NOT_SET_UP') switchTo('setUp')
      else if (err.status === 409) switchTo('unlock')
      setError(err.message)
      setForm((current) => ({ ...current, password: '', current: '' }))
      setBusy(false)
    }
  }

  const ready = mode === 'unlock' ? Boolean(form.password) : Boolean(form.current && form.next && form.confirm)
  const text = TEXT[mode]

  return (
    <Modal
      title={text.title}
      subtitle={`${section} are private. ${mode === 'setUp' ? 'Make a password that only you know. You will use it every time you open Grades or Accounts.' : 'Enter your password to continue.'}`}
      onClose={onCancel}
      size="sm"
      closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="unlock-form" disabled={busy || !ready || status.loading}>{busy ? text.busy : text.button}</button>
      </>}
    >
      {status.loading && !status.data ? <Loading label="Loading…" /> : (
        <form id="unlock-form" className="stack" onSubmit={submit}>
          {mode === 'unlock' && (
            <Field label="Page password" required hint="Not your sign-in password — the one you made for Grades and Accounts.">
              <input type="password" value={form.password} onChange={update('password')} autoComplete="current-password" required />
            </Field>
          )}
          {mode !== 'unlock' && <>
            <Field label={mode === 'setUp' ? 'Your sign-in password' : 'Current page password'} required hint={mode === 'setUp' ? 'To check that it is really you.' : undefined}>
              <input type="password" value={form.current} onChange={update('current')} autoComplete="current-password" required />
            </Field>
            <Field label="New page password" required hint="At least 8 characters, and different from your sign-in password.">
              <input type="password" value={form.next} onChange={update('next')} autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Type the new password again" required>
              <input type="password" value={form.confirm} onChange={update('confirm')} autoComplete="new-password" required />
            </Field>
          </>}
          <Alert>{error || status.error}</Alert>
          {mode === 'unlock' && (
            <p className="field-hint">
              <button className="link-button" type="button" onClick={() => switchTo('change')}>Change page password</button>
              {' · '}Forgot it? Ask the person who runs Athlete-Hub to reset it.
            </p>
          )}
          {mode === 'change' && <p className="field-hint"><button className="link-button" type="button" onClick={() => switchTo('unlock')}>Back</button></p>}
          <p className="field-hint">The pages lock again when you leave them or after 15 minutes.</p>
        </form>
      )}
    </Modal>
  )
}

/** Shown in place of a confidential page until the password is entered. */
export function LockedPage({ title, onUnlock }) {
  return (
    <>
      <PageHeader title={title} subtitle="Private — you need your page password to open this." />
      <Card>
        <EmptyState
          icon="lock"
          title="This page is locked"
          message="Enter your page password to continue. It locks again when you leave the page or after 15 minutes."
          action={<button className="btn btn-primary" type="button" onClick={onUnlock}>Enter password</button>}
        />
      </Card>
    </>
  )
}
