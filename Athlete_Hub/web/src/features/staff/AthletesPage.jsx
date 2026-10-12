import { useState } from 'react'
import { accountLabel, fullName, isActiveAccount, matchesSearch } from '../../lib/format.js'
import { Avatar, EmptyState, PageHeader, SearchInput, StatusBadge } from '../../components/ui.jsx'

/** Roster of athletes as cards; used by coaches (their teams) and the director (everyone). */
export default function AthletesPage({ athletes, title, subtitle, onViewProfile }) {
  const [search, setSearch] = useState('')
  const filtered = athletes.filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.studentNumber, athlete.sport, athlete.teamName, athlete.course))

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<span className="badge badge-neutral">{athletes.length} total</span>} />
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, student ID, team, or sport…" label="Search athletes" />
        <span className="muted">Showing {filtered.length} of {athletes.length}</span>
      </div>
      {filtered.length ? (
        <div className="card-grid person-grid">
          {filtered.map((athlete) => {
            const team = athlete.teamName ? [athlete.sport, athlete.teamName].filter(Boolean).join(' · ') : 'No active team'
            return (
              <article className="person-card" key={athlete.athleteId}>
                <div className="person-card-top">
                  <Avatar firstName={athlete.firstName} lastName={athlete.lastName} size="lg" />
                  <div>
                    <strong className="person-card-name" title={fullName(athlete)}>{fullName(athlete)}</strong>
                    <small className="person-card-meta">{athlete.studentNumber || 'Student ID pending'}</small>
                    <span className="person-card-team" title={team}>{team}</span>
                    {!isActiveAccount(athlete) && <StatusBadge status={athlete.accountStatus} label={accountLabel(athlete)} />}
                  </div>
                </div>
                <dl className="person-card-stats person-card-stats-wide">
                  <div>
                    <dt>Eligibility</dt>
                    <dd>{athlete.eligibilityStatus ? <StatusBadge status={athlete.eligibilityStatus} label={athlete.eligibilityStatus === 'PENDING' ? 'Awaiting decision' : undefined} /> : <span className="muted">Not evaluated</span>}</dd>
                    {athlete.eligibilityTerm && <small className="muted" title={athlete.eligibilityTerm}>{athlete.eligibilityTerm}</small>}
                  </div>
                  <div><dt>Attendance</dt><dd>{athlete.attendanceRate == null ? '—' : `${athlete.attendanceRate}%`}</dd></div>
                </dl>
                <button className="btn btn-secondary btn-block" type="button" onClick={() => onViewProfile(athlete)}>View profile</button>
              </article>
            )
          })}
        </div>
      ) : <EmptyState title={athletes.length ? 'No matches' : 'No athletes yet'} message={athletes.length ? 'Try a different search.' : 'Athletes appear here once they are assigned to a team.'} />}
    </>
  )
}
