import { useEffect, useMemo, useState } from 'react'
import ModulePage from '../components/ModulePage'
import {
  assignRandomTask,
  exportAssignmentsCsv,
  getAssignmentMode,
  getTaskById,
  getTaskOptions,
  listStudentAssignments,
  reassignTaskByUsn,
  setAssignmentMode,
  type AssignmentMode,
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
      <p>
        <strong>Assigned At:</strong> {new Date(assignment.assignedAt).toLocaleString()}
      </p>
    </article>
  )
}

export default function TaskAssignmentPage() {
  const [name, setName] = useState('')
  const [usn, setUsn] = useState('')
  const [message, setMessage] = useState('Enter Name and USN to get a random assignment.')
  const [mentorMessage, setMentorMessage] = useState('')
  const [latestAssignment, setLatestAssignment] = useState<StudentAssignment | null>(null)
  const [assignmentMode, setAssignmentModeState] = useState<AssignmentMode>('self-assign')
  const [selectedUsnForReassign, setSelectedUsnForReassign] = useState('')
  const [selectedTaskForReassign, setSelectedTaskForReassign] = useState('S01')
  const [assignments, setAssignments] = useState<StudentAssignment[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(true)

  const taskOptions = useMemo(() => getTaskOptions(), [])

  const refreshFromServer = async () => {
    const [mode, rows] = await Promise.all([getAssignmentMode(), listStudentAssignments()])
    setAssignmentModeState(mode)
    setAssignments(rows)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await refreshFromServer()
      } finally {
        if (mounted) {
          setLoadingAssignments(false)
        }
      }
    })()

    const intervalId = window.setInterval(() => {
      void refreshFromServer()
    }, 3000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!selectedUsnForReassign && assignments.length > 0) {
      setSelectedUsnForReassign(assignments[0].usn)
    }
  }, [assignments, selectedUsnForReassign])

  const handleAssign = async () => {
    if (assignmentMode === 'mentor-only') {
      setMessage('Self-assignment is locked. Ask mentor to assign or reassign tasks using mentor controls.')
      return
    }

    if (!name.trim() || !usn.trim()) {
      setMessage('Both Name and USN are required.')
      return
    }

    const result = await assignRandomTask(name, usn)
    setLatestAssignment(result.assignment)

    if (result.status === 'duplicate') {
      setMessage('This USN already has an assigned task. Existing task is shown below.')
    } else {
      setMessage('Task assigned successfully. Share this task card with your mentor and create a feature branch.')
    }

    await refreshFromServer()
  }

  const handleToggleMode = async () => {
    const nextMode: AssignmentMode = assignmentMode === 'self-assign' ? 'mentor-only' : 'self-assign'
    const mode = await setAssignmentMode(nextMode)
    setAssignmentModeState(mode)
    setMentorMessage(`Assignment mode switched to ${mode}.`)
  }

  const handleReassign = async () => {
    if (!selectedUsnForReassign) {
      setMentorMessage('Select a student USN to reassign.')
      return
    }

    const result = await reassignTaskByUsn(selectedUsnForReassign, selectedTaskForReassign)
    if (result.status === 'not-found') {
      setMentorMessage('Selected USN was not found in assignment records.')
      return
    }
    if (result.status === 'invalid-task') {
      setMentorMessage('Selected task is invalid.')
      return
    }

    setLatestAssignment(result.assignment)
    setMentorMessage(`Reassigned ${result.assignment.usn} to ${result.assignment.taskId}.`)
    await refreshFromServer()
  }

  const handleExportCsv = () => {
    const csv = exportAssignmentsCsv(assignments)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'student-task-assignments.csv'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setMentorMessage('Assignment board exported to CSV.')
  }

  return (
    <ModulePage
      title="Open Student Task Assignment"
      purpose="No-auth assignment portal: enter Name and USN, avoid duplicate registrations, and get a random task with full details."
      status="available"
      nextActionLabel="View Dashboard Assignment Board"
      nextActionTo="/dashboard"
    >
      <section className="card mentor-controls">
        <div>
          <h2>Mentor Controls</h2>
          <p>
            Current assignment mode: <strong>{assignmentMode}</strong>
          </p>
          <div className="mentor-actions">
            <button type="button" className="button-link secondary" onClick={handleToggleMode}>
              {assignmentMode === 'self-assign' ? 'Lock to Mentor-only' : 'Unlock Self-assign'}
            </button>
            <button type="button" className="button-link secondary" onClick={handleExportCsv}>
              Export Assignment Board CSV
            </button>
          </div>
        </div>

        <div className="mentor-reassign">
          <h3>Manual Reassign</h3>
          <label>
            Student USN
            <select
              value={selectedUsnForReassign}
              onChange={(event) => setSelectedUsnForReassign(event.target.value)}
              disabled={assignments.length === 0}
            >
              {assignments.map((assignment) => (
                <option key={assignment.usn} value={assignment.usn}>
                  {assignment.usn} - {assignment.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New Task
            <select value={selectedTaskForReassign} onChange={(event) => setSelectedTaskForReassign(event.target.value)}>
              {taskOptions.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button-link secondary" onClick={handleReassign} disabled={assignments.length === 0}>
            Reassign Selected Student
          </button>
          {mentorMessage && <p>{mentorMessage}</p>}
        </div>
      </section>

      <section className="card assignment-page-grid">
        <div>
          <h2>Assign Task</h2>
          <p>Each USN can be assigned only once. Duplicate USN submissions return the original task.</p>
          <div className="assignment-form">
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Student full name"
                disabled={assignmentMode === 'mentor-only'}
              />
            </label>
            <label>
              USN
              <input
                type="text"
                value={usn}
                onChange={(event) => setUsn(event.target.value)}
                placeholder="USN (unique)"
                disabled={assignmentMode === 'mentor-only'}
              />
            </label>
            <button type="button" className="button-link" onClick={handleAssign} disabled={assignmentMode === 'mentor-only'}>
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
        {loadingAssignments ? (
          <p>Loading assignments...</p>
        ) : assignments.length === 0 ? (
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
