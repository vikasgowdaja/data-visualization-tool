import { PROJECTS } from './projects'

const LAST_MODULE_KEY = 'dslab:lastModule'
const LAST_DATASET_KEY = 'dslab:lastDataset'
const LAST_STUDENT_USN_KEY = 'dslab:lastStudentUsn'
const STUDENT_TASK_MAP_KEY = 'dslab:studentTaskMap'

export function saveLastModule(pathname: string): void {
  localStorage.setItem(LAST_MODULE_KEY, pathname)
}

export function getLastModule(): string | null {
  return localStorage.getItem(LAST_MODULE_KEY)
}

export function saveLastDataset(datasetId: string): void {
  localStorage.setItem(LAST_DATASET_KEY, datasetId)
}

export function getLastDatasetTitle(): string {
  const datasetId = localStorage.getItem(LAST_DATASET_KEY)
  const project = PROJECTS.find((item) => item.id === datasetId)
  return project?.title ?? 'No dataset selected yet'
}

export function saveLastStudentUsn(usn: string): void {
  localStorage.setItem(LAST_STUDENT_USN_KEY, usn.trim().toUpperCase())
}

export function getLastStudentUsn(): string {
  return localStorage.getItem(LAST_STUDENT_USN_KEY) ?? ''
}

function parseStudentTaskMap(): Record<string, string> {
  const raw = localStorage.getItem(STUDENT_TASK_MAP_KEY)
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

export function saveStudentTaskSnapshot(usn: string, taskId: string): void {
  const normalizedUsn = usn.trim().toUpperCase()
  const normalizedTask = taskId.trim().toUpperCase()
  const current = parseStudentTaskMap()
  current[normalizedUsn] = normalizedTask
  localStorage.setItem(STUDENT_TASK_MAP_KEY, JSON.stringify(current))
}

export function getStudentTaskSnapshot(usn: string): string {
  const normalizedUsn = usn.trim().toUpperCase()
  const current = parseStudentTaskMap()
  return current[normalizedUsn] ?? ''
}
