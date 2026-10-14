import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { clearAdminToken, getAdminSession, getAdminToken } from '../services/adminAuth'
import { getLastStudentUsn, getStudentTaskSnapshot, saveLastStudentUsn, saveStudentTaskSnapshot } from '../services/studentState'
import {
  assignRandomTask,
  changeStudentPassword,
  exportAssignmentsCsv,
  getAssignmentMode,
  getTaskById,
  getTaskOptions,
  listStudentAssignments,
  loginStudentByUsn,
  recoverStudentAssignment,
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
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [studentLoginUsn, setStudentLoginUsn] = useState(getLastStudentUsn())
  const [studentLoginPassword, setStudentLoginPassword] = useState('')
  const [studentLoggedInUsn, setStudentLoggedInUsn] = useState('')
  const [studentRecoveryTask, setStudentRecoveryTask] = useState('S01')
  const [cachedRecoveredTask, setCachedRecoveredTask] = useState('')
  const [studentLoginMessage, setStudentLoginMessage] = useState('Login with your student credentials to verify/recover your assignment.')
  const [showRecoveryChooser, setShowRecoveryChooser] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [studentProfileName, setStudentProfileName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

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
    let mounted = true
    const validateAdminSession = async () => {
      if (!getAdminToken()) {
        if (mounted) {
          setIsAdminAuthenticated(false)
        }
        return
      }
      try {
        const session = await getAdminSession()
        if (mounted) {
          setIsAdminAuthenticated(session.isAdmin)
        }
      } catch {
        clearAdminToken()
        if (mounted) {
          setIsAdminAuthenticated(false)
        }
      }
    }
    void validateAdminSession()
    return () => {
      mounted = false
    }
  }, [])

  const handleAdminError = (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAdminToken()
      setIsAdminAuthenticated(false)
      setMentorMessage('Admin login required. Please log in again.')
      return
    }
    throw error
  }

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
    saveLastStudentUsn(result.assignment.usn)
    saveStudentTaskSnapshot(result.assignment.usn, result.assignment.taskId)
    setLatestAssignment(result.assignment)

    if (result.status === 'duplicate') {
      setMessage('This USN already has an assigned task. Existing task is shown below.')
    } else {
      setMessage('Task assigned successfully. Share this task card with your mentor and create a feature branch.')
    }

    await refreshFromServer()
  }

  const handleToggleMode = async () => {
    if (!isAdminAuthenticated) {
      setMentorMessage('Admin login required to change assignment mode.')
      return
    }
    const nextMode: AssignmentMode = assignmentMode === 'self-assign' ? 'mentor-only' : 'self-assign'
    try {
      const mode = await setAssignmentMode(nextMode)
      setAssignmentModeState(mode)
      setMentorMessage(`Assignment mode switched to ${mode}.`)
    } catch (error) {
      handleAdminError(error)
    }
  }

  const handleReassign = async () => {
    if (!isAdminAuthenticated) {
      setMentorMessage('Admin login required to reassign tasks.')
      return
    }
    if (!selectedUsnForReassign) {
      setMentorMessage('Select a student USN to reassign.')
      return
    }

    let result:
      | { status: 'updated'; assignment: StudentAssignment }
      | { status: 'not-found' }
      | { status: 'invalid-task' }
    try {
      result = await reassignTaskByUsn(selectedUsnForReassign, selectedTaskForReassign)
    } catch (error) {
      handleAdminError(error)
      return
    }
    if (result.status === 'not-found') {
      setMentorMessage('Selected USN was not found in assignment records.')
      return
    }
    if (result.status === 'invalid-task') {
      setMentorMessage('Selected task is invalid.')
      return
    }

    setLatestAssignment(result.assignment)
    saveLastStudentUsn(result.assignment.usn)
    saveStudentTaskSnapshot(result.assignment.usn, result.assignment.taskId)
    setMentorMessage(`Reassigned ${result.assignment.usn} to ${result.assignment.taskId}.`)
    await refreshFromServer()
  }

  const handleStudentLogin = async () => {
    if (!studentLoginUsn.trim() || !studentLoginPassword.trim()) {
      setStudentLoginMessage('USN is required in both username and password fields.')
      return
    }

    const cachedTask = getStudentTaskSnapshot(studentLoginUsn)
    try {
      const result = await loginStudentByUsn(studentLoginUsn, studentLoginPassword, cachedTask)
      setStudentLoggedInUsn(result.usn)
      saveLastStudentUsn(result.usn)
      setCachedRecoveredTask(result.recoveredTaskId ?? cachedTask)
      setMustChangePassword(result.mustChangePassword)
      setStudentProfileName(result.profileName ?? '')
      if (result.assignmentFound && result.assignment) {
        setLatestAssignment(result.assignment)
        saveStudentTaskSnapshot(result.assignment.usn, result.assignment.taskId)
        setShowRecoveryChooser(false)
        setStudentLoginMessage(
          result.mustChangePassword
            ? `Login successful. Existing assignment found: ${result.assignment.taskId}. Please change your password now.`
            : `Login successful. Existing assignment found: ${result.assignment.taskId}.`,
        )
        return
      }

      const fallbackTask = result.recoveredTaskId ?? cachedTask
      setStudentRecoveryTask(fallbackTask || 'S01')
      setShowRecoveryChooser(true)
      setStudentLoginMessage(result.message)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setStudentLoginMessage('Invalid login credentials.')
        return
      }
      setStudentLoginMessage('Login failed. Please try again.')
    }
  }

  const handleChangePassword = async () => {
    if (!studentLoggedInUsn) {
      setStudentLoginMessage('Login first before changing password.')
      return
    }
    if (newPassword.trim().length < 6) {
      setStudentLoginMessage('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setStudentLoginMessage('New password and confirm password do not match.')
      return
    }

    try {
      await changeStudentPassword(studentLoggedInUsn, studentLoginPassword, newPassword)
      setStudentLoginPassword(newPassword)
      setNewPassword('')
      setConfirmNewPassword('')
      setMustChangePassword(false)
      setStudentLoginMessage('Password updated successfully. You can continue with your profile.')
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setStudentLoginMessage('Current password is invalid. Login again and retry.')
        return
      }
      setStudentLoginMessage('Password change failed. Please try again.')
    }
  }

  const handleStudentRecovery = async () => {
    if (!studentLoggedInUsn) {
      setStudentLoginMessage('Login first before recovering assignment.')
      return
    }

    try {
      const result = await recoverStudentAssignment(
        studentLoggedInUsn,
        studentLoginPassword,
        studentRecoveryTask,
        name || undefined,
        cachedRecoveredTask || undefined,
      )
      setLatestAssignment(result.assignment)
      saveLastStudentUsn(result.assignment.usn)
      saveStudentTaskSnapshot(result.assignment.usn, result.assignment.taskId)
      setShowRecoveryChooser(false)
      setStudentLoginMessage(
        result.matchedCachedTask
          ? `Recovered successfully. Selected task ${result.assignment.taskId} matches your cached assignment.`
          : `Recovered successfully with task ${result.assignment.taskId}.`,
      )
      await refreshFromServer()
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        setStudentLoginMessage('Invalid task selection. Choose a valid task.')
        return
      }
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setStudentLoginMessage('Student authentication failed. Check your credentials and retry.')
        return
      }
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        setStudentLoginMessage('Task is locked by admin. You cannot change it from student portal.')
        return
      }
      setStudentLoginMessage('Could not recover assignment right now.')
    }
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
      {isAdminAuthenticated ? (
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
      ) : (
        <section className="card">
          <h2>Admin Work</h2>
          <p>Admin-only assignment controls are available in the admin portal.</p>
          <p>
            Login as admin from <Link to="/login">Common Login</Link> and open Admin Dashboard for management actions.
          </p>
        </section>
      )}

      <section className="card assignment-page-grid">
        <div>
          <h2>Student Login & Recovery</h2>
          <p>If old records are missing, login first and recover your assigned task from cache/history.</p>
          <div className="assignment-form">
            <label>
              Username (USN)
              <input
                type="text"
                value={studentLoginUsn}
                onChange={(event) => setStudentLoginUsn(event.target.value)}
                placeholder="USN"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={studentLoginPassword}
                onChange={(event) => setStudentLoginPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </label>
            <button type="button" className="button-link secondary" onClick={handleStudentLogin}>
              Login Student
            </button>
          </div>
          {studentLoginMessage && <p>{studentLoginMessage}</p>}
          {studentLoggedInUsn && (
            <div className="task-recovery-wrap">
              <h3>Student Profile</h3>
              <p>
                Logged in as <strong>{studentLoggedInUsn}</strong>
                {studentProfileName ? ` (${studentProfileName})` : ''}
              </p>
              <p>
                Password status:{' '}
                <strong>{mustChangePassword ? 'First-time login. Change required.' : 'Configured'}</strong>
              </p>
              <div className="assignment-form">
                <label>
                  New Password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 6 characters"
                  />
                </label>
                <label>
                  Confirm New Password
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="Repeat new password"
                  />
                </label>
                <button type="button" className="button-link secondary" onClick={handleChangePassword}>
                  Change Password
                </button>
              </div>
            </div>
          )}
          {showRecoveryChooser && (
            <div className="task-recovery-wrap">
              <h3>Select Your Previously Assigned Problem Statement</h3>
              {cachedRecoveredTask && (
                <p>
                  Recovered from local cache: <strong>{cachedRecoveredTask}</strong>. This option is highlighted and other tasks are locked.
                </p>
              )}
              <div className="task-recovery-grid">
                {taskOptions.map((task) => {
                  const isRecovered = !!cachedRecoveredTask && task.id === cachedRecoveredTask
                  const shouldDisable = !!cachedRecoveredTask && !isRecovered
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={`task-recovery-button ${isRecovered ? 'recovered' : ''}`}
                      disabled={shouldDisable}
                      onClick={() => setStudentRecoveryTask(task.id)}
                    >
                      {task.label}
                    </button>
                  )
                })}
              </div>
              <p>
                Selected task: <strong>{studentRecoveryTask}</strong>
              </p>
              <button type="button" className="button-link" onClick={handleStudentRecovery}>
                Confirm and Recover in DB
              </button>
            </div>
          )}
        </div>

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

      {isAdminAuthenticated && (
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
      )}
    </ModulePage>
  )
}
