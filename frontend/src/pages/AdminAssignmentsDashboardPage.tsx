import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { seedStudentsFromSqlite } from '../services/students'
import { fetchStudents } from '../services/students'
import {
  adminSetStudentTaskControl,
  adminResetStudentPassword,
  exportAssignmentsCsv,
  getAssignmentMode,
  getTaskById,
  listStudentAssignments,
  STUDENT_TASKS,
  type StudentTaskType,
} from '../services/taskAssignments'

type RowControlState = {
  taskId: string
  lockTask: boolean
}

export default function AdminAssignmentsDashboardPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | StudentTaskType>('all')
  const [taskFilter, setTaskFilter] = useState<'all' | string>('all')
  const [syncMessage, setSyncMessage] = useState('')
  const [resetUsn, setResetUsn] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [rowActionMessage, setRowActionMessage] = useState('')
  const [rowControls, setRowControls] = useState<Record<string, RowControlState>>({})
  const queryClient = useQueryClient()
  const assignmentsQuery = useQuery({
    queryKey: ['student-assignments', 'admin-dashboard'],
    queryFn: listStudentAssignments,
    refetchInterval: 3000,
  })
  const modeQuery = useQuery({
    queryKey: ['assignment-mode', 'admin-dashboard'],
    queryFn: getAssignmentMode,
    refetchInterval: 3000,
  })
  const studentsQuery = useQuery({
    queryKey: ['students', 'admin-dashboard'],
    queryFn: fetchStudents,
    refetchInterval: 3000,
  })
  const syncMutation = useMutation({
    mutationFn: seedStudentsFromSqlite,
    onSuccess: async (result) => {
      setSyncMessage(
        `Sync complete. Students synced: ${result.students_synced}, assignments synced: ${result.assignments_synced}.`,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student-assignments', 'admin-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-mode', 'admin-dashboard'] }),
      ])
    },
    onError: () => {
      setSyncMessage('Sync failed. Ensure admin session is valid and backend can access both databases.')
    },
  })
  const resetPasswordMutation = useMutation({
    mutationFn: adminResetStudentPassword,
    onSuccess: (result) => {
      setResetMessage(`Password reset to default for ${result.usn}. Student must login with USN/USN and change it.`)
      setResetUsn('')
    },
    onError: () => {
      setResetMessage('Could not reset password. Verify USN and admin session.')
    },
  })
  const taskControlMutation = useMutation({
    mutationFn: ({ usn, taskId, lockTask }: { usn: string; taskId: string; lockTask: boolean }) =>
      adminSetStudentTaskControl(usn, taskId, lockTask),
    onSuccess: async (result) => {
      setRowActionMessage(
        `Updated ${result.usn}: task ${result.taskId} (${result.taskLocked ? 'locked' : 'unlocked'}).`,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student-assignments', 'admin-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['students', 'admin-dashboard'] }),
      ])
    },
    onError: () => {
      setRowActionMessage('Could not update task control for this student.')
    },
  })

  const assignmentMode = modeQuery.data ?? 'self-assign'
  const allAssignments = assignmentsQuery.data ?? []
  const studentStatusByUsn = useMemo(() => {
    const rows = studentsQuery.data ?? []
    const map = new Map<string, boolean>()
    for (const row of rows) {
      map.set(row.usn, row.password_must_change)
    }
    return map
  }, [studentsQuery.data])

  const studentTaskLockByUsn = useMemo(() => {
    const rows = studentsQuery.data ?? []
    const map = new Map<string, boolean>()
    for (const row of rows) {
      map.set(row.usn, row.task_locked)
    }
    return map
  }, [studentsQuery.data])

  useEffect(() => {
    if (!allAssignments.length) {
      return
    }
    setRowControls((previous) => {
      const next = { ...previous }
      for (const assignment of allAssignments) {
        if (!next[assignment.usn]) {
          next[assignment.usn] = {
            taskId: assignment.taskId,
            lockTask: studentTaskLockByUsn.get(assignment.usn) ?? false,
          }
        }
      }
      return next
    })
  }, [allAssignments, studentTaskLockByUsn])

  const filteredAssignments = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    return allAssignments.filter((assignment) => {
      const task = getTaskById(assignment.taskId)
      const matchesSearch =
        !searchTerm ||
        assignment.name.toLowerCase().includes(searchTerm) ||
        assignment.usn.toLowerCase().includes(searchTerm) ||
        assignment.taskId.toLowerCase().includes(searchTerm) ||
        (task?.title.toLowerCase().includes(searchTerm) ?? false)

      const matchesType = typeFilter === 'all' || task?.type === typeFilter
      const matchesTask = taskFilter === 'all' || assignment.taskId === taskFilter

      return matchesSearch && matchesType && matchesTask
    })
  }, [allAssignments, search, typeFilter, taskFilter])

  const stats = useMemo(() => {
    const assignedTaskIds = new Set(allAssignments.map((item) => item.taskId))
    const uniqueTaskCoverage = assignedTaskIds.size
    const totalTasks = STUDENT_TASKS.length
    const totalStudents = allAssignments.length
    const unassignedTaskCount = Math.max(0, totalTasks - uniqueTaskCoverage)

    const byType = {
      feature: 0,
      refactor: 0,
      bug: 0,
      'devops-docs': 0,
    }

    for (const assignment of allAssignments) {
      const task = getTaskById(assignment.taskId)
      if (task) {
        byType[task.type] += 1
      }
    }

    return {
      uniqueTaskCoverage,
      totalTasks,
      totalStudents,
      unassignedTaskCount,
      byType,
    }
  }, [allAssignments])

  const handleExportCsv = () => {
    const csv = exportAssignmentsCsv(allAssignments)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'admin-assignment-dashboard.csv'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <ModulePage
      title="Admin Assignment Dashboard"
      purpose="View every student assignment, filter records, export CSV, and monitor assignment distribution from one place."
      status="available"
      nextActionLabel="Open Assignment Management"
      nextActionTo="/task-assignment"
    >
      <section className="card admin-summary-grid">
        <div className="admin-stat-card">
          <h3>Total students assigned</h3>
          <p>{stats.totalStudents}</p>
        </div>
        <div className="admin-stat-card">
          <h3>Unique tasks covered</h3>
          <p>
            {stats.uniqueTaskCoverage} / {stats.totalTasks}
          </p>
        </div>
        <div className="admin-stat-card">
          <h3>Unassigned tasks</h3>
          <p>{stats.unassignedTaskCount}</p>
        </div>
        <div className="admin-stat-card">
          <h3>Assignment mode</h3>
          <p>{assignmentMode}</p>
        </div>
      </section>

      <section className="card admin-summary-grid admin-type-breakdown">
        <div className="admin-stat-card">
          <h3>Feature tasks assigned</h3>
          <p>{stats.byType.feature}</p>
        </div>
        <div className="admin-stat-card">
          <h3>Refactor tasks assigned</h3>
          <p>{stats.byType.refactor}</p>
        </div>
        <div className="admin-stat-card">
          <h3>Bug tasks assigned</h3>
          <p>{stats.byType.bug}</p>
        </div>
        <div className="admin-stat-card">
          <h3>DevOps/Docs tasks assigned</h3>
          <p>{stats.byType['devops-docs']}</p>
        </div>
      </section>

      <section className="card admin-filters">
        <div className="admin-filter-grid">
          <label>
            Search by name, USN, task ID, or title
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assignment records"
            />
          </label>
          <label>
            Filter by task type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | StudentTaskType)}>
              <option value="all">All types</option>
              <option value="feature">Feature</option>
              <option value="refactor">Refactor</option>
              <option value="bug">Bug</option>
              <option value="devops-docs">DevOps/Docs</option>
            </select>
          </label>
          <label>
            Filter by task
            <select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}>
              <option value="all">All tasks</option>
              {STUDENT_TASKS.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.id} - {task.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-actions">
          <button type="button" className="button-link secondary" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button
            type="button"
            className="button-link secondary"
            onClick={() => {
              setSyncMessage('')
              syncMutation.mutate()
            }}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync SQLite to MongoDB'}
          </button>
          <Link className="button-link secondary" to="/task-assignment">
            Manage Assignments
          </Link>
        </div>
        {syncMessage && <p>{syncMessage}</p>}
        <div className="assignment-form" style={{ marginTop: '0.75rem' }}>
          <label>
            Reset Student Password (USN)
            <input
              type="text"
              value={resetUsn}
              onChange={(event) => setResetUsn(event.target.value)}
              placeholder="Enter student USN"
            />
          </label>
          <button
            type="button"
            className="button-link secondary"
            disabled={resetPasswordMutation.isPending || !resetUsn.trim()}
            onClick={() => {
              setResetMessage('')
              resetPasswordMutation.mutate(resetUsn.trim().toUpperCase())
            }}
          >
            {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password to Default'}
          </button>
          {resetMessage && <p>{resetMessage}</p>}
        </div>
      </section>

      <section className="card">
        <h2>All Student Assignments</h2>
        {assignmentsQuery.isLoading && <p>Loading assignment records...</p>}
        {assignmentsQuery.isError && <p>Could not load assignment records right now.</p>}
        {!assignmentsQuery.isLoading && !assignmentsQuery.isError && filteredAssignments.length === 0 ? (
          <p>No matching assignment records found.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>USN</th>
                  <th>Password Status</th>
                  <th>Task Lock</th>
                  <th>Task ID</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Details</th>
                  <th>Assigned At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((assignment) => {
                  const mustChange = studentStatusByUsn.get(assignment.usn)
                  const passwordStatus =
                    mustChange === undefined ? 'unknown' : mustChange ? 'default/reset-required' : 'changed'
                  const control = rowControls[assignment.usn] ?? {
                    taskId: assignment.taskId,
                    lockTask: studentTaskLockByUsn.get(assignment.usn) ?? false,
                  }
                  const task = getTaskById(assignment.taskId)
                  return (
                    <tr key={assignment.usn}>
                      <td>{assignment.name}</td>
                      <td>{assignment.usn}</td>
                      <td>{passwordStatus}</td>
                      <td>{control.lockTask ? 'Locked' : 'Open'}</td>
                      <td>{task?.id ?? assignment.taskId}</td>
                      <td>{task?.type ?? 'unknown'}</td>
                      <td>{task?.title ?? 'Task unavailable'}</td>
                      <td>{task?.details ?? 'No task details found.'}</td>
                      <td>{new Date(assignment.assignedAt).toLocaleString()}</td>
                      <td>
                        <div className="assignment-form">
                          <select
                            value={control.taskId}
                            onChange={(event) => {
                              const value = event.target.value
                              setRowControls((previous) => ({
                                ...previous,
                                [assignment.usn]: {
                                  ...(previous[assignment.usn] ?? control),
                                  taskId: value,
                                },
                              }))
                            }}
                          >
                            {STUDENT_TASKS.map((taskOption) => (
                              <option key={taskOption.id} value={taskOption.id}>
                                {taskOption.id}
                              </option>
                            ))}
                          </select>
                          <label>
                            <input
                              type="checkbox"
                              checked={control.lockTask}
                              onChange={(event) => {
                                const value = event.target.checked
                                setRowControls((previous) => ({
                                  ...previous,
                                  [assignment.usn]: {
                                    ...(previous[assignment.usn] ?? control),
                                    lockTask: value,
                                  },
                                }))
                              }}
                            />
                            Lock
                          </label>
                          <button
                            type="button"
                            className="button-link secondary"
                            disabled={taskControlMutation.isPending}
                            onClick={() => {
                              setRowActionMessage('')
                              taskControlMutation.mutate({
                                usn: assignment.usn,
                                taskId: control.taskId,
                                lockTask: control.lockTask,
                              })
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="button-link secondary"
                            disabled={resetPasswordMutation.isPending}
                            onClick={() => {
                              setRowActionMessage('')
                              resetPasswordMutation.mutate(assignment.usn)
                            }}
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {rowActionMessage && <p>{rowActionMessage}</p>}
      </section>
    </ModulePage>
  )
}
