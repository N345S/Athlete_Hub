import { useMemo, useState } from 'react'
import { formatDate } from '../lib/format.js'
import PerformanceTrendChart from '../PerformanceTrendChart.jsx'
import { ChartErrorBoundary } from './ErrorBoundary.jsx'
import Icon from './icons.jsx'
import { Alert, Card, EmptyState, Loading, StatCard, Tabs } from './ui.jsx'

const UNIT_SUFFIX = { NUMBER: '', SECONDS: ' s', METERS_PER_SECOND: ' m/s', PERCENT: '%' }
const LEGACY_NAMES = { PUSH_UP: 'Push-ups', BALANCE: 'Balance', SPRINT_10M: 'Sprint 10m', SPRINT_40M: 'Sprint 40m', VELOCITY: 'Velocity' }
const SESSIONS_PER_PAGE = 6

// Wording for the athlete reading their own results versus a coach or director viewing an athlete.
const COPY = {
  athlete: {
    pbHint: 'Times you beat your previous best',
    sessionsSubtitle: 'Each result compared with your previous one for the same workout',
    summarySubtitle: 'Your first, best, and latest result for each workout',
  },
  staff: {
    pbHint: 'Times they beat their previous best',
    sessionsSubtitle: 'Each result compared with the athlete’s previous one for the same workout',
    summarySubtitle: 'First, best, and latest result for each workout',
  },
}

/** Same grouping as the trend chart on the server: "Push Ups", "push_ups" and "PUSH UPS" are one workout. */
const workoutKey = (name) => String(name || '').trim().toUpperCase().replace(/_/g, ' ').split(/\s+/).filter(Boolean).join(' ')
const workoutName = (record) => LEGACY_NAMES[record.dataType] || String(record.dataType || record.metric?.metricName || 'Workout').replace(/_/g, ' ')
const formatValue = (value, unit) => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${UNIT_SUFFIX[unit] ?? ''}`

/** Timed runs improve when the time drops; everything else (reps, percent, holds, speed) improves when it rises. */
function lowerIsBetter(name, unit) {
  return unit === 'SECONDS' && /sprint|speed|run|dash|agility|shuttle|lap|time/i.test(name)
}

/**
 * Walks the records oldest → newest so each result knows the previous result for the same workout
 * and whether it beat every earlier one. Returns sessions (newest first) and a per-workout summary.
 */
function analyse(records) {
  const ordered = [...records].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate) || a.performanceRecordId - b.performanceRecordId)
  const history = new Map()
  const sessions = new Map()

  for (const record of ordered) {
    const key = workoutKey(record.dataType || record.metric?.metricName)
    const name = workoutName(record)
    const lower = lowerIsBetter(name, record.unit)
    const value = Number(record.recordedValue)
    const past = history.get(key) || { key, name, unit: record.unit, lower, values: [] }
    const previous = past.values.at(-1)
    const best = past.values.length ? (lower ? Math.min(...past.values) : Math.max(...past.values)) : null
    const delta = previous == null ? null : value - previous
    const better = (a, b) => (lower ? a < b : a > b)
    const result = {
      ...record,
      key,
      name,
      value,
      delta,
      trend: delta == null ? 'first' : delta === 0 ? 'same' : better(value, previous) ? 'up' : 'down',
      personalBest: best != null && better(value, best),
    }
    past.values.push(value)
    past.latest = result
    history.set(key, past)

    const sessionKey = record.sessionId ? `s${record.sessionId}` : `d${record.recordedDate}`
    if (!sessions.has(sessionKey)) sessions.set(sessionKey, { key: sessionKey, title: record.sessionTitle || 'Training session', date: record.recordedDate, results: [] })
    sessions.get(sessionKey).results.push(result)
  }

  const workouts = [...history.values()].map((item) => {
    const first = item.values[0]
    const best = item.lower ? Math.min(...item.values) : Math.max(...item.values)
    const change = item.latest.value - first
    return { ...item, first, best, change, improved: item.values.length > 1 && change !== 0 && (item.lower ? change < 0 : change > 0) }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return { sessions: [...sessions.values()].reverse(), workouts }
}

function Delta({ result }) {
  if (result.trend === 'first') return <span className="delta delta-first">First record</span>
  if (result.trend === 'same') return <span className="delta delta-same">Same as last time</span>
  const sign = result.delta > 0 ? '+' : '−'
  const amount = formatValue(Math.abs(result.delta), result.unit)
  return (
    <span className={`delta delta-${result.trend}`}>
      <span aria-hidden="true">{result.trend === 'up' ? '▲' : '▼'}</span>
      {sign}{amount} <span className="visually-hidden">{result.trend === 'up' ? '(improved)' : '(lower than last time)'}</span>
      <span className="delta-context" aria-hidden="true">vs last</span>
    </span>
  )
}

function SessionProgress({ session }) {
  const bests = session.results.filter((result) => result.personalBest).length
  return (
    <li className="session-progress">
      <div className="session-progress-header">
        <span className="session-progress-date" aria-hidden="true">
          <small>{new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</small>
          <strong>{new Date(`${session.date}T00:00:00`).getDate()}</strong>
        </span>
        <div className="session-progress-title">
          <strong>{session.title}</strong>
          <small>{formatDate(session.date)} · {session.results.length} result{session.results.length === 1 ? '' : 's'}</small>
        </div>
        {bests > 0 && <span className="badge badge-warning"><Icon name="trophy" size={14} /> {bests} personal best{bests === 1 ? '' : 's'}</span>}
      </div>
      <ul className="session-results">
        {session.results.map((result) => (
          <li key={result.performanceRecordId} className={`session-result trend-${result.trend}`}>
            <span className="session-result-name">{result.name}</span>
            <strong className="session-result-value">
              {formatValue(result.value, result.unit)}
              {result.personalBest && <span className="pb-tag" title="Personal best">PB</span>}
            </strong>
            <Delta result={result} />
            {result.notes && <small className="session-result-notes" title={result.notes}>“{result.notes}”</small>}
          </li>
        ))}
      </ul>
    </li>
  )
}

/**
 * One athlete's performance: summary cards, the progress chart, every training session's results
 * compared with the previous one, and a per-workout summary. Shared by the athlete's own page and
 * the coach/director view so both look the same.
 */
export default function PerformanceOverview({ data, viewer = 'athlete', emptyTitle = 'No results yet', emptyMessage }) {
  const { records, trend, range, setRange } = data
  const copy = COPY[viewer]
  const [workout, setWorkout] = useState('all')
  const [shown, setShown] = useState(SESSIONS_PER_PAGE)
  const { sessions, workouts } = useMemo(() => analyse(records.data?.records || []), [records.data])

  if (records.loading && !records.data) return <Loading label="Loading performance…" />

  const visibleSessions = workout === 'all'
    ? sessions
    : sessions.map((item) => ({ ...item, results: item.results.filter((result) => result.key === workout) })).filter((item) => item.results.length)
  const latest = sessions[0]
  const comparable = latest ? latest.results.filter((result) => result.trend !== 'first') : []
  const improvedLast = comparable.filter((result) => result.trend === 'up').length
  const personalBests = sessions.reduce((total, item) => total + item.results.filter((result) => result.personalBest).length, 0)

  return (
    <>
      <Alert>{records.error || trend.error}</Alert>
      {!sessions.length ? (
        <Card><EmptyState icon="chart" title={emptyTitle} message={emptyMessage} /></Card>
      ) : <>
        <div className="stat-grid">
          <StatCard icon="calendar" label="Sessions recorded" value={sessions.length} hint={`Latest: ${formatDate(latest.date)}`} tone="brand" />
          <StatCard icon="chart" label="Workouts tracked" value={workouts.length} hint={`${workouts.filter((item) => item.improved).length} improved since the first record`} tone="info" />
          <StatCard icon="check" label="Improved last session" value={comparable.length ? `${improvedLast} of ${comparable.length}` : '—'} hint={comparable.length ? 'Compared with the session before' : 'Needs two sessions to compare'} tone="success" />
          <StatCard icon="trophy" label="Personal bests" value={personalBests} hint={copy.pbHint} tone="warning" />
        </div>

        <Card title="Progress chart" subtitle="Each line is one workout across training sessions" actions={<Tabs label="Time range" value={range} onChange={setRange} options={[['overall', 'All time'], ['monthly', '30 days'], ['weekly', '7 days']]} />}>
          <div className="chart-area">
            {trend.loading && !trend.data ? <Loading label="Loading chart…" /> : trend.data?.labels?.length ? (
              <ChartErrorBoundary data={trend.data}>
                <PerformanceTrendChart data={trend.data} title="" />
              </ChartErrorBoundary>
            ) : <EmptyState icon="chart" title="Nothing in this range" message="Choose “All time” to see every session." />}
          </div>
        </Card>

        <Card title="Session by session" subtitle={copy.sessionsSubtitle}>
          {workouts.length > 1 && (
            <div className="workout-filter" role="group" aria-label="Show workout">
              <button type="button" className={`filter-chip ${workout === 'all' ? 'active' : ''}`} aria-pressed={workout === 'all'} onClick={() => setWorkout('all')}>All workouts</button>
              {workouts.map((item) => (
                <button key={item.key} type="button" className={`filter-chip ${workout === item.key ? 'active' : ''}`} aria-pressed={workout === item.key} onClick={() => setWorkout(item.key)}>{item.name}</button>
              ))}
            </div>
          )}
          <ol className="session-progress-list">
            {visibleSessions.slice(0, shown).map((item) => <SessionProgress key={item.key} session={item} />)}
          </ol>
          {visibleSessions.length > shown && (
            <button className="btn btn-secondary btn-block" type="button" onClick={() => setShown(shown + SESSIONS_PER_PAGE)}>
              Show older sessions ({visibleSessions.length - shown} more)
            </button>
          )}
        </Card>

        <Card title="Workout summary" subtitle={copy.summarySubtitle}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Workout</th><th className="numeric">First</th><th className="numeric">Best</th><th className="numeric">Latest</th><th>Overall change</th><th className="numeric">Sessions</th></tr></thead>
              <tbody>
                {workouts.map((item) => (
                  <tr key={item.key}>
                    <td><strong>{item.name}</strong>{item.lower && <small className="muted workout-hint">Lower is better</small>}</td>
                    <td className="numeric">{formatValue(item.first, item.unit)}</td>
                    <td className="numeric"><strong>{formatValue(item.best, item.unit)}</strong></td>
                    <td className="numeric">{formatValue(item.latest.value, item.unit)}</td>
                    <td>
                      {item.values.length < 2 ? <span className="muted">Only one record</span>
                        : item.change === 0 ? <span className="delta delta-same">No change</span>
                        : <span className={`delta delta-${item.improved ? 'up' : 'down'}`}><span aria-hidden="true">{item.improved ? '▲' : '▼'}</span>{item.change > 0 ? '+' : '−'}{formatValue(Math.abs(item.change), item.unit)}</span>}
                    </td>
                    <td className="numeric">{item.values.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>}
    </>
  )
}
