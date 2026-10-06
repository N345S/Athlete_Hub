import { useState } from 'react'
import { fullName, matchesSearch } from '../../lib/format.js'
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
        <div className="card-grid">
          {filtered.map((athlete) => (
            <article className="person-card" key={`${athlete.teamName || 'none'}-${athlete.athleteId}`}>
              <div className="person-card-top">
                <Avatar firstName={athlete.firstName} lastName={athlete.lastName} size="lg" />
                <div>
                  <strong>{fullName(athlete)}</strong>
                  <small>{athlete.studentNumber || 'Student ID pending'}</small>
                  <span className="muted">{athlete.sport || 'Athlete'}{athlete.teamName ? ` · ${athlete.teamName}` : ''}</span>
                </div>
              </div>
              <dl className="person-card-stats">
                <div>
                  <dt>Academic eligibility</dt>
                  <dd>{athlete.eligibilityStatus ? <StatusBadge status={athlete.eligibilityStatus} label={athlete.eligibilityStatus === 'PENDING' ? 'Awaiting decision' : undefined} /> : <span className="muted">Not evaluated</span>}</dd>
                  {athlete.eligibilityTerm && <small className="muted">{athlete.eligibilityTerm}</small>}
                </div>
                <div><dt>Attendance</dt><dd>{athlete.attendanceRate == null ? '—' : `${athlete.attendanceRate}%`}</dd></div>
              </dl>
              <button className="btn btn-secondary btn-block" type="button" onClick={() => onViewProfile(athlete)}>View profile</button>
            </article>
          ))}
        </div>
      ) : <EmptyState title={athletes.length ? 'No matches' : 'No athletes yet'} message={athletes.length ? 'Try a different search.' : 'Athletes appear here once they are assigned to a team.'} />}
    </>
  )
}
