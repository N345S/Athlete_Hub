import PerformanceOverview from '../../components/PerformanceOverview.jsx'
import { Loading, PageHeader } from '../../components/ui.jsx'
import { usePerformanceData } from '../../lib/hooks.js'

/** The athlete's own performance: every training session's results compared with the previous one. */
export default function MyPerformancePage({ session, profile }) {
  const data = usePerformanceData(profile?.athleteId, session.token)
  if (!profile) return <Loading label="Loading your performance…" />

  return (
    <>
      <PageHeader title="My performance" subtitle="Your results from each training session, recorded by your coach" />
      <PerformanceOverview
        data={data}
        viewer="athlete"
        emptyMessage="After an approved training session ends, your coach records your results here. Check back after your next session."
      />
    </>
  )
}
