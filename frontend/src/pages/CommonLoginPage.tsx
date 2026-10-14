import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { loginAdmin, setAdminToken } from '../services/adminAuth'
import { saveStudentSession } from '../services/studentAuth'
import { saveLastStudentUsn } from '../services/studentState'
import { loginStudentByUsn } from '../services/taskAssignments'

type LoginProfile = 'student' | 'admin'

export default function CommonLoginPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<LoginProfile>('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Select profile, login, and you will be redirected to your portal.')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage('Username and password are required.')
      return
    }

    try {
      setLoading(true)
      setMessage('')

      if (profile === 'admin') {
        const result = await loginAdmin(username.trim(), password)
        setAdminToken(result.token)
        navigate('/admin-assignments')
        return
      }

      const student = await loginStudentByUsn(username.trim(), password)
      saveLastStudentUsn(student.usn)
      saveStudentSession({
        usn: student.usn,
        profileName: student.profileName ?? '',
        mustChangePassword: student.mustChangePassword,
      })

      if (student.mustChangePassword) {
        setMessage('First login requires password change. Redirecting to Student Login page...')
        navigate('/student-login')
        return
      }

      if (student.assignmentFound) {
        navigate('/task-assignment')
      } else {
        navigate('/task-assignment')
      }
    } catch {
      setMessage('Invalid credentials for selected profile.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModulePage
      title="Login Portal"
      purpose="Common entry point for Student and Admin users."
      status="available"
      nextActionLabel="Open Student Task Portal"
      nextActionTo="/task-assignment"
    >
      <section className="card assignment-page-grid">
        <div>
          <h2>Common Login</h2>
          <div className="assignment-form">
            <label>
              Profile
              <select value={profile} onChange={(event) => setProfile(event.target.value as LoginProfile)}>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={profile === 'student' ? 'Student USN' : 'Admin username'}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
              />
            </label>
            <button type="button" className="button-link" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in...' : 'Open Portal'}
            </button>
          </div>
          {message && <p>{message}</p>}
        </div>

        <div>
          <h2>Role Segregation</h2>
          <ul className="simple-list">
            <li>Students are redirected to Student Task portal and profile flows.</li>
            <li>Admins are redirected to Admin Dashboard with management actions.</li>
          </ul>
        </div>
      </section>
    </ModulePage>
  )
}
