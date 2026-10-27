import { useState } from 'react'
import { formatDateTime, fullName, matchesSearch } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import { Alert, Card, EmptyState, Field, Loading, Modal, PageHeader, SearchInput, StatCard, StatusBadge, Tabs } from '../../components/ui.jsx'
import Icon from '../../components/icons.jsx'

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

const termLabel = (term) => `${term.semester} ${term.academicYear}`
const termKey = (term) => `${term.academicYear}|${term.semester}`
const formatGrade = (grade) => grade == null ? '—' : Number(grade).toFixed(2)
const formatUnits = (units) => {
  const value = Number(units ?? 0)
  return `${value} unit${value === 1 ? '' : 's'}`
}
const isProblem = (subject) => subject.remarks === 'FAILED' || subject.remarks === 'INC'

/**
 * A term's subjects in the ICTD layout, two lines per subject:
 *   CODE : Subject name                     1.75
 *   Section: BSIT-2A - (3 units)          Passed
 */
export function GradeLines({ subjects }) {
  return (
    <div className="grade-sheet">
      <div className="grade-sheet-head" aria-hidden="true"><span>Subject</span><span>Grades</span></div>
      <ul className="grade-list">
        {subjects.map((subject) => (
          <li className="grade-line" key={subject.subjectCode}>
            <span className="grade-subject"><strong>{subject.subjectCode}</strong> : {subject.subjectName}</span>
            <span className="grade-value"><span className="visually-hidden">Grade </span>{formatGrade(subject.grade)}</span>
            <span className="grade-section">Section: {subject.sectionCode || '—'} - ({formatUnits(subject.units)})</span>
            <span className="grade-remark"><StatusBadge status={subject.remarks} /></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "7 subjects · 20 units" plus a badge for failed and INC subjects. */
export function GradeSummary({ subjects }) {
  const units = subjects.reduce((total, subject) => total + Number(subject.units || 0), 0)
  const failed = subjects.filter((subject) => subject.remarks === 'FAILED').length
  const incomplete = subjects.filter((subject) => subject.remarks === 'INC').length
  return (
    <span className="grade-summary">
      <small className="muted">{subjects.length} subject{subjects.length === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}</small>
      {failed > 0 && <StatusBadge status="FAILED" label={`${failed} failed`} />}
      {incomplete > 0 && <StatusBadge status="INC" label={`${incomplete} INC`} />}
      {!failed && !incomplete && <StatusBadge status="PASSED" label="All passed" />}
    </span>
  )
}

/** "ICTD database last checked …, next check …" for the automatic sync. */
export function GradeSyncStatus({ status }) {
  if (!status) return null
  if (!status.lastCheckedAt) return <span>Checking the ICTD database for released grades…</span>
  return (
    <span className={status.lastCheckFailed ? 'text-danger' : undefined}>
      {status.lastCheckFailed ? 'Could not reach the ICTD database on the last try' : 'ICTD database last checked'} {formatDateTime(status.lastCheckedAt)}
      {status.nextCheckAt && <> · next check {formatDateTime(status.nextCheckAt)}</>}
    </span>
  )
}

/**
 * One student-athlete's grades in a pop-up, a semester at a time (`initialTerm`, or the newest).
 * `session` must carry the unlocked token from the password check.
 */
export function AthleteGradesModal({ athlete, session, initialTerm, onClose, onOpenAthlete }) {
  const { data, loading, error } = useApiData(`/api/AcademicRecords/athlete/${athlete.athleteId}`, session.token)
  const terms = Object.values((data?.records || []).reduce((groups, record) => {
    const key = termKey(record.term)
    groups[key] ??= { key, term: record.term, subjects: [] }
    groups[key].subjects.push(record)
    return groups
  }, {})).sort((a, b) => b.term.academicYear.localeCompare(a.term.academicYear) || SEMESTERS.indexOf(b.term.semester) - SEMESTERS.indexOf(a.term.semester))
  const [picked, setPicked] = useState(initialTerm ? termKey(initialTerm) : null)
  const shown = terms.find((group) => group.key === picked) || terms[0]

  return (
    <Modal
      title={fullName(athlete)}
      subtitle={[athlete.studentNumber, athlete.course, athlete.yearLevel ? `Year ${athlete.yearLevel}` : null].filter(Boolean).join(' · ') || 'Grades'}
      onClose={onClose}
      size="lg"
      footer={<>
        {onOpenAthlete && <button className="btn btn-ghost" type="button" onClick={() => onOpenAthlete(athlete.athleteId)}>Open athlete profile</button>}
        <button className="btn btn-secondary" type="button" onClick={onClose}>Close</button>
      </>}
    >
      <Alert>{error}</Alert>
      {loading && !data ? <Loading label="Loading grades…" /> : shown ? (
        <div className="stack">
          <div className="grade-modal-head">
            {terms.length > 1 ? (
              <Field label="Semester">
                <select value={shown.key} onChange={(event) => setPicked(event.target.value)}>
                  {terms.map((group) => <option key={group.key} value={group.key}>{termLabel(group.term)}</option>)}
                </select>
              </Field>
            ) : <strong>{termLabel(shown.term)}</strong>}
            <GradeSummary subjects={shown.subjects} />
          </div>
          <GradeLines subjects={shown.subjects} />
          <p className="grade-confidential"><Icon name="lock" size={14} /> Confidential — from the ICTD university database. Only the Sports Director can see this.</p>
        </div>
      ) : <EmptyState icon="file" title="No grades yet" message="Grades appear here automatically once the ICTD database releases a semester's final grades." />}
    </Modal>
  )
}

/** On an athlete's profile, grades stay hidden until the director asks for them and enters their password. */
export function LockedGradesCard({ onView }) {
  return (
    <Card title="Grades" subtitle="Final grades from the ICTD university database — confidential" actions={<button className="btn btn-secondary btn-sm" type="button" onClick={onView}><Icon name="lock" size={15} /> View grades</button>}>
      <p className="muted">Grades open in a pop-up after you enter your password.</p>
    </Card>
  )
}

/**
 * Final grades from the ICTD university database, read by semester and athlete. Nothing is pulled here: the API
 * copies a semester's grades automatically once ICTD releases them. `session` carries the unlocked token.
 */
export default function GradesPage({ session, onOpenAthlete }) {
  const terms = useApiData('/api/IctdGrades/terms', session.token, { initialData: [] })
  const sync = useApiData('/api/DirectorDashboard/grade-sync', session.token)
  const [picked, setPicked] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [viewing, setViewing] = useState(null)

  const termList = terms.data || []
  const selected = picked || termList[0] || null
  const grades = useApiData(selected ? `/api/IctdGrades?academicYear=${encodeURIComponent(selected.academicYear)}&semester=${encodeURIComponent(selected.semester)}` : null, session.token)
  const athletes = (grades.data?.athletes || [])
    .filter((athlete) => filter === 'all' || athlete.subjects.some(isProblem))
    .filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.studentNumber, athlete.course, ...athlete.subjects.flatMap((subject) => [subject.subjectCode, subject.subjectName, subject.sectionCode])))

  const summary = selected && termList.find((term) => term.academicYear === selected.academicYear && term.semester === selected.semester)

  return (
    <>
      <PageHeader title="Grades" subtitle="Final grades sync automatically from the ICTD university database as soon as they are released. Only you can see them." />
      <div className="stack">
        <div className="grade-sync-note">
          <Icon name="refresh" size={16} />
          <GradeSyncStatus status={sync.data} />
        </div>

        <Alert>{terms.error || grades.error}</Alert>
        {terms.loading && !termList.length ? <Loading label="Loading grades…" /> : !termList.length ? (
          <Card><EmptyState icon="file" title="No grades released yet" message="Grades appear here automatically once the ICTD database releases a semester's final grades." /></Card>
        ) : <>
          <div className="toolbar">
            <Field label="Semester">
              <select value={selected ? termKey(selected) : ''} onChange={(event) => {
                const [academicYear, semester] = event.target.value.split('|')
                setPicked({ academicYear, semester })
              }}>
                {termList.map((term) => <option key={term.termId} value={termKey(term)}>{termLabel(term)}</option>)}
              </select>
            </Field>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, ID, subject, or section…" label="Search grades" />
            <Tabs label="Show athletes" value={filter} onChange={setFilter} options={[['all', 'All'], ['problems', 'Failed or INC']]} />
          </div>

          {summary && (
            <div className="stat-grid">
              <StatCard icon="users" label="Student-athletes" value={summary.athletes} hint={`Synced ${formatDateTime(summary.lastPulledAt)}`} />
              <StatCard icon="alert" label="Failed subjects" value={summary.failed} hint={`${summary.subjects} subjects in total`} tone="danger" onClick={() => setFilter('problems')} />
              <StatCard icon="clock" label="INC subjects" value={summary.incomplete} hint="Incomplete" tone="warning" onClick={() => setFilter('problems')} />
              <StatCard icon="chat" label="Coach evaluations" value={`${summary.evaluationsSubmitted} / ${summary.evaluationsSent}`} hint="Submitted by students" tone="info" />
            </div>
          )}

          <Card title={selected ? termLabel(selected) : 'Grades'} subtitle={`Showing ${athletes.length} of ${grades.data?.athletes?.length ?? 0} student-athletes — select one to see their grades`}>
            {grades.loading && !grades.data ? <Loading label="Loading grades…" /> : athletes.length ? (
              <ul className="row-list">
                {athletes.map((athlete) => (
                  <li className="row grade-athlete" key={athlete.athleteId}>
                    <div className="row-main">
                      <strong>{fullName(athlete)}</strong>
                      <small>{[athlete.studentNumber, athlete.course, athlete.yearLevel ? `Year ${athlete.yearLevel}` : null].filter(Boolean).join(' · ')}</small>
                    </div>
                    <GradeSummary subjects={athlete.subjects} />
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setViewing(athlete)}>View grades</button>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No matches" message={filter === 'problems' ? 'No student-athlete has a failed or INC subject this semester.' : 'Try a different search.'} />}
          </Card>
        </>}
      </div>
      {viewing && <AthleteGradesModal athlete={viewing} session={session} initialTerm={selected} onClose={() => setViewing(null)} onOpenAthlete={onOpenAthlete} />}
    </>
  )
}
