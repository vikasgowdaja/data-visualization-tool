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

const ASSIGNMENTS_KEY = 'dslab:studentAssignments'
const ASSIGNMENT_MODE_KEY = 'dslab:assignmentMode'

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

function normalizeUsn(usn: string): string {
  return usn.trim().toUpperCase()
}

function loadAssignments(): StudentAssignment[] {
  const raw = localStorage.getItem(ASSIGNMENTS_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as StudentAssignment[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
  } catch {
    return []
  }
}

function saveAssignments(assignments: StudentAssignment[]): void {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments))
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

export function getAssignmentMode(): AssignmentMode {
  const stored = localStorage.getItem(ASSIGNMENT_MODE_KEY)
  return stored === 'mentor-only' ? 'mentor-only' : 'self-assign'
}

export function setAssignmentMode(mode: AssignmentMode): void {
  localStorage.setItem(ASSIGNMENT_MODE_KEY, mode)
}

export function listStudentAssignments(): StudentAssignment[] {
  return loadAssignments().sort((a, b) => a.usn.localeCompare(b.usn))
}

export function getTaskById(taskId: string): StudentTask | undefined {
  return STUDENT_TASKS.find((task) => task.id === taskId)
}

export function getTaskOptions(): Array<{ id: string; label: string }> {
  return STUDENT_TASKS.map((task) => ({ id: task.id, label: `${task.id} - ${task.title}` }))
}

export function assignRandomTask(name: string, usn: string):
  | { status: 'created'; assignment: StudentAssignment }
  | { status: 'duplicate'; assignment: StudentAssignment } {
  const normalizedUsn = normalizeUsn(usn)
  const trimmedName = name.trim()
  const assignments = loadAssignments()

  const existing = assignments.find((entry) => normalizeUsn(entry.usn) === normalizedUsn)
  if (existing) {
    return { status: 'duplicate', assignment: existing }
  }

  const assignedTaskIds = new Set(assignments.map((entry) => entry.taskId))
  const unassignedTasks = STUDENT_TASKS.filter((task) => !assignedTaskIds.has(task.id))
  const pool = unassignedTasks.length > 0 ? unassignedTasks : STUDENT_TASKS
  const randomTask = pool[Math.floor(Math.random() * pool.length)]

  const created: StudentAssignment = {
    name: trimmedName,
    usn: normalizedUsn,
    taskId: randomTask.id,
    assignedAt: new Date().toISOString(),
  }

  assignments.push(created)
  saveAssignments(assignments)

  return { status: 'created', assignment: created }
}

export function reassignTaskByUsn(usn: string, taskId: string):
  | { status: 'updated'; assignment: StudentAssignment }
  | { status: 'not-found' }
  | { status: 'invalid-task' } {
  const assignments = loadAssignments()
  const normalizedUsn = normalizeUsn(usn)
  const index = assignments.findIndex((entry) => normalizeUsn(entry.usn) === normalizedUsn)

  if (index < 0) {
    return { status: 'not-found' }
  }

  const task = getTaskById(taskId)
  if (!task) {
    return { status: 'invalid-task' }
  }

  assignments[index] = {
    ...assignments[index],
    taskId: task.id,
  }

  saveAssignments(assignments)
  return { status: 'updated', assignment: assignments[index] }
}

export function exportAssignmentsCsv(): string {
  const headers = ['Name', 'USN', 'Task ID', 'Task Type', 'Task Title', 'Task Details', 'Assigned At']
  const rows = listStudentAssignments().map((assignment) => {
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
