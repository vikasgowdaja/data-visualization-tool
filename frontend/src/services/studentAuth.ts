export type StudentSession = {
  usn: string
  profileName: string
  mustChangePassword: boolean
}

const STUDENT_SESSION_KEY = 'dslab:studentSession'

export function saveStudentSession(session: StudentSession): void {
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session))
}

export function getStudentSession(): StudentSession | null {
  const raw = localStorage.getItem(STUDENT_SESSION_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as StudentSession
    if (!parsed.usn) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearStudentSession(): void {
  localStorage.removeItem(STUDENT_SESSION_KEY)
}
