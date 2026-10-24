import { useState } from 'react'
import { api } from '../../lib/api.js'
import { roleName } from './roles.js'
import { Alert, EmptyState, Loading, Modal, StatusBadge, Tabs } from '../../components/ui.jsx'

const MAX_ROWS = 500

// The two kinds of file. `columns` is the header of the downloadable template, in order; `example` its sample rows.
const MODES = {
  accounts: {
    label: 'New accounts',
    endpoint: '/api/Accounts/import/accounts',
    template: 'athlete-hub-new-accounts.csv',
    intro: 'One row per person. Athletes can include their course, year level, birth date, and teams. Parents list their children’s University IDs; the children may be existing athletes or athletes in the same file. Leave the password blank to make one for them.',
    columns: ['role', 'first_name', 'middle_name', 'last_name', 'email', 'university_id', 'phone', 'password', 'course', 'year_level', 'birth_date', 'teams', 'children', 'relationship'],
    example: [
      ['Athlete', 'Juan', 'Santos', 'Dela Cruz', 'A26-36410@athlete.edu.ph', 'A26-36410', '0917 123 4567', '', 'BS Information Technology', '1', '2007-05-14', "Men's Varsity Basketball", '', ''],
      ['Athlete', 'Maria', '', 'Dela Cruz', 'A26-36411@athlete.edu.ph', 'A26-36411', '', '', 'BS Nursing', '1', '2007-05-14', "Women's Varsity Volleyball; Swimming Team", '', ''],
      ['Parent', 'Rosa', '', 'Dela Cruz', 'rosadelacruz@gmail.com', '', '0918 765 4321', '', '', '', '', '', 'A26-36410; A26-36411', 'Mother'],
      ['Coach', 'Carlo', '', 'Mercado', 'C26-21500@athlete.edu.ph', 'C26-21500', '', '', '', '', '', '', '', ''],
    ],
  },
  profiles: {
    label: 'Update athlete profiles',
    endpoint: '/api/Accounts/import/profiles',
    template: 'athlete-hub-athlete-profiles.csv',
    intro: 'One row per existing student-athlete, found by University ID. Blank cells keep what is saved. Teams listed are joined; the athlete stays on their other teams.',
    columns: ['university_id', 'course', 'year_level', 'birth_date', 'phone', 'teams'],
    example: [
      ['A24-31842', 'BS Information Technology', '4', '2004-09-02', '0917 555 0101', ''],
      ['A26-36302', '', '', '', '', 'Track and Field Team'],
    ],
  },
}

// Header spellings people use, mapped to the field the API expects.
const HEADER_ALIASES = {
  role: 'role', account_type: 'role', type: 'role',
  first_name: 'firstName', firstname: 'firstName', given_name: 'firstName',
  middle_name: 'middleName', middlename: 'middleName',
  last_name: 'lastName', lastname: 'lastName', surname: 'lastName', family_name: 'lastName',
  email: 'email', email_address: 'email',
  university_id: 'universityId', student_id: 'universityId', student_number: 'universityId', id_number: 'universityId', employee_id: 'universityId',
  phone: 'phone', phone_number: 'phone', mobile: 'phone', contact_number: 'phone',
  password: 'password',
  course: 'course', program: 'course', degree: 'course',
  year_level: 'yearLevel', year: 'yearLevel',
  birth_date: 'birthDate', birthdate: 'birthDate', birthday: 'birthDate', date_of_birth: 'birthDate',
  teams: 'teams', team: 'teams',
  children: 'children', child: 'children', child_university_ids: 'children', children_ids: 'children',
  relationship: 'relationship',
}

/** Splits CSV text into rows of cells: quoted cells may hold commas, quotes ("") and line breaks. */
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const csvCell = (value) => /[",\n\r]/.test(String(value ?? '')) ? `"${String(value).replace(/"/g, '""')}"` : String(value ?? '')

function downloadCsv(filename, rows) {
  const blob = new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Reads the file into API rows ({ line, ...fields }), or throws a message about what is wrong with it. */
function readRows(text) {
  const [header = [], ...body] = parseCsv(text)
  const fields = header.map((name) => HEADER_ALIASES[name.trim().toLowerCase().replace(/[\s-]+/g, '_')])
  if (!fields.some(Boolean)) throw new Error('The first row must be the column names. Download the template to see them.')
  const rows = body
    .map((cells, index) => ({ cells, line: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim()))
    .map(({ cells, line }) => Object.fromEntries([['line', line], ...fields.flatMap((field, column) => field ? [[field, cells[column]?.trim() || null]] : [])]))
  if (!rows.length) throw new Error('The file has no rows under the column names.')
  if (rows.length > MAX_ROWS) throw new Error(`The file has ${rows.length} rows. Please upload at most ${MAX_ROWS} at a time.`)
  return rows
}

const STATUS = {
  READY: { status: 'APPROVED', label: 'Ready' },
  CREATED: { status: 'APPROVED', label: 'Created' },
  UPDATED: { status: 'APPROVED', label: 'Updated' },
  UNCHANGED: { status: 'NONE', label: 'No changes' },
  ERROR: { status: 'REJECTED', label: 'Needs fixing' },
}

/**
 * Creates many accounts, or updates many athlete profiles, from one CSV file. The file is checked first and every
 * row's problems are listed; then the rows without problems are saved and the rest are skipped.
 */
export default function ImportAccountsModal({ session, onClose, onImported }) {
  const [mode, setMode] = useState('accounts')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState(null)
  const [result, setResult] = useState(null)
  // 'check' while the file is being checked, 'save' while the rows are saved.
  const [busy, setBusy] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const config = MODES[mode]
  const done = result && !result.dryRun
  const problems = result?.rows.filter((row) => row.status === 'ERROR').length || 0

  const reset = () => { setFileName(''); setRows(null); setResult(null); setError('') }
  const switchMode = (next) => { setMode(next); reset() }

  const check = async (file) => {
    if (!file) return
    reset()
    setFileName(file.name)
    if (!/\.csv$/i.test(file.name)) { setError('Please choose a .csv file. In Excel or Google Sheets, use File → Save as / Download → CSV.'); return }
    setBusy('check')
    try {
      const parsed = readRows(await file.text())
      setRows(parsed)
      setResult(await api.post(`${config.endpoint}?dryRun=true`, { rows: parsed }, session.token))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const save = async () => {
    setBusy('save')
    setError('')
    try {
      const saved = await api.post(`${config.endpoint}?dryRun=false`, { rows }, session.token)
      setResult(saved)
      onImported(mode === 'accounts' ? saved.created : saved.updated, mode)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const created = done ? result.rows.filter((row) => row.status === 'CREATED') : []
  const downloadSignIns = () => downloadCsv('athlete-hub-sign-in-details.csv', [
    ['name', 'role', 'email', 'university_id', 'temporary_password'],
    ...created.map((row) => [row.name, roleName(row.role), row.email, row.universityId || '', row.password || '(the one in your file)']),
  ])

  const footer = done ? <>
    {mode === 'accounts' && created.some((row) => row.password) && <button className="btn btn-secondary" type="button" onClick={downloadSignIns}>Download sign-in details</button>}
    <button className="btn btn-primary" type="button" onClick={onClose}>Done</button>
  </> : <>
    <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
    <button className="btn btn-primary" type="button" onClick={save} disabled={busy || !result?.ready}>
      {busy === 'save' ? 'Saving…' : mode === 'accounts' ? `Create ${result?.ready || 0} account${result?.ready === 1 ? '' : 's'}` : `Update ${result?.ready || 0} profile${result?.ready === 1 ? '' : 's'}`}
    </button>
  </>

  return (
    <Modal title="Import from a CSV file" subtitle="Check the file first; nothing is saved until you confirm." onClose={onClose} size="xl" closeOnBackdrop={false} footer={footer}>
      {!done && (
        <div className="import-intro">
          <Tabs label="What the file holds" value={mode} onChange={switchMode} options={Object.entries(MODES).map(([key, item]) => [key, item.label])} />
          <p className="muted">{config.intro} Put several teams or children in one cell with semicolons (A24-31842; A26-35219).</p>
          <div className="row-actions">
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => downloadCsv(config.template, [config.columns, ...config.example])}>Download template</button>
            <small className="muted">Columns: {config.columns.join(', ')}</small>
          </div>
          <label
            className={`drop-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); check(event.dataTransfer.files[0]) }}
          >
            <input type="file" accept=".csv,text/csv" onChange={(event) => { check(event.target.files[0]); event.target.value = '' }} />
            <strong>{fileName || 'Choose a CSV file or drop it here'}</strong>
            <span>{fileName ? 'Choose another file to check it again.' : `Up to ${MAX_ROWS} rows. The first row holds the column names.`}</span>
          </label>
        </div>
      )}

      <Alert>{error}</Alert>
      {busy === 'check' && <Loading label="Checking the file…" />}

      {result && <>
        {done
          ? <Alert tone="success">{mode === 'accounts'
            ? `${result.created} account${result.created === 1 ? ' was' : 's were'} created.${created.some((row) => row.password) ? ' Download the sign-in details now: the passwords made for them are only shown once.' : ''}`
            : `${result.updated} profile${result.updated === 1 ? ' was' : 's were'} updated.`}{problems > 0 && ` ${problems} row${problems === 1 ? ' was' : 's were'} skipped.`}</Alert>
          : <Alert tone={problems ? 'warning' : 'info'}>{problems
            ? `${problems} row${problems === 1 ? ' needs' : 's need'} fixing and will be skipped. Fix ${problems === 1 ? 'it' : 'them'} in the file and choose it again, or continue with the ${result.ready} ready row${result.ready === 1 ? '' : 's'}.`
            : `Every row is ready. Nothing is saved until you select ${mode === 'accounts' ? 'Create' : 'Update'}.`}</Alert>}
        {result.rows.length ? (
          <div className="table-wrap import-table">
            <table className="table">
              <thead>
                <tr><th className="numeric">Row</th>{mode === 'accounts' ? <><th>Person</th><th>Role</th></> : <th>Athlete</th>}<th>Status</th><th>Details</th></tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.line} className={row.status === 'ERROR' ? 'import-error' : ''}>
                    <td className="numeric">{row.line}</td>
                    <td><strong>{row.name || '—'}</strong><br /><small className="muted">{mode === 'accounts' ? row.email : row.universityId}</small></td>
                    {mode === 'accounts' && <td>{row.role ? roleName(row.role) : '—'}</td>}
                    <td><StatusBadge status={STATUS[row.status].status} label={STATUS[row.status].label} /></td>
                    <td>
                      {row.errors.length > 0 ? <ul className="import-messages">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul>
                        : mode === 'accounts' ? <small className="muted">
                          {[row.universityId, row.children?.length && `Children: ${row.children.join(', ')}`,
                            row.password ? `Password: ${row.password}` : row.passwordGenerated && 'A password will be made'].filter(Boolean).join(' · ')}
                        </small>
                          : <small className="muted">{row.changes.join(' · ') || 'Matches what is saved.'}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="users" title="No rows" message="The file has no rows to import." />}
      </>}
    </Modal>
  )
}
