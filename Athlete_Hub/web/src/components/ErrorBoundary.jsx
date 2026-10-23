import { Component } from 'react'

/** Shows a friendly message instead of a blank page when a section crashes. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Athlete-Hub section crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="empty-state error-state">
        <strong>Something went wrong</strong>
        <p>This part of the page could not be shown. Select “Try again”, or reload the page if it keeps happening.</p>
        {import.meta.env.DEV && <pre className="error-detail">{this.state.error.message}</pre>}
        <button className="btn btn-primary" type="button" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    )
  }
}

/** Falls back to a data table if Chart.js fails to render. */
export class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Chart failed to render:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const { data } = this.props
    if (!data?.labels?.length) return <p className="muted">The chart cannot be shown right now.</p>
    return (
      <div className="table-wrap">
        <p className="muted">The chart cannot be shown, so here are the numbers instead.</p>
        <table className="table">
          <thead><tr><th>Session</th>{data.datasets?.map((dataset) => <th key={dataset.label}>{dataset.label}</th>)}</tr></thead>
          <tbody>
            {data.labels.map((label, index) => (
              <tr key={`${label}-${index}`}>
                <td>{label}</td>
                {data.datasets?.map((dataset) => <td key={dataset.label}>{dataset.data[index] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}
