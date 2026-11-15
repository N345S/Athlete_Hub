import { useState } from 'react'

// How many rows a dashboard card previews before its "See all" link opens the full list.
export const PREVIEW_ROWS = 3

/**
 * A long list shown a page at a time: the first `initial` items, then `step` more each time "See more" is pressed,
 * and "Show fewer" once everything is open. Returns the items to render and the button to put under them.
 */
export function useSeeMore(items, initial = 5, step = initial) {
  const [count, setCount] = useState(initial)
  const shown = items.slice(0, count)
  const remaining = items.length - shown.length
  let button = null
  if (remaining > 0) {
    button = (
      <button className="btn btn-ghost btn-sm see-more" type="button" onClick={() => setCount((current) => current + step)}>
        See more <span className="muted">({remaining} more)</span>
      </button>
    )
  } else if (items.length > initial) {
    button = <button className="btn btn-ghost btn-sm see-more" type="button" onClick={() => setCount(initial)}>Show fewer</button>
  }
  return [shown, button]
}
