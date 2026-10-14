import axios from 'axios'
import { API_BASE } from './api'
import { getAdminAuthHeaders } from './adminAuth'

export type StudentTaskType = 'feature' | 'refactor' | 'bug' | 'devops-docs'

export type StudentTask = {
  id: string
  type: StudentTaskType
  title: string
  details: string
}

export type StudentAssignment = {
  name: string
  usn: string
  taskId: string
  assignedAt: string
}

export type AssignmentMode = 'self-assign' | 'mentor-only'

type AssignmentApiResponse = {
  name: string
  usn: string
  task_id: string
  assigned_at: string
}

type AssignmentModeApiResponse = {
  mode: AssignmentMode
}

type AssignRandomApiResponse = {
  status: 'created' | 'duplicate'
  assignment: AssignmentApiResponse
}

type StudentLoginApiResponse = {
  usn: string
  assignment_found: boolean
  assignment: AssignmentApiResponse | null
  recovered_task_id: string | null
  must_change_password: boolean
  profile_name: string | null
  message: string
}

type StudentRecoverAssignmentApiResponse = {
  status: 'saved' | 'matched-cache'
  matched_cached_task: boolean
  assignment: AssignmentApiResponse
}

export type StudentLoginResult = {
  usn: string
  assignmentFound: boolean
  assignment: StudentAssignment | null
  recoveredTaskId: string | null
  mustChangePassword: boolean
  profileName: string | null
  message: string
}

export type StudentRecoveryResult = {
  status: 'saved' | 'matched-cache'
  matchedCachedTask: boolean
  assignment: StudentAssignment
}

export type StudentPasswordChangeResult = {
  usn: string
  passwordChanged: boolean
}

export type StudentProfileUpdateResult = {
  usn: string
  name: string
  nameChanged: boolean
  passwordChanged: boolean
}

export type AdminResetStudentPasswordResult = {
  usn: string
  resetToDefault: boolean
}

export type AdminTaskControlResult = {
  usn: string
  taskId: string
  taskLocked: boolean
}

export const STUDENT_TASKS: StudentTask[] = [
  {
    id: 'S01',
    type: 'feature',
    title: 'Direct Legacy Workspace in side drawer',
    details: 'Add a separate menu entry to open /data-explorer/legacy directly with correct active-nav behavior.',
  },
  {
    id: 'S02',
    type: 'feature',
    title: 'Recent Datasets panel',
    details: 'Show latest generated/uploaded datasets with quick reopen actions and empty/loading/error states.',
  },
  {
    id: 'S03',
    type: 'feature',
    title: 'Chart export to PNG',
    details: 'Allow exporting scatter, line, bar, and histogram charts to PNG from the visible chart area.',
  },
  {
    id: 'S04',
    type: 'feature',
    title: 'Persist interpretation drafts by chart',
    details: 'Keep per-chart interpretation text while switching chart types in the legacy workspace.',
  },
  {
    id: 'S05',
    type: 'feature',
    title: 'Generator preset buttons',
    details: 'Add beginner/intermediate/advanced quick presets that apply generator form values in one click.',
  },
  {
    id: 'S06',
    type: 'feature',
    title: 'Theme toggle support',
    details: 'Implement light/dark theme toggle with persistent preference across refreshes.',
  },
  {
    id: 'S07',
    type: 'feature',
    title: 'Regenerate from previous config',
    details: 'Add one-click regenerate using previous configuration with a new seed for variation.',
  },
  {
    id: 'S08',
    type: 'feature',
    title: 'Feature comparison mini-view',
    details: 'Compare two selected features against the target with side-by-side metrics.',
  },
  {
    id: 'S09',
    type: 'refactor',
    title: 'Split legacy monolith component',
    details: 'Break the large legacy app component into smaller modules/hooks without behavior change.',
  },
  {
    id: 'S10',
    type: 'refactor',
    title: 'Centralize API calls in services',
    details: 'Move inline axios calls into service files and standardize response/error handling.',
  },
  {
    id: 'S11',
    type: 'refactor',
    title: 'Extract data/math utility module',
    details: 'Move numeric parsing, histogram, group mean, and similar helpers to reusable utilities.',
  },
  {
    id: 'S12',
    type: 'refactor',
    title: 'Chart renderer strategy map',
    details: 'Replace large chart conditionals with a typed renderer mapping strategy.',
  },
  {
    id: 'S13',
    type: 'refactor',
    title: 'Central route constants',
    details: 'Define shared route/path constants and remove repeated hardcoded paths.',
  },
  {
    id: 'S14',
    type: 'refactor',
    title: 'Interpretation rule config extraction',
    details: 'Move phrase dictionaries and scoring configuration out of component into dedicated config files.',
  },
  {
    id: 'S15',
    type: 'refactor',
    title: 'Unified API error model',
    details: 'Implement a common error model and consistent UI display for network/server/validation failures.',
  },
  {
    id: 'S16',
    type: 'bug',
    title: 'Fix invalid axis fallback',
    details: 'Ensure chart x/y selections always recover to valid numeric columns after dataset regeneration.',
  },
  {
    id: 'S17',
    type: 'bug',
    title: 'Fix histogram edge handling',
    details: 'Ensure max values are placed correctly in final bin and total counts remain accurate.',
  },
  {
    id: 'S18',
    type: 'bug',
    title: 'Fix keyword highlight false positives',
    details: 'Improve matching boundaries to prevent accidental partial-word highlights.',
  },
  {
    id: 'S19',
    type: 'bug',
    title: 'Fix CORS host coverage',
    details: 'Align allowed origins for localhost and nip.io frontend hosts in local and cluster flow.',
  },
  {
    id: 'S20',
    type: 'bug',
    title: 'Improve CI skip visibility',
    details: 'Make workflow logs explicit when Docker push/deploy is skipped due to missing credentials.',
  },
  {
    id: 'S21',
    type: 'devops-docs',
    title: 'Compose/Kubernetes switching runbook',
    details: 'Document a safe reset/rebuild/redeploy sequence to avoid stale config/image confusion.',
  },
]

function toAssignment(item: AssignmentApiResponse): StudentAssignment {
  return {
    name: item.name,
    usn: item.usn,
    taskId: item.task_id,
    assignedAt: item.assigned_at,
  }
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

export async function listStudentAssignments(): Promise<StudentAssignment[]> {
  const response = await axios.get<AssignmentApiResponse[]>(`${API_BASE}/assignments`)
  return response.data.map(toAssignment)
}

export function getTaskById(taskId: string): StudentTask | undefined {
  return STUDENT_TASKS.find((task) => task.id === taskId)
}

export function getTaskOptions(): Array<{ id: string; label: string }> {
  return STUDENT_TASKS.map((task) => ({ id: task.id, label: `${task.id} - ${task.title}` }))
}

export async function getAssignmentMode(): Promise<AssignmentMode> {
  const response = await axios.get<AssignmentModeApiResponse>(`${API_BASE}/assignments/mode`)
  return response.data.mode
}

export async function setAssignmentMode(mode: AssignmentMode): Promise<AssignmentMode> {
  const response = await axios.put<AssignmentModeApiResponse>(
    `${API_BASE}/assignments/mode`,
    { mode },
    { headers: getAdminAuthHeaders() },
  )
  return response.data.mode
}

export async function assignRandomTask(name: string, usn: string): Promise<
  | { status: 'created'; assignment: StudentAssignment }
  | { status: 'duplicate'; assignment: StudentAssignment }
> {
  const response = await axios.post<AssignRandomApiResponse>(`${API_BASE}/assignments/assign-random`, { name, usn })
  return {
    status: response.data.status,
    assignment: toAssignment(response.data.assignment),
  }
}

export async function loginStudentByUsn(
  username: string,
  password: string,
  cachedTaskId?: string,
): Promise<StudentLoginResult> {
  const response = await axios.post<StudentLoginApiResponse>(`${API_BASE}/students/login`, {
    username,
    password,
    cached_task_id: cachedTaskId || null,
  })
  return {
    usn: response.data.usn,
    assignmentFound: response.data.assignment_found,
    assignment: response.data.assignment ? toAssignment(response.data.assignment) : null,
    recoveredTaskId: response.data.recovered_task_id,
    mustChangePassword: response.data.must_change_password,
    profileName: response.data.profile_name,
    message: response.data.message,
  }
}

export async function recoverStudentAssignment(
  username: string,
  password: string,
  taskId: string,
  name?: string,
  cachedTaskId?: string,
): Promise<StudentRecoveryResult> {
  const response = await axios.post<StudentRecoverAssignmentApiResponse>(`${API_BASE}/students/recover-assignment`, {
    username,
    password,
    task_id: taskId,
    name: name || null,
    cached_task_id: cachedTaskId || null,
  })
  return {
    status: response.data.status,
    matchedCachedTask: response.data.matched_cached_task,
    assignment: toAssignment(response.data.assignment),
  }
}

export async function changeStudentPassword(
  usn: string,
  currentPassword: string,
  newPassword: string,
): Promise<StudentPasswordChangeResult> {
  const response = await axios.post<{ usn: string; password_changed: boolean }>(`${API_BASE}/students/change-password`, {
    usn,
    current_password: currentPassword,
    new_password: newPassword,
  })
  return {
    usn: response.data.usn,
    passwordChanged: response.data.password_changed,
  }
}

export async function updateStudentProfile(
  usn: string,
  currentPassword: string,
  newName?: string,
  newPassword?: string,
): Promise<StudentProfileUpdateResult> {
  const response = await axios.post<{
    usn: string
    name: string
    name_changed: boolean
    password_changed: boolean
  }>(`${API_BASE}/students/update-profile`, {
    usn,
    current_password: currentPassword,
    new_name: newName?.trim() ? newName.trim() : null,
    new_password: newPassword?.trim() ? newPassword : null,
  })
  return {
    usn: response.data.usn,
    name: response.data.name,
    nameChanged: response.data.name_changed,
    passwordChanged: response.data.password_changed,
  }
}

export async function adminResetStudentPassword(usn: string): Promise<AdminResetStudentPasswordResult> {
  const response = await axios.post<{ usn: string; reset_to_default: boolean }>(
    `${API_BASE}/students/${encodeURIComponent(usn)}/reset-password`,
    undefined,
    {
      headers: getAdminAuthHeaders(),
    },
  )
  return {
    usn: response.data.usn,
    resetToDefault: response.data.reset_to_default,
  }
}

export async function adminSetStudentTaskControl(
  usn: string,
  taskId: string,
  lockTask: boolean,
): Promise<AdminTaskControlResult> {
  const response = await axios.put<{ usn: string; task_id: string; task_locked: boolean }>(
    `${API_BASE}/students/${encodeURIComponent(usn)}/task-control`,
    {
      task_id: taskId,
      lock_task: lockTask,
    },
    {
      headers: getAdminAuthHeaders(),
    },
  )
  return {
    usn: response.data.usn,
    taskId: response.data.task_id,
    taskLocked: response.data.task_locked,
  }
}

export async function reassignTaskByUsn(
  usn: string,
  taskId: string,
): Promise<
  | { status: 'updated'; assignment: StudentAssignment }
  | { status: 'not-found' }
  | { status: 'invalid-task' }
> {
  try {
    const response = await axios.put<AssignmentApiResponse>(`${API_BASE}/assignments/${encodeURIComponent(usn)}/task`, {
      task_id: taskId,
    }, {
      headers: getAdminAuthHeaders(),
    })
    return {
      status: 'updated',
      assignment: toAssignment(response.data),
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return { status: 'not-found' }
      }
      if (error.response?.status === 422) {
        return { status: 'invalid-task' }
      }
    }
    throw error
  }
}

export function exportAssignmentsCsv(assignments: StudentAssignment[]): string {
  const headers = ['Name', 'USN', 'Task ID', 'Task Type', 'Task Title', 'Task Details', 'Assigned At']
  const rows = assignments.map((assignment) => {
    const task = getTaskById(assignment.taskId)
    return [
      assignment.name,
      assignment.usn,
      assignment.taskId,
      task?.type ?? '',
      task?.title ?? '',
      task?.details ?? '',
      assignment.assignedAt,
    ]
      .map((value) => csvEscape(String(value)))
      .join(',')
  })

  return [headers.map((item) => csvEscape(item)).join(','), ...rows].join('\n')
}
