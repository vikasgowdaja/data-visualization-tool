import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { fetchRecentDatasets } from '../services/datasets'
import { fetchProgressSummary, listSessions } from '../services/platform'
import { getLastDatasetTitle, getLastModule } from '../services/studentState'
import { getTaskById, listStudentAssignments } from '../services/taskAssignments'

function humanizeModule(pathname: string | null): string {
  if (!pathname) {
    return 'No activity yet'
  }
  const cleaned = pathname.replace(/^\//, '')
  if (!cleaned) {
    return 'Home'
  }
  return cleaned
    .split('-')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

export default function DashboardPage() {
  const lastDataset = getLastDatasetTitle()
  const lastModule = humanizeModule(getLastModule())
  const [assignmentsVersion, setAssignmentsVersion] = useState(0)
  const assignments = useMemo(() => listStudentAssignments(), [assignmentsVersion])

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && !event.key.startsWith('dslab:')) {
        return
      }
      setAssignmentsVersion((prev) => prev + 1)
    }

    const intervalId = window.setInterval(() => {
      setAssignmentsVersion((prev) => prev + 1)
    }, 3000)

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])
  const recentDatasetsQuery = useQuery({
    queryKey: ['recent-datasets', 'dashboard'],
    queryFn: () => fetchRecentDatasets(6),
  })
  const progressQuery = useQuery({
    queryKey: ['progress-summary', 'dashboard'],
    queryFn: fetchProgressSummary,
  })
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'dashboard'],
    queryFn: () => listSessions(20),
  })

  return (
    <ModulePage
      title="Dashboard"
      purpose="Continue your real learning flow using current dataset and recent activity state."
      status="in-progress"
      nextActionLabel="Continue in Data Explorer"
      nextActionTo="/data-explorer"
    >
      <section className="card dashboard-grid">
        <div>
          <h2>Continue Learning</h2>
          <p>Current dataset: {lastDataset}</p>
          <p>Current learning activity: {lastModule}</p>
          <p>Progress tracking now combines local activity signals, persisted sessions, and logged module events.</p>
          <p>Total progress events: {progressQuery.data?.total_events ?? 0}</p>
          <p>Saved sessions: {sessionsQuery.data?.length ?? 0}</p>
          <div className="dashboard-recent">
            <h3>Recent datasets</h3>
            {recentDatasetsQuery.isLoading && <p>Loading recent dataset history...</p>}
            {recentDatasetsQuery.isError && <p>Could not load recent datasets right now.</p>}
            {!recentDatasetsQuery.isLoading && !recentDatasetsQuery.isError && recentDatasetsQuery.data?.length === 0 && (
              <p>No generated datasets yet. Create your first one in Data Explorer.</p>
            )}
            {recentDatasetsQuery.data && recentDatasetsQuery.data.length > 0 && (
              <ul className="simple-list">
                {recentDatasetsQuery.data.map((item) => (
                  <li key={item.dataset_id}>
                    {item.dataset_name} | {item.rows_count} rows | {item.columns_count} cols | {item.difficulty}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="quick-actions">
          <Link className="button-link" to="/data-explorer">
            Explore Dataset
          </Link>
          <Link className="button-link secondary" to="/visualization-lab">
            Create Visualization
          </Link>
          <Link className="button-link secondary" to="/practice">
            Practice Questions
          </Link>
          <Link className="button-link secondary" to="/challenges">
            Start Challenge
          </Link>
          <Link className="button-link secondary" to="/task-assignment">
            Open Task Assignment
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Student Assignment Board</h2>
        <p>Live reference list for all assigned students and their random tasks.</p>
        {assignments.length === 0 ? (
          <p>No assignments yet. Use Task Assignment page to register students.</p>
        ) : (
          <ul className="simple-list">
            {assignments.map((assignment) => {
              const task = getTaskById(assignment.taskId)
              return (
                <li key={assignment.usn}>
                  {assignment.name} ({assignment.usn}) {'->'} {task?.id ?? assignment.taskId}: {task?.title ?? 'Task unavailable'}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </ModulePage>
  )
}
