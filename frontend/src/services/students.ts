import axios from 'axios'
import { API_BASE } from './api'
import { getAdminAuthHeaders } from './adminAuth'

export type StudentRecord = {
  name: string
  usn: string
  task_id: string
  assigned_at: string
  updated_at: string
  password_must_change: boolean
  task_locked: boolean
}

export type SeedStudentsResult = {
  seeded: number
  students_synced: number
  assignments_synced: number
}

export async function fetchStudents(): Promise<StudentRecord[]> {
  const response = await axios.get<StudentRecord[]>(`${API_BASE}/students`)
  return response.data
}

export async function fetchStudentByUsn(usn: string): Promise<StudentRecord> {
  const response = await axios.get<StudentRecord>(`${API_BASE}/students/${encodeURIComponent(usn)}`)
  return response.data
}

export async function seedStudentsFromSqlite(): Promise<SeedStudentsResult> {
  const response = await axios.post<SeedStudentsResult>(`${API_BASE}/students/seed-from-sqlite`, undefined, {
    headers: getAdminAuthHeaders(),
  })
  return response.data
}
