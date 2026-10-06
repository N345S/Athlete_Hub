import { useState } from 'react'
import { openProtectedFile } from '../lib/api.js'

/** Opens a sign-in protected file in a new tab. */
export default function FileLink({ url, token, children, className = 'link-button' }) {
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)

  const open = async () => {
    setError('')
    setOpening(true)
    try {
      await openProtectedFile(url, token)
    } catch (err) {
      setError(err.message)
    } finally {
      setOpening(false)
    }
  }

  return (
    <span className="file-link">
      <button type="button" className={className} onClick={open} disabled={opening}>{opening ? 'Opening…' : children}</button>
      {error && <small className="text-danger">{error}</small>}
    </span>
  )
}
