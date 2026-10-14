import { useMemo, useState } from 'react'
import ModulePage from '../components/ModulePage'
import {
  assignRandomTask,
  getTaskById,
  listStudentAssignments,
  type StudentAssignment,
  type StudentTask,
} from '../services/taskAssignments'

type AssignmentCardProps = {
  assignment: StudentAssignment
  task?: StudentTask
}

function AssignmentCard({ assignment, task }: AssignmentCardProps) {
  return (
    <article className="assignment-card">
      <h3>
        {assignment.name} ({assignment.usn})
      </h3>
      <p>
        <strong>Assigned Task:</strong> {task?.id ?? assignment.taskId} - {task?.title ?? 'Task unavailable'}
      </p>
      <p>
        <strong>Type:</strong> {task?.type ?? 'unknown'}
      </p>
      <p>
        <strong>Details:</strong> {task?.details ?? 'No task details found.'}
      </p>
    </article>
  )
}

export default function TaskAssignmentPage() {
  const [name, setName] = useState('')
  const [usn, setUsn] = useState('')
  const [message, setMessage] = useState('Enter Name and USN to get a random assignment.')
  const [latestAssignment, setLatestAssignment] = useState<StudentAssignment | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const assignments = useMemo(() => listStudentAssignments(), [refreshKey])

  const handleAssign = () => {
    if (!name.trim() || !usn.trim()) {
      setMessage('Both Name and USN are required.')
      return
    }

    const result = assignRandomTask(name, usn)
    setLatestAssignment(result.assignment)

    if (result.status === 'duplicate') {
      setMessage('This USN already has an assigned task. Existing task is shown below.')
    } else {
      setMessage('Task assigned successfully. Share this task card with your mentor and create a feature branch.')
    }

    setRefreshKey((prev) => prev + 1)
  }

  return (
    <ModulePage
      title="Open Student Task Assignment"
      purpose="No-auth assignment portal: enter Name and USN, avoid duplicate registrations, and get a random task with full details."
      status="available"
      nextActionLabel="View Dashboard Assignment Board"
      nextActionTo="/dashboard"
    >
      <section className="card assignment-page-grid">
        <div>
          <h2>Assign Task</h2>
          <p>Each USN can be assigned only once. Duplicate USN submissions return the original task.</p>
          <div className="assignment-form">
            <label>
              Name
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Student full name" />
            </label>
            <label>
              USN
              <input type="text" value={usn} onChange={(event) => setUsn(event.target.value)} placeholder="USN (unique)" />
            </label>
            <button type="button" className="button-link" onClick={handleAssign}>
              Assign Random Task
            </button>
          </div>
          <p>{message}</p>
        </div>

        <div>
          <h2>Latest Assignment</h2>
          {latestAssignment ? (
            <AssignmentCard assignment={latestAssignment} task={getTaskById(latestAssignment.taskId)} />
          ) : (
            <p>No assignment created in this session yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>All Assigned Students</h2>
        {assignments.length === 0 ? (
          <p>No student has been assigned yet.</p>
        ) : (
          <div className="assignment-list">
            {assignments.map((assignment) => (
              <AssignmentCard key={assignment.usn} assignment={assignment} task={getTaskById(assignment.taskId)} />
            ))}
          </div>
        )}
      </section>
    </ModulePage>
  )
}
