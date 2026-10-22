import { useState } from 'react'
import { api } from '../../lib/api.js'
import { currentAcademicYear, currentSemester, formatDateTime, fullName, matchesSearch } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import { useToast } from '../../components/toast.jsx'
import { Alert, Card, EmptyState, Field, Loading, PageHeader, SearchInput, StatCard, StatusBadge, Tabs } from '../../components/ui.jsx'

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

const termLabel = (term) => `${term.semester} ${term.academicYear}`
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
function GradeSummary({ subjects }) {
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

/** Every pulled term for one athlete, newest first. Shown on the athlete's profile, to the director only. */
export function AthleteGradesCard({ athlete, session }) {
  const { data, loading, error } = useApiData(`/api/AcademicRecords/athlete/${athlete.athleteId}`, session.token)
  const terms = Object.values((data?.records || []).reduce((groups, record) => {
    const key = `${record.term.academicYear}|${record.term.semester}`
    groups[key] ??= { key, term: record.term, subjects: [] }
    groups[key].subjects.push(record)
    return groups
  }, {})).sort((a, b) => b.term.academicYear.localeCompare(a.term.academicYear) || SEMESTERS.indexOf(b.term.semester) - SEMESTERS.indexOf(a.term.semester))

  return (
    <Card title="Grades" subtitle="Final grades from the ICTD university database — visible to the Sports Director only">
      <Alert>{error}</Alert>
      {loading && !data ? <Loading label="Loading grades…" /> : terms.length ? (
        <div className="grade-terms">
          {terms.map((group, index) => (
            <details className="grade-term" key={group.key} open={index === 0}>
              <summary>
                <strong>{termLabel(group.term)}</strong>
                <GradeSummary subjects={group.subjects} />
              </summary>
              <GradeLines subjects={group.subjects} />
            </details>
          ))}
        </div>
      ) : <EmptyState icon="file" title="No grades yet" message="Pull a semester's grades from the ICTD database on the Grades page." />}
    </Card>
  )
}

/** Pull final grades from the ICTD university database and read them by athlete. */
export default function GradesPage({ session, onOpenAthlete }) {
  const toast = useToast()
  const terms = useApiData('/api/IctdGrades/terms', session.token, { initialData: [] })
  const [form, setForm] = useState({ academicYear: currentAcademicYear(), semester: currentSemester() })
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState('')
  const [picked, setPicked] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const termList = terms.data || []
  const selected = picked || termList[0] || null
  const grades = useApiData(selected ? `/api/IctdGrades?academicYear=${encodeURIComponent(selected.academicYear)}&semester=${encodeURIComponent(selected.semester)}` : null, session.token)
  const athletes = (grades.data?.athletes || [])
    .filter((athlete) => filter === 'all' || athlete.subjects.some(isProblem))
    .filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.studentNumber, athlete.course, ...athlete.subjects.flatMap((subject) => [subject.subjectCode, subject.subjectName, subject.sectionCode])))

  const pull = async (event) => {
    event.preventDefault()
    if (!/^\d{4}-\d{4}$/.test(form.academicYear.trim())) {
      setPullError('Enter the academic year as YYYY-YYYY, e.g. 2026-2027.')
      return
    }
    setPulling(true)
    setPullError('')
    try {
      const result = await api.post('/api/IctdGrades/pull', { academicYear: form.academicYear.trim(), semester: form.semester }, session.token)
      const sent = result.evaluationsSent
      toast.success(`${result.message}${sent ? ` ${sent} coach evaluation form${sent === 1 ? ' was' : 's were'} sent to students.` : ''}`)
      setPicked({ academicYear: result.term.academicYear, semester: result.term.semester })
      terms.reload()
      grades.reload()
    } catch (err) {
      setPullError(err.message)
    } finally {
      setPulling(false)
    }
  }

  // The summary figures come from the terms list, which is refreshed after every pull.
  const summary = selected && termList.find((term) => term.academicYear === selected.academicYear && term.semester === selected.semester)

  return (
    <>
      <PageHeader title="Grades" subtitle="Final grades pulled from the ICTD university database. Only the Sports Director can see them." />
      <div className="stack">
        <Card title="Pull from the ICTD database" subtitle="Pulling a semester's final grades releases them in Athlete-Hub and sends every student a form to evaluate their team coach.">
          <form className="inline-form" onSubmit={pull}>
            <Field label="Academic year" required hint="Format: YYYY-YYYY"><input value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} placeholder="2026-2027" required /></Field>
            <Field label="Semester" required>
              <select value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })}>
                {SEMESTERS.map((semester) => <option key={semester}>{semester}</option>)}
              </select>
            </Field>
            <div className="inline-form-actions">
              <button className="btn btn-primary" type="submit" disabled={pulling}>{pulling ? 'Pulling grades…' : 'Pull grades'}</button>
            </div>
            <Alert>{pullError}</Alert>
          </form>
        </Card>

        <Alert>{terms.error || grades.error}</Alert>
        {terms.loading && !termList.length ? <Loading label="Loading grades…" /> : !termList.length ? (
          <Card><EmptyState icon="file" title="No grades pulled yet" message="Choose a semester above and select “Pull grades”." /></Card>
        ) : <>
          <div className="toolbar">
            <Field label="Semester">
              <select value={selected ? `${selected.academicYear}|${selected.semester}` : ''} onChange={(event) => {
                const [academicYear, semester] = event.target.value.split('|')
                setPicked({ academicYear, semester })
              }}>
                {termList.map((term) => <option key={term.termId} value={`${term.academicYear}|${term.semester}`}>{termLabel(term)}</option>)}
              </select>
            </Field>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, ID, subject, or section…" label="Search grades" />
            <Tabs label="Show athletes" value={filter} onChange={setFilter} options={[['all', 'All'], ['problems', 'Failed or INC']]} />
          </div>

          {summary && (
            <div className="stat-grid">
              <StatCard icon="users" label="Student-athletes" value={summary.athletes} hint={`Pulled ${formatDateTime(summary.lastPulledAt)}`} />
              <StatCard icon="alert" label="Failed subjects" value={summary.failed} hint={`${summary.subjects} subjects in total`} tone="danger" onClick={() => setFilter('problems')} />
              <StatCard icon="clock" label="INC subjects" value={summary.incomplete} hint="Incomplete" tone="warning" onClick={() => setFilter('problems')} />
              <StatCard icon="chat" label="Coach evaluations" value={`${summary.evaluationsSubmitted} / ${summary.evaluationsSent}`} hint="Submitted by students" tone="info" />
            </div>
          )}

          <Card title={selected ? termLabel(selected) : 'Grades'} subtitle={`Showing ${athletes.length} of ${grades.data?.athletes?.length ?? 0} student-athletes`}>
            {grades.loading && !grades.data ? <Loading label="Loading grades…" /> : athletes.length ? (
              <div className="grade-terms">
                {athletes.map((athlete) => (
                  <details className="grade-term" key={athlete.athleteId}>
                    <summary>
                      <span className="row-main">
                        <strong>{fullName(athlete)}</strong>
                        <small>{[athlete.studentNumber, athlete.course, athlete.yearLevel ? `Year ${athlete.yearLevel}` : null].filter(Boolean).join(' · ')}</small>
                      </span>
                      <GradeSummary subjects={athlete.subjects} />
                    </summary>
                    <GradeLines subjects={athlete.subjects} />
                    {onOpenAthlete && <button className="btn btn-ghost btn-sm" type="button" onClick={() => onOpenAthlete(athlete.athleteId)}>Open athlete profile →</button>}
                  </details>
                ))}
              </div>
            ) : <EmptyState title="No matches" message={filter === 'problems' ? 'No student-athlete has a failed or INC subject this semester.' : 'Try a different search.'} />}
          </Card>
        </>}
      </div>
    </>
  )
}
