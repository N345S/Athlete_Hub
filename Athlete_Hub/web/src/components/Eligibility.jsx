import { useState } from 'react'
import { api } from '../lib/api.js'
import { useApiData } from '../lib/hooks.js'
import { useToast } from './toast.jsx'
import { Alert, EmptyState, Loading, Modal, StatusBadge } from './ui.jsx'

/** Eligible / Restricted / Under review, with the reasons on hover (and listed below when `showReasons`). */
export function EligibilityBadge({ status, reasons = [], showReasons = false }) {
  const key = status || 'UNDER_REVIEW'
  return (
    <span className="eligibility">
      <span title={reasons.length ? reasons.join('\n') : undefined}><StatusBadge status={key} /></span>
      {showReasons && key !== 'ELIGIBLE' && reasons.length > 0 && (
        <small className={`eligibility-reasons ${key === 'RESTRICTED' ? 'text-danger' : 'muted'}`}>{reasons.join(' · ')}</small>
      )}
    </span>
  )
}

/**
 * The written eligibility rules. The Sports Director can also choose which document types are required
 * clearances, and add a new type; every athlete is checked again right after.
 */
export function EligibilityRulesDialog({ session, canEdit = false, onClose, onChanged }) {
  const toast = useToast()
  const rules = useApiData('/api/Eligibility/rules', session.token)
  const types = useApiData(canEdit ? '/api/DocumentTypes' : null, session.token, { initialData: [] })
  const [busy, setBusy] = useState(null)
  const [newType, setNewType] = useState('')
  const [error, setError] = useState('')

  const toggle = async (type) => {
    setBusy(type.documentTypeId)
    setError('')
    try {
      await api.put(`/api/DocumentTypes/${type.documentTypeId}/required`, { required: !type.requiredForEligibility }, session.token)
      toast.success(type.requiredForEligibility ? `${type.name} is now optional.` : `${type.name} is now required. Athletes without it are restricted.`)
      types.reload()
      rules.reload()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const addType = async (event) => {
    event.preventDefault()
    if (!newType.trim()) return
    setBusy('new')
    setError('')
    try {
      const created = await api.post('/api/DocumentTypes', { name: newType.trim() }, session.token)
      toast.success(created.alreadyExists ? `${created.name} is already on the list.` : `${created.name} added.`)
      setNewType('')
      types.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal title="Eligibility rules" subtitle="How Athlete-Hub decides who may play in events" onClose={onClose} size="lg"
      footer={<button className="btn btn-primary" type="button" onClick={onClose}>Done</button>}>
      <Alert>{rules.error || types.error || error}</Alert>
      {rules.loading && !rules.data ? <Loading /> : rules.data && <>
        <p className="field-label">A student-athlete is <strong>Eligible</strong> when all of these are true:</p>
        <ol className="rules-list">
          {rules.data.rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ol>
        <dl className="status-legend">
          {rules.data.statuses.map((item) => (
            <div key={item.status}><dt><StatusBadge status={item.status} /></dt><dd>{item.meaning}</dd></div>
          ))}
        </dl>
        {!canEdit && (
          <p className="muted">Required documents: {rules.data.requiredDocuments.length ? rules.data.requiredDocuments.join(', ') : 'none'}.</p>
        )}
      </>}
      {canEdit && (
        <section className="rules-documents">
          <h3>Required clearance documents</h3>
          <p className="muted">Turn a document type on to require it from every student-athlete. Changes apply right away and coaches are notified of anyone who becomes restricted.</p>
          {types.loading && !types.data?.length ? <Loading /> : types.data?.length ? (
            <ul className="toggle-list">
              {types.data.map((type) => (
                <li key={type.documentTypeId}>
                  <label className="switch-row">
                    <input type="checkbox" checked={type.requiredForEligibility} disabled={busy != null} onChange={() => toggle(type)} />
                    <span><strong>{type.name}</strong><small>{type.documents} uploaded</small></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="file" title="No document types yet" />}
          <form className="inline-form" onSubmit={addType}>
            <input value={newType} onChange={(event) => setNewType(event.target.value)} maxLength={100} placeholder="New document type, e.g. PRISAA Player Form" aria-label="New document type" />
            <button className="btn btn-secondary" type="submit" disabled={busy != null || !newType.trim()}>Add type</button>
          </form>
        </section>
      )}
    </Modal>
  )
}
