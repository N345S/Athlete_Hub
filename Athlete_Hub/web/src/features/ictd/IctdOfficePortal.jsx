import { useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, fullName, matchesSearch } from '../../lib/format.js'
import { useApiData } from '../../lib/hooks.js'
import AppLayout from '../../components/AppLayout.jsx'
import { useToast } from '../../components/toast.jsx'
import { Alert, Card, ConfirmDialog, EmptyState, Loading, PageHeader, SearchInput, StatCard, Tabs } from '../../components/ui.jsx'
import { GradeLines, GradeSummary } from '../director/GradesPage.jsx'

const termName = (term) => `${term.semester} ${term.academicYear}`
const termKey = (term) => `${term.academicYear}|${term.semester}`

/**
 * The ICTD grades office (backend Services/IctdOffice.cs): releases a term's final grades before their scheduled
 * date, which sends every student-athlete the coach evaluation, and takes the release back to test it again.
 */
function GradeReleasePage({ session }) {
  const toast = useToast()
  const overview = useApiData('/api/IctdOffice/terms', session.token)
  const terms = overview.data?.terms || []
  const [picked, setPicked] = useState('')
  const term = terms.find((item) => termKey(item) === picked) || terms[0]
  const sheet = useApiData(term ? `/api/IctdOffice/grades?academicYear=${encodeURIComponent(term.academicYear)}&semester=${encodeURIComponent(term.semester)}` : null, session.token, { initialData: [] })
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const active = overview.data?.activeAthletes || 0
  const released = term && term.studentsWithGrades > 0
  const students = (sheet.data || []).filter((item) => matchesSearch(search, fullName(item), item.studentNumber, item.course))

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      const result = await api.post(`/api/IctdOffice/${action}`, { academicYear: term.academicYear, semester: term.semester }, session.token)
      toast.success(result.message)
      setConfirming(null)
      overview.reload()
    } catch (err) {
      setError(err.message)
      setConfirming(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Final grade release" subtitle="ICTD University Database · Athlete-Hub receives each term's final grades on its release date" />
      <Alert>{overview.error || sheet.error || error}</Alert>
      {overview.loading && !overview.data ? <Loading label="Loading terms…" /> : term ? (
        <>
          {terms.length > 1 && <Tabs label="Term" value={termKey(term)} onChange={setPicked} options={terms.map((item) => [termKey(item), termName(item)])} />}
          <Card
            title={termName(term)}
            subtitle={`Scheduled release: ${formatDate(term.releasesOn)}`}
            actions={released ? (
              <button className="btn btn-secondary" type="button" onClick={() => setConfirming('take-back')}>Take back release</button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={() => setConfirming('release')} disabled={!active}>Release final grades now</button>
            )}
          >
            <div className="stat-grid">
              <StatCard icon="file" label="Students with grades" value={`${term.studentsWithGrades} of ${active}`} hint={released ? 'Released to Athlete-Hub' : 'Not released yet'} tone={released ? 'success' : 'info'} />
              <StatCard icon="chat" label="Coach evaluations sent" value={term.evaluationsSent} hint="One per student for each of their coaches" tone="brand" />
              <StatCard icon="check" label="Evaluations answered" value={term.evaluationsAnswered} hint={term.evaluationsSent ? `${term.evaluationsSent - term.evaluationsAnswered} still waiting` : 'Sent when grades are released'} tone="warning" />
            </div>
            {released && term.studentsWithGrades < active && (
              <Alert tone="info">
                {active - term.studentsWithGrades} active student-athlete{active - term.studentsWithGrades === 1 ? ' has' : 's have'} no grades for this term yet (for example, accounts added after the release).{' '}
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirming('release')}>Release to them too</button>
              </Alert>
            )}
          </Card>

          <Card title="Grade sheet" subtitle={`What ICTD ${released ? 'released' : 'will release'} for ${termName(term)} · ${(sheet.data || []).length} active student-athletes`}
            actions={<SearchInput value={search} onChange={setSearch} placeholder="Search students" label="Search students" />}>
            {sheet.loading && !sheet.data?.length ? <Loading label="Loading grades…" /> : students.length ? (
              <ul className="row-list">
                {students.map((student) => (
                  <li className="row row-stacked" key={student.athleteId}>
                    <div className="row-main">
                      <strong>{fullName(student)}</strong>
                      <span>{[student.studentNumber, student.course, student.yearLevel ? `Year ${student.yearLevel}` : null].filter(Boolean).join(' · ')}</span>
                      <small>{student.coaches.length ? `Evaluates ${student.coaches.map((name) => `Coach ${name}`).join(' and ')}` : 'Not on a team with a coach: no evaluation'}</small>
                    </div>
                    <div className="row-actions">
                      <GradeSummary subjects={student.subjects} />
                      <span className="muted">GWA {student.gwa == null ? '—' : Number(student.gwa).toFixed(2)}</span>
                      <button className="btn btn-ghost btn-sm" type="button" aria-expanded={open === student.athleteId} onClick={() => setOpen(open === student.athleteId ? null : student.athleteId)}>
                        {open === student.athleteId ? 'Hide grades' : 'Show grades'}
                      </button>
                    </div>
                    {open === student.athleteId && <GradeLines subjects={student.subjects} />}
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="users" title={search ? 'No one matches that search' : 'No active student-athletes'} message={search ? 'Try another name or student number.' : 'Grades are released only to active student-athlete accounts.'} />}
          </Card>
        </>
      ) : <EmptyState icon="file" title="No upcoming term" message="There is no term waiting for its grades." />}

      {confirming === 'release' && (
        <ConfirmDialog
          title={`Release ${termName(term)} grades?`}
          message={`Every active student-athlete gets their final grades now instead of on ${formatDate(term.releasesOn)}, and each is sent a coach evaluation form with a notification. The Sports Director sees the grades on the Grades page.`}
          confirmLabel="Release grades"
          tone="primary"
          busy={busy}
          onConfirm={() => run('release')}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'take-back' && (
        <ConfirmDialog
          title={`Take back ${termName(term)}?`}
          message={`This deletes the term's grades, all ${term.evaluationsSent} coach evaluations for it (including the ${term.evaluationsAnswered} already answered), and their notifications, so you can test the release again.`}
          confirmLabel="Take back"
          busy={busy}
          onConfirm={() => run('take-back')}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  )
}

export default function IctdOfficePortal({ session, onLogout }) {
  return (
    <AppLayout
      portal="ICTD Grades Office"
      roleLabel="ICTD"
      session={session}
      nav={[{ key: 'release', label: 'Grade release', shortLabel: 'Grades', icon: 'file' }]}
      activeKey="release"
      pageTitle="Final grade release"
      onNavigate={() => {}}
      onLogout={onLogout}
      showNotifications={false}
    >
      <GradeReleasePage session={session} />
    </AppLayout>
  )
}
