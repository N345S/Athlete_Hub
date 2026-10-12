import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'

/**
 * Keeps the current page in the URL hash (#/schedule) so refresh and the browser
 * Back button work. Unknown values fall back to the default view.
 */
export function useHashView(defaultView, validViews) {
  const read = useCallback(() => {
    const value = window.location.hash.replace(/^#\/?/, '')
    return validViews.includes(value) ? value : defaultView
  }, [defaultView, validViews])

  const [view, setViewState] = useState(read)

  useEffect(() => {
    const onChange = () => setViewState(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [read])

  const setView = useCallback((next) => {
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`
    setViewState(next)
    window.scrollTo({ top: 0 })
  }, [])

  return [view, setView]
}

/**
 * Loads JSON from an endpoint whenever it (or the token) changes. Pass a null endpoint to skip.
 * `reload` refetches without clearing what is currently shown.
 */
export function useApiData(endpoint, token, { initialData = null } = {}) {
  const [version, setVersion] = useState(0)
  const requestKey = endpoint ? `${endpoint}|${token}|${version}` : null
  // `key` records which request produced the stored result; loading is derived from it.
  const [state, setState] = useState({ key: null, data: initialData, error: '' })
  const initialRef = useRef(initialData)

  useEffect(() => {
    if (!endpoint) return undefined
    let cancelled = false
    api.get(endpoint, token)
      .then((data) => { if (!cancelled) setState({ key: requestKey, data, error: '' }) })
      .catch((error) => { if (!cancelled) setState({ key: requestKey, data: initialRef.current, error: error.message }) })
    return () => { cancelled = true }
  }, [endpoint, token, requestKey])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  const setData = useCallback((update) => setState((current) => ({
    ...current,
    data: typeof update === 'function' ? update(current.data) : update,
  })), [])

  return {
    data: state.data,
    error: state.key === requestKey ? state.error : '',
    loading: Boolean(requestKey) && state.key !== requestKey,
    reload,
    setData,
  }
}

/**
 * Loads an athlete's records and chart data. The page that owns it can call `reload` after
 * recording a new result, and reuse `records` (e.g. for the coach's saved-workout suggestions).
 */
export function usePerformanceData(athleteId, token) {
  const [range, setRange] = useState('overall')
  const records = useApiData(athleteId ? `/api/Performance/athlete/${athleteId}` : null, token)
  const trend = useApiData(athleteId ? `/api/Performance/athlete/${athleteId}/trend?timeRange=${range}` : null, token)
  const { reload: reloadRecords } = records
  const { reload: reloadTrend } = trend
  const reload = useCallback(() => { reloadRecords(); reloadTrend() }, [reloadRecords, reloadTrend])
  return { records, trend, range, setRange, reload }
}

/**
 * State for a detail screen (an athlete profile, an evaluation review) opened from one page. It belongs
 * to that page, so moving to any other page closes it — including the phone's back gesture or the
 * browser Back button, which change the page without going through the menu.
 * `open(value, forView)` names the page when the detail is opened together with a page change.
 */
export function usePageDetail(view) {
  const [detail, setDetail] = useState(null)
  // Left the page: forget the detail so coming back later shows the page itself, not a stale profile.
  if (detail && detail.view !== view) setDetail(null)
  const value = detail && detail.view === view ? detail.value : null
  const open = useCallback((next, forView) => setDetail(next == null ? null : { view: forView || view, value: next }), [view])
  return [value, open]
}

/** Polls the signed-in user's unread notification count. */
export function useUnreadNotifications(token) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    api.get('/api/Notifications/me/unread-count', token)
      .then((result) => setCount(result?.count || 0))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 60_000)
    return () => clearInterval(timer)
  }, [refresh])

  return [count, refresh]
}
