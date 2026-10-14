import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { fetchRecentDatasets } from '../services/datasets'
import { fetchProgressSummary, listSessions } from '../services/platform'
import { getLastDatasetTitle, getLastModule, getLastStudentUsn, saveLastStudentUsn } from '../services/studentState'
import { getTaskById, listStudentAssignments } from '../services/taskAssignments'
import { fetchStudents } from '../services/students'

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
  const [myUsnInput, setMyUsnInput] = useState(getLastStudentUsn())
  const assignmentsQuery = useQuery({
    queryKey: ['student-assignments', 'dashboard'],
    queryFn: listStudentAssignments,
    refetchInterval: 3000,
  })
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
  const studentsQuery = useQuery({
    queryKey: ['students', 'dashboard'],
    queryFn: fetchStudents,
    refetchInterval: 3000,
  })

  const myStudentRecord = useMemo(() => {
    const usn = myUsnInput.trim().toUpperCase()
    if (!usn || !studentsQuery.data) {
      return null
    }
    return studentsQuery.data.find((item) => item.usn === usn) ?? null
  }, [myUsnInput, studentsQuery.data])

  const handleSaveMyUsn = () => {
    if (!myUsnInput.trim()) {
      return
    }
    const normalized = myUsnInput.trim().toUpperCase()
    setMyUsnInput(normalized)
    saveLastStudentUsn(normalized)
  }

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
        {assignmentsQuery.isLoading && <p>Loading assignments...</p>}
        {assignmentsQuery.isError && <p>Could not load assignments right now.</p>}
        {!assignmentsQuery.isLoading && !assignmentsQuery.isError && (assignmentsQuery.data?.length ?? 0) === 0 ? (
          <p>No assignments yet. Use Task Assignment page to register students.</p>
        ) : (
          <ul className="simple-list">
            {(assignmentsQuery.data ?? []).map((assignment) => {
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

      <section className="card">
        <h2>Common Student Dashboard</h2>
        <p>Centralized MongoDB-backed student list visible to all users.</p>
        {studentsQuery.isLoading && <p>Loading students...</p>}
        {studentsQuery.isError && <p>Could not load student list right now.</p>}
        {!studentsQuery.isLoading && !studentsQuery.isError && (studentsQuery.data?.length ?? 0) === 0 && (
          <p>No student records yet. Assign tasks first, or seed from Python/SQLite records.</p>
        )}
        {!!studentsQuery.data?.length && (
          <ul className="simple-list">
            {studentsQuery.data.map((student) => {
              const task = getTaskById(student.task_id)
              return (
                <li key={student.usn}>
                  {student.name} ({student.usn}) {'->'} {task?.id ?? student.task_id}: {task?.title ?? 'Task unavailable'}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>My Student Record</h2>
        <p>Enter your USN to view only your own centralized record.</p>
        <div className="assignment-form">
          <label>
            USN
            <input
              type="text"
              value={myUsnInput}
              onChange={(event) => setMyUsnInput(event.target.value)}
              placeholder="Enter your USN"
            />
          </label>
          <button type="button" className="button-link secondary" onClick={handleSaveMyUsn}>
            Show My Record
          </button>
        </div>
        {myUsnInput.trim() && !myStudentRecord && !studentsQuery.isLoading && <p>No record found for this USN.</p>}
        {myStudentRecord && (
          <ul className="simple-list">
            <li>Name: {myStudentRecord.name}</li>
            <li>USN: {myStudentRecord.usn}</li>
            <li>Task ID: {myStudentRecord.task_id}</li>
            <li>Task Title: {getTaskById(myStudentRecord.task_id)?.title ?? 'Task unavailable'}</li>
            <li>Assigned At: {new Date(myStudentRecord.assigned_at).toLocaleString()}</li>
          </ul>
        )}
      </section>
    </ModulePage>
  )
}
