import { useState } from 'react'
import { api } from '../../lib/api.js'
import { eventTypeLabel, formatDate, formatDateTime, formatTime, fullName } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import { EligibilityBadge } from '../../components/Eligibility.jsx'
import Icon from '../../components/icons.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Card, EmptyState, Loading, Modal, PageHeader, StatusBadge, Tabs } from '../../components/ui.jsx'

const LINEUP_LABELS = { PENDING: 'Awaiting approval', APPROVED: 'Approved', REJECTED: 'Returned' }

/** Short phrases for an event's qualification rules, e.g. "Basketball teams", "5–12 players". */
function ruleChips(rules) {
  if (!rules) return []
  const chips = []
  if (rules.sport) chips.push(`${rules.sport} teams only`)
  if (rules.minPlayers && rules.maxPlayers) chips.push(rules.minPlayers === rules.maxPlayers ? `Exactly ${rules.minPlayers} players` : `${rules.minPlayers}–${rules.maxPlayers} players`)
  else if (rules.minPlayers) chips.push(`At least ${rules.minPlayers} players`)
  else if (rules.maxPlayers) chips.push(`Up to ${rules.maxPlayers} players`)
  for (const doc of rules.requiredDocuments || []) chips.push(`${doc} required`)
  if (rules.maxAge) chips.push(`Age ${rules.maxAge} and under`)
  if (rules.maxYearLevel) chips.push(`Up to year ${rules.maxYearLevel}`)
  return chips
}

function RuleChips({ rules }) {
  const chips = ruleChips(rules)
  return (
    <div className="rule-chips">
      <span className="rule-chip rule-chip-base"><Icon name="check" size={13} /> Eligible players only</span>
      {chips.map((chip) => <span key={chip} className="rule-chip">{chip}</span>)}
    </div>
  )
}

function LineupBadge({ status }) {
  return <StatusBadge status={status} label={LINEUP_LABELS[status]} />
}

/** The Director's qualification rules for one event. */
function RulesModal({ event, sports, session, onClose, onSaved }) {
  const documentTypes = useApiData('/api/DocumentTypes', session.token, { initialData: [] })
  const rules = event.rules || {}
  const [form, setForm] = useState({
    sportId: rules.sportId ?? '',
    minPlayers: rules.minPlayers ?? '',
    maxPlayers: rules.maxPlayers ?? '',
    maxAge: rules.maxAge ?? '',
    maxYearLevel: rules.maxYearLevel ?? '',
    requiredDocuments: rules.requiredDocuments || [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (changeEvent) => setForm({ ...form, [key]: changeEvent.target.value })
  const number = (value) => value === '' ? null : Number(value)
  const toggleDocument = (name) => setForm((current) => ({
    ...current,
    requiredDocuments: current.requiredDocuments.includes(name) ? current.requiredDocuments.filter((item) => item !== name) : [...current.requiredDocuments, name],
  }))

  const save = async (submitEvent) => {
    submitEvent.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put(`/api/Lineups/events/${event.scheduleId}/rules`, {
        sportId: number(form.sportId),
        minPlayers: number(form.minPlayers),
        maxPlayers: number(form.maxPlayers),
        maxAge: number(form.maxAge),
        maxYearLevel: number(form.maxYearLevel),
        requiredDocuments: form.requiredDocuments,
      }, session.token)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Lineup rules" subtitle={`${event.title} · ${formatDate(event.startDate)}`} onClose={onClose} closeOnBackdrop={false}
      footer={<>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="lineup-rules-form" disabled={saving}>{saving ? 'Saving…' : 'Save rules'}</button>
      </>}>
      <form id="lineup-rules-form" className="form-grid" onSubmit={save}>
        <p className="span-2 muted">Coaches can only pick players who are Eligible. Leave a field empty for no limit. Rules are checked when a coach sends a lineup and again when you approve it.</p>
        <label className="field span-2">
          <span className="field-label">Sport</span>
          <select value={form.sportId} onChange={set('sportId')}>
            <option value="">Any sport</option>
            {sports.map((sport) => <option key={sport.sportId} value={sport.sportId}>{sport.sportName}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Minimum players</span><input type="number" min="1" max="100" value={form.minPlayers} onChange={set('minPlayers')} /></label>
        <label className="field"><span className="field-label">Maximum players</span><input type="number" min="1" max="100" value={form.maxPlayers} onChange={set('maxPlayers')} /></label>
        <label className="field"><span className="field-label">League age limit</span><input type="number" min="10" max="60" value={form.maxAge} onChange={set('maxAge')} placeholder="e.g. 25" /></label>
        <label className="field"><span className="field-label">Highest year level</span><input type="number" min="1" max="6" value={form.maxYearLevel} onChange={set('maxYearLevel')} placeholder="e.g. 4" /></label>
        <fieldset className="field span-2">
          <legend className="field-label">Documents every player must have on file</legend>
          {documentTypes.loading && !documentTypes.data?.length ? <Loading /> : (
            <div className="check-grid">
              {(documentTypes.data || []).filter((type) => type.name !== 'Other').map((type) => (
                <label key={type.documentTypeId} className="check-row">
                  <input type="checkbox" checked={form.requiredDocuments.includes(type.name)} onChange={() => toggleDocument(type.name)} />
                  <span>{type.name}{type.requiredForEligibility ? <small className="muted"> · already required for eligibility</small> : null}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </form>
      <Alert>{error || documentTypes.error}</Alert>
    </Modal>
  )
}

/** A coach picks players from one team; only qualified (Eligible, meeting the event's rules) members can be chosen. */
function LineupBuilder({ event, team, existing, session, onClose, onSaved }) {
  const candidates = useApiData(`/api/Lineups/events/${event.scheduleId}/candidates?teamId=${team.teamId}`, session.token)
  const [picked, setPicked] = useState(() => new Map((existing?.players || []).map((player) => [player.athleteId, player.position || ''])))
  const [notes, setNotes] = useState(existing?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [problems, setProblems] = useState([])
  const players = candidates.data?.players || []
  const rules = candidates.data?.rules || event.rules || {}
  const qualified = players.filter((player) => player.qualified)
  const count = picked.size
  const sizeProblem = rules.minPlayers && count < rules.minPlayers ? `Choose at least ${rules.minPlayers} players.`
    : rules.maxPlayers && count > rules.maxPlayers ? `Choose at most ${rules.maxPlayers} players.` : ''

  const toggle = (athleteId) => setPicked((current) => {
    const next = new Map(current)
    if (next.has(athleteId)) next.delete(athleteId)
    else next.set(athleteId, '')
    return next
  })
  const setPosition = (athleteId, value) => setPicked((current) => new Map(current).set(athleteId, value))

  const submit = async () => {
    setSaving(true)
    setError('')
    setProblems([])
    try {
      await api.post('/api/Lineups', {
        scheduleId: event.scheduleId,
        teamId: team.teamId,
        notes,
        players: [...picked.entries()].map(([athleteId, position]) => ({ athleteId, position })),
      }, session.token)
      onSaved(count)
    } catch (err) {
      setError(err.message)
      setProblems(err.data?.problems || [])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`${existing ? 'Edit' : 'Build'} lineup · ${team.teamName}`} subtitle={`${event.title} · ${formatDate(event.startDate)}`} onClose={onClose} closeOnBackdrop={false} size="lg"
      footer={<>
        <span className={`lineup-count ${sizeProblem ? 'text-danger' : ''}`}>{count} selected{sizeProblem ? ` · ${sizeProblem}` : ''}</span>
        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="button" onClick={submit} disabled={saving || !count || Boolean(sizeProblem) || Boolean(candidates.data?.teamProblem)}>{saving ? 'Sending…' : 'Send to Sports Director'}</button>
      </>}>
      <RuleChips rules={rules} />
      {candidates.data?.teamProblem && <Alert tone="warning">{candidates.data.teamProblem}</Alert>}
      <Alert>{candidates.error || error}</Alert>
      {problems.length > 0 && <ul className="problem-list">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
      {candidates.loading && !candidates.data ? <Loading label="Checking each player…" /> : players.length ? <>
        <p className="muted">{qualified.length} of {players.length} team members qualify. Players who do not are greyed out with the reason.</p>
        <ul className="lineup-picker">
          {players.map((player) => {
            const selected = picked.has(player.athleteId)
            return (
              <li key={player.athleteId} className={`${player.qualified ? '' : 'disabled'} ${selected ? 'selected' : ''}`}>
                <label className="lineup-pick">
                  <input type="checkbox" checked={selected} disabled={!player.qualified && !selected} onChange={() => toggle(player.athleteId)} />
                  <span className="lineup-pick-text">
                    <strong>{fullName(player)}</strong>
                    <small>{[player.studentNumber, player.course, player.yearLevel ? `Year ${player.yearLevel}` : null].filter(Boolean).join(' · ')}</small>
                    {!player.qualified && <small className="text-danger">{player.problems.join(' · ')}</small>}
                  </span>
                  <EligibilityBadge status={player.eligibility.status} reasons={player.eligibility.reasons} />
                </label>
                {selected && (
                  <input className="lineup-position" value={picked.get(player.athleteId)} onChange={(changeEvent) => setPosition(player.athleteId, changeEvent.target.value)} maxLength={50} placeholder="Position (optional)" aria-label={`Position for ${fullName(player)}`} />
                )}
              </li>
            )
          })}
        </ul>
        <label className="field">
          <span className="field-label">Note to the Sports Director <span className="muted">(optional)</span></span>
          <textarea rows="2" value={notes} onChange={(changeEvent) => setNotes(changeEvent.target.value)} maxLength={1000} />
        </label>
      </> : <EmptyState icon="users" title="No team members" message="Ask the Sports Director to assign athletes to this team first." />}
    </Modal>
  )
}

/** One lineup's players, each re-checked against eligibility and the event's rules; the Director approves or returns it. */
function LineupDetail({ lineupId, role, session, onClose, onChanged, onEdit }) {
  const toast = useToast()
  const detail = useApiData(`/api/Lineups/${lineupId}`, session.token)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [problems, setProblems] = useState([])
  const lineup = detail.data
  const anyProblem = lineup?.players?.some((player) => player.problems.length)

  const review = async (approve) => {
    if (!approve && !note.trim()) return setError('Please tell the coach what to change.')
    setBusy(approve ? 'approve' : 'return')
    setError('')
    setProblems([])
    try {
      await api.post(`/api/Lineups/${lineupId}/review`, { approve, note }, session.token)
      toast.success(approve ? `${lineup.teamName}'s lineup approved. The coach and players were notified.` : `Lineup returned to ${lineup.coachName || 'the coach'}.`)
      onChanged()
    } catch (err) {
      setError(err.message)
      setProblems(err.data?.problems || [])
    } finally {
      setBusy('')
    }
  }

  const withdraw = async () => {
    setBusy('withdraw')
    setError('')
    try {
      await api.del(`/api/Lineups/${lineupId}`, session.token)
      toast.success('Lineup withdrawn.')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const canReview = role === 'director' && lineup?.status === 'PENDING'
  const footer = role === 'director'
    ? <>
      <button className="btn btn-secondary" type="button" onClick={onClose}>Close</button>
      {canReview && <button className="btn btn-danger" type="button" onClick={() => review(false)} disabled={Boolean(busy)}>{busy === 'return' ? 'Returning…' : 'Return to coach'}</button>}
      {canReview && <button className="btn btn-primary" type="button" onClick={() => review(true)} disabled={Boolean(busy) || anyProblem}>{busy === 'approve' ? 'Approving…' : 'Approve lineup'}</button>}
    </>
    : <>
      <button className="btn btn-ghost text-danger" type="button" onClick={withdraw} disabled={Boolean(busy) || !lineup}>{busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw'}</button>
      <button className="btn btn-secondary" type="button" onClick={onClose}>Close</button>
      <button className="btn btn-primary" type="button" onClick={() => onEdit(lineup)} disabled={!lineup}>Edit & resend</button>
    </>

  return (
    <Modal title={lineup ? `${lineup.teamName} lineup` : 'Lineup'} subtitle={lineup ? `${lineup.event.title} · ${formatDate(lineup.event.startDate)} · Coach ${lineup.coachName || '—'}` : undefined} onClose={onClose} size="lg" footer={footer}>
      <Alert>{detail.error || error}</Alert>
      {problems.length > 0 && <ul className="problem-list">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
      {detail.loading && !lineup ? <Loading /> : lineup && <>
        <div className="lineup-meta">
          <LineupBadge status={lineup.status} />
          <span className="muted">Sent {formatDateTime(lineup.submittedAt)}{lineup.reviewedAt ? ` · Reviewed ${formatDateTime(lineup.reviewedAt)}` : ''}</span>
        </div>
        <RuleChips rules={lineup.event.rules} />
        {lineup.notes && <p className="lineup-note"><strong>Coach’s note:</strong> {lineup.notes}</p>}
        {lineup.reviewNote && <p className="lineup-note"><strong>Director’s note:</strong> {lineup.reviewNote}</p>}
        {anyProblem && <Alert tone="warning">Some players no longer meet the rules (shown below). The lineup cannot be approved until the coach changes it.</Alert>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Player</th><th>Position</th><th>Program / Year</th><th>Eligibility</th><th>Rule check</th></tr></thead>
            <tbody>
              {lineup.players.map((player) => (
                <tr key={player.athleteId}>
                  <td><strong>{fullName(player)}</strong><br /><small className="muted">{player.studentNumber}</small></td>
                  <td>{player.position || <span className="muted">—</span>}</td>
                  <td>{player.course || '—'}{player.yearLevel ? ` · Year ${player.yearLevel}` : ''}</td>
                  <td><EligibilityBadge status={player.eligibility.status} reasons={player.eligibility.reasons} /></td>
                  <td>{player.problems.length ? <small className="text-danger">{player.problems.join(' · ')}</small> : <span className="badge badge-success">Meets rules</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canReview && (
          <label className="field">
            <span className="field-label">Note to the coach <span className="muted">(required to return; optional when approving)</span></span>
            <textarea rows="2" value={note} onChange={(changeEvent) => setNote(changeEvent.target.value)} maxLength={1000} />
          </label>
        )}
      </>}
    </Modal>
  )
}

/**
 * Event lineups. Coaches build a lineup for each upcoming sports event or competition from their eligible
 * players; the Sports Director sets each event's rules and approves or returns lineups.
 */
export default function LineupsPage({ session, role, onChanged }) {
  const toast = useToast()
  const data = useApiData('/api/Lineups/events', session.token)
  const [filter, setFilter] = useState(role === 'director' ? 'pending' : 'all')
  const [rulesFor, setRulesFor] = useState(null)
  const [building, setBuilding] = useState(null)
  const [viewing, setViewing] = useState(null)
  const events = (data.data?.events || []).filter((event) => !event.cancelled)
  const teams = data.data?.teams || []
  const pendingCount = events.reduce((sum, event) => sum + event.lineups.filter((lineup) => lineup.status === 'PENDING').length, 0)
  const shownEvents = filter === 'pending' ? events.filter((event) => event.lineups.some((lineup) => lineup.status === 'PENDING')) : events

  const refresh = () => { data.reload(); onChanged?.() }

  const edit = async (lineupSummary) => {
    // The builder needs the current players to start from.
    try {
      const full = lineupSummary.players ? lineupSummary : await api.get(`/api/Lineups/${lineupSummary.lineupId}`, session.token)
      const event = events.find((item) => item.scheduleId === full.scheduleId)
      setViewing(null)
      setBuilding({ event, team: { teamId: full.teamId, teamName: full.teamName }, existing: full })
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Event lineups"
        subtitle={role === 'director' ? 'Set each event’s qualification rules and approve the players coaches send' : 'Choose eligible players for upcoming sports events and competitions'}
        actions={role === 'director' && <Tabs label="Show events" value={filter} onChange={setFilter} options={[['pending', `Awaiting approval (${pendingCount})`], ['all', 'All upcoming']]} />}
      />
      <Alert tone="info">Only <strong>Eligible</strong> student-athletes can be picked. Each lineup is also checked against the event’s rules (sport, roster size, required documents, age and year-level limits) before it reaches the Sports Director.</Alert>
      <Alert>{data.error}</Alert>
      {data.loading && !data.data ? <Loading label="Loading events…" /> : shownEvents.length ? (
        <div className="stack">
          {shownEvents.map((event) => {
            const openTeams = teams.filter((team) => event.openTeams.includes(team.teamId))
            return (
              <Card
                key={event.scheduleId}
                className="lineup-event"
                title={event.title}
                subtitle={`${formatDate(event.startDate)} · ${formatTime(event.startTime)}${event.location ? ` · ${event.location}` : ''}`}
                actions={<>
                  <span className={`badge type-${String(event.type).toLowerCase()}`}>{eventTypeLabel(event.type)}</span>
                  {role === 'director' && <button className="btn btn-secondary btn-sm" type="button" onClick={() => setRulesFor(event)}>Set rules</button>}
                </>}
              >
                <RuleChips rules={event.rules} />
                {event.lineups.length ? (
                  <ul className="row-list">
                    {event.lineups.map((lineup) => (
                      <li className="row" key={lineup.lineupId}>
                        <div className="row-main">
                          <strong>{lineup.teamName}</strong>
                          <span>{lineup.players} player{lineup.players === 1 ? '' : 's'}{role === 'director' && lineup.coachName ? ` · Coach ${lineup.coachName}` : ''}</span>
                          {lineup.status === 'REJECTED' && lineup.reviewNote && <small className="text-danger">Returned: {lineup.reviewNote}</small>}
                        </div>
                        <div className="row-actions">
                          <LineupBadge status={lineup.status} />
                          <button className={`btn btn-sm ${role === 'director' && lineup.status === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setViewing(lineup.lineupId)}>
                            {role === 'director' && lineup.status === 'PENDING' ? 'Review' : 'Open'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : role === 'director' ? <p className="muted">No lineups sent yet.</p> : null}
                {role === 'coach' && openTeams.length > 0 && (
                  <div className="lineup-actions">
                    {openTeams.map((team) => (
                      <button key={team.teamId} className="btn btn-primary btn-sm" type="button" onClick={() => setBuilding({ event, team })}>
                        <Icon name="plus" size={14} /> Build lineup · {team.teamName}
                      </button>
                    ))}
                  </div>
                )}
                {role === 'coach' && !openTeams.length && !event.lineups.length && <p className="muted">None of your teams can enter this event{event.rules?.sport ? ` (${event.rules.sport} teams only)` : ''}.</p>}
              </Card>
            )
          })}
        </div>
      ) : filter === 'pending'
        ? <EmptyState icon="check" title="No lineups waiting" message="Lineups coaches send appear here for your approval." action={<button className="btn btn-secondary btn-sm" type="button" onClick={() => setFilter('all')}>Show all upcoming events</button>} />
        : <EmptyState icon="calendar" title="No upcoming events" message={role === 'director' ? 'Add a sports event or competition on the Schedule page first.' : 'Lineups open once the Sports Director publishes a sports event or competition.'} />}

      {rulesFor && <RulesModal event={rulesFor} sports={data.data?.sports || []} session={session} onClose={() => setRulesFor(null)} onSaved={() => { setRulesFor(null); toast.success('Lineup rules saved.'); refresh() }} />}
      {building && <LineupBuilder event={building.event} team={building.team} existing={building.existing} session={session} onClose={() => setBuilding(null)} onSaved={(count) => { setBuilding(null); toast.success(`Lineup of ${count} sent to the Sports Director for approval.`); refresh() }} />}
      {viewing && <LineupDetail lineupId={viewing} role={role} session={session} onClose={() => setViewing(null)} onChanged={() => { setViewing(null); refresh() }} onEdit={edit} />}
    </>
  )
}
