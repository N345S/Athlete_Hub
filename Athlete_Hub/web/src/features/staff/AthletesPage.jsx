import { useMemo, useState } from 'react'
import { fullName, localDateISO, matchesSearch, statusLabel } from '../../lib/format.js'
import { exportPdf, exportXlsx } from '../../lib/export.js'
import { EligibilityBadge } from '../../components/Eligibility.jsx'
import { ELIGIBILITY_OPTIONS } from '../../lib/eligibility.js'
import Icon from '../../components/icons.jsx'
import { useToast } from '../../components/toast.jsx'
import { Avatar, EmptyState, PageHeader, SearchInput, StatusBadge } from '../../components/ui.jsx'

const PAGE_SIZES = [10, 25, 50]
const ACCOUNT_OPTIONS = [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['SUSPENDED', 'Suspended']]

const teamsOf = (athlete) => athlete.teamNames?.length ? athlete.teamNames : athlete.teamName ? athlete.teamName.split(', ') : []
const sportsOf = (athlete) => athlete.sports?.length ? athlete.sports : athlete.sport ? athlete.sport.split(' · ') : []
const programYear = (athlete) => [athlete.course, athlete.yearLevel ? `Year ${athlete.yearLevel}` : null].filter(Boolean).join(' · ')
const sportTeam = (athlete) => teamsOf(athlete).length ? [sportsOf(athlete).join(' / '), teamsOf(athlete).join(', ')].filter(Boolean).join(' · ') : 'No active team'
const eligibilityOf = (athlete) => athlete.eligibilityStatus || 'UNDER_REVIEW'
const accountOf = (athlete) => String(athlete.accountStatus || 'ACTIVE').toUpperCase()

// Restricted athletes sort first, so the people who need action are at the top.
const ELIGIBILITY_ORDER = { RESTRICTED: 0, UNDER_REVIEW: 1, ELIGIBLE: 2 }
const COLUMNS = [
  { key: 'name', label: 'Name', sort: (athlete) => `${athlete.lastName} ${athlete.firstName}`.toLowerCase() },
  { key: 'studentNumber', label: 'Student ID', sort: (athlete) => athlete.studentNumber || '' },
  { key: 'team', label: 'Sport / Team', sort: (athlete) => sportTeam(athlete).toLowerCase() },
  { key: 'program', label: 'Program / Year', sort: (athlete) => programYear(athlete).toLowerCase() },
  { key: 'eligibility', label: 'Eligibility', sort: (athlete) => ELIGIBILITY_ORDER[eligibilityOf(athlete)] ?? 3 },
  { key: 'attendance', label: 'Attendance', sort: (athlete) => athlete.attendanceRate ?? -1, numeric: true },
  { key: 'account', label: 'Account', sort: (athlete) => accountOf(athlete) },
]

const EXPORT_COLUMNS = [
  { header: 'Name', value: (athlete) => `${athlete.lastName}, ${athlete.firstName}`, width: 26 },
  { header: 'Student ID', value: (athlete) => athlete.studentNumber || '', width: 14 },
  { header: 'Sport', value: (athlete) => sportsOf(athlete).join(' / '), width: 16 },
  { header: 'Team', value: (athlete) => teamsOf(athlete).join(', ') || 'No active team', width: 24 },
  { header: 'Program', value: (athlete) => athlete.course || '', width: 32 },
  { header: 'Year', value: (athlete) => athlete.yearLevel ?? '', width: 7 },
  { header: 'Eligibility', value: (athlete) => statusLabel(eligibilityOf(athlete)), width: 14 },
  { header: 'Restriction reason', value: (athlete) => eligibilityOf(athlete) === 'ELIGIBLE' ? '' : (athlete.eligibilityReasons || []).join('; '), width: 44 },
  { header: 'Attendance %', value: (athlete) => athlete.attendanceRate ?? '', width: 13 },
  { header: 'Account', value: (athlete) => statusLabel(accountOf(athlete)), width: 12 },
]

function Filter({ label, value, onChange, options, all }) {
  return (
    <label className="filter">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{all}</option>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  )
}

/**
 * Searchable, sortable roster table with filters, paging, and PDF/Excel export. Used for the Director's
 * "All athletes" (everyone) and a coach's "My athletes" (their teams). On a phone each row becomes a card.
 */
export default function AthletesPage({ athletes, title, subtitle, onViewProfile, actions, initialFilter }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('')
  const [team, setTeam] = useState('')
  const [eligibility, setEligibility] = useState(initialFilter?.eligibility || '')
  const [account, setAccount] = useState('')
  const [sort, setSort] = useState({ key: 'eligibility', direction: 'asc' })
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState('')

  const sportOptions = useMemo(() => [...new Set(athletes.flatMap(sportsOf))].sort().map((name) => [name, name]), [athletes])
  const teamOptions = useMemo(() => [...new Set(athletes.filter((athlete) => !sport || sportsOf(athlete).includes(sport)).flatMap(teamsOf))].sort().map((name) => [name, name]), [athletes, sport])
  const restrictedCount = athletes.filter((athlete) => eligibilityOf(athlete) === 'RESTRICTED').length

  const filtered = athletes
    .filter((athlete) => matchesSearch(search, athlete.firstName, athlete.lastName, athlete.studentNumber, athlete.sport, athlete.teamName, athlete.course))
    .filter((athlete) => !sport || sportsOf(athlete).includes(sport))
    .filter((athlete) => !team || teamsOf(athlete).includes(team))
    .filter((athlete) => !eligibility || eligibilityOf(athlete) === eligibility)
    .filter((athlete) => !account || accountOf(athlete) === account)
  const column = COLUMNS.find((item) => item.key === sort.key) || COLUMNS[0]
  const sorted = [...filtered].sort((a, b) => {
    const left = column.sort(a)
    const right = column.sort(b)
    const order = left < right ? -1 : left > right ? 1 : 0
    // Ties fall back to name order so the list never jumps around.
    return (sort.direction === 'asc' ? order : -order) || COLUMNS[0].sort(a).localeCompare(COLUMNS[0].sort(b))
  })
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const shown = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const filtersOn = Boolean(search || sport || team || eligibility || account)

  // Any change to what is listed starts again from the first page.
  const changeFilter = (setter) => (value) => { setter(value); setPage(1) }
  const toggleSort = (key) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }
  const clearFilters = () => {
    setSearch(''); setSport(''); setTeam(''); setEligibility(''); setAccount(''); setPage(1)
  }

  const filterSummary = [
    sport && `Sport: ${sport}`, team && `Team: ${team}`, eligibility && `Eligibility: ${statusLabel(eligibility)}`,
    account && `Account: ${statusLabel(account)}`, search && `Search: “${search}”`,
  ].filter(Boolean).join(' · ')

  const runExport = async (kind) => {
    if (!sorted.length) return
    setExporting(kind)
    const stamp = localDateISO()
    const name = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
    try {
      if (kind === 'xlsx') exportXlsx(`${name}.xlsx`, title, EXPORT_COLUMNS, sorted)
      else await exportPdf(`${name}.pdf`, title, `${sorted.length} student-athlete${sorted.length === 1 ? '' : 's'} · ${filterSummary || 'All athletes'} · Exported ${new Date().toLocaleString()}`, EXPORT_COLUMNS, sorted)
      toast.success(`Exported ${sorted.length} athlete${sorted.length === 1 ? '' : 's'} to ${kind === 'xlsx' ? 'Excel' : 'PDF'}.`)
    } catch {
      toast.error?.('The export could not be created. Please try again.')
    } finally {
      setExporting('')
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<>
          {actions}
          <button className="btn btn-secondary" type="button" onClick={() => runExport('xlsx')} disabled={!sorted.length || Boolean(exporting)}><Icon name="download" size={16} />{exporting === 'xlsx' ? 'Exporting…' : 'Excel'}</button>
          <button className="btn btn-secondary" type="button" onClick={() => runExport('pdf')} disabled={!sorted.length || Boolean(exporting)}><Icon name="download" size={16} />{exporting === 'pdf' ? 'Exporting…' : 'PDF'}</button>
        </>}
      />
      <div className="table-toolbar">
        <SearchInput value={search} onChange={changeFilter(setSearch)} placeholder="Search name, student ID, team, or program…" label="Search athletes" />
        <div className="table-filters">
          <Filter label="Sport" value={sport} onChange={(value) => { changeFilter(setSport)(value); setTeam('') }} options={sportOptions} all="All sports" />
          <Filter label="Team" value={team} onChange={changeFilter(setTeam)} options={teamOptions} all="All teams" />
          <Filter label="Eligibility" value={eligibility} onChange={changeFilter(setEligibility)} options={ELIGIBILITY_OPTIONS} all="Any eligibility" />
          <Filter label="Account" value={account} onChange={changeFilter(setAccount)} options={ACCOUNT_OPTIONS} all="Any account" />
        </div>
        <div className="table-quick">
          <button type="button" className={`filter-chip restricted-chip ${eligibility === 'RESTRICTED' ? 'active' : ''}`} aria-pressed={eligibility === 'RESTRICTED'}
            onClick={() => changeFilter(setEligibility)(eligibility === 'RESTRICTED' ? '' : 'RESTRICTED')}>
            <Icon name="alert" size={14} /> Restricted only <span className="chip-count">{restrictedCount}</span>
          </button>
          {filtersOn && <button className="btn btn-ghost btn-sm" type="button" onClick={clearFilters}>Clear filters</button>}
          <span className="muted table-count">Showing {shown.length ? (currentPage - 1) * pageSize + 1 : 0}–{(currentPage - 1) * pageSize + shown.length} of {sorted.length}{sorted.length !== athletes.length ? ` (filtered from ${athletes.length})` : ''}</span>
        </div>
      </div>

      {shown.length ? (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table athletes-table">
              <thead>
                <tr>
                  {COLUMNS.map((item) => (
                    <th key={item.key} className={item.numeric ? 'numeric' : ''} aria-sort={sort.key === item.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      {/* The arrow is drawn in CSS so it stays out of the header text used as labels on phones. */}
                      <button type="button" className={`sort-button ${sort.key === item.key ? `sorted sorted-${sort.direction}` : ''}`} onClick={() => toggleSort(item.key)}>
                        {item.label}
                      </button>
                    </th>
                  ))}
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((athlete) => (
                  <tr key={athlete.athleteId} className={eligibilityOf(athlete) === 'RESTRICTED' ? 'row-restricted' : ''}>
                    <td>
                      <span className="name-cell">
                        <Avatar firstName={athlete.firstName} lastName={athlete.lastName} size="sm" />
                        <button className="link-button" type="button" onClick={() => onViewProfile(athlete)}>{fullName(athlete)}</button>
                      </span>
                    </td>
                    <td>{athlete.studentNumber || <span className="muted">Pending</span>}</td>
                    <td>{teamsOf(athlete).length ? <><span>{teamsOf(athlete).join(', ')}</span><br /><small className="muted">{sportsOf(athlete).join(' / ')}</small></> : <span className="muted">No active team</span>}</td>
                    <td>{athlete.course || '—'}{athlete.yearLevel ? <><br /><small className="muted">Year {athlete.yearLevel}</small></> : null}</td>
                    <td><EligibilityBadge status={athlete.eligibilityStatus} reasons={athlete.eligibilityReasons} showReasons /></td>
                    <td className="numeric">{athlete.attendanceRate == null ? <span className="muted">—</span> : <span className={athlete.attendanceRate < 60 ? 'text-danger' : ''}>{athlete.attendanceRate}%</span>}</td>
                    <td><StatusBadge status={accountOf(athlete)} /></td>
                    <td className="table-action"><button className="btn btn-ghost btn-sm" type="button" onClick={() => onViewProfile(athlete)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Pages">
            <label className="page-size">
              <span>Rows per page</span>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <span className="page-status">Page {currentPage} of {pageCount}</span>
            <div className="page-buttons">
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPage(1)} disabled={currentPage === 1} aria-label="First page">«</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount}>Next</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPage(pageCount)} disabled={currentPage === pageCount} aria-label="Last page">»</button>
            </div>
          </nav>
        </div>
      ) : (
        <EmptyState
          title={athletes.length ? 'No athletes match' : 'No athletes yet'}
          message={athletes.length ? 'Try a different search or clear the filters.' : 'Athletes appear here once they are assigned to a team.'}
          action={filtersOn ? <button className="btn btn-secondary btn-sm" type="button" onClick={clearFilters}>Clear filters</button> : undefined}
        />
      )}
    </>
  )
}
