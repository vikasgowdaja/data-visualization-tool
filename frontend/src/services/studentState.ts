import { PROJECTS } from './projects'

const LAST_MODULE_KEY = 'dslab:lastModule'
const LAST_DATASET_KEY = 'dslab:lastDataset'
const LAST_STUDENT_USN_KEY = 'dslab:lastStudentUsn'

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
