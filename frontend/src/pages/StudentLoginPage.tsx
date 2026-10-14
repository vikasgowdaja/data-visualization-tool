import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { getStudentTaskSnapshot, saveLastStudentUsn } from '../services/studentState'
import { clearStudentSession, saveStudentSession } from '../services/studentAuth'
import { loginStudentByUsn, updateStudentProfile } from '../services/taskAssignments'

export default function StudentLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Login with your student credentials to access your record.')
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loggedInUsn, setLoggedInUsn] = useState('')
  const [profileName, setProfileName] = useState('')

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage('Username and password are required.')
      return
    }

    const cachedTask = getStudentTaskSnapshot(username)
    try {
      const result = await loginStudentByUsn(username, password, cachedTask)
      saveLastStudentUsn(result.usn)
      setLoggedInUsn(result.usn)
      setMustChangePassword(result.mustChangePassword)
      setProfileName(result.profileName ?? '')

      saveStudentSession({
        usn: result.usn,
        profileName: result.profileName ?? '',
        mustChangePassword: result.mustChangePassword,
      })

      if (result.mustChangePassword) {
        setMessage('First login detected. Please change your password to continue.')
        return
      }

      if (result.assignmentFound) {
        setMessage('Login successful. Redirecting to dashboard.')
        navigate('/dashboard')
        return
      }

      setMessage('Login successful, but assignment record is missing. Please recover your task assignment.')
      navigate('/task-assignment')
    } catch {
      clearStudentSession()
      setMessage('Invalid student credentials.')
    }
  }

  const handleUpdateProfile = async () => {
    if (!loggedInUsn) {
      setMessage('Login first before changing profile details.')
      return
    }

    const wantsNameChange = profileName.trim().length > 0
    const wantsPasswordChange = newPassword.trim().length > 0 || confirmPassword.trim().length > 0

    if (!wantsNameChange && !wantsPasswordChange) {
      setMessage('Provide at least one change: name or password.')
      return
    }

    if (wantsPasswordChange) {
      if (newPassword.trim().length < 6) {
        setMessage('New password must be at least 6 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        setMessage('New password and confirm password do not match.')
        return
      }
    }

    try {
      const result = await updateStudentProfile(
        loggedInUsn,
        password,
        profileName,
        wantsPasswordChange ? newPassword : undefined,
      )
      saveStudentSession({
        usn: loggedInUsn,
        profileName: result.name,
        mustChangePassword: false,
      })
      setMustChangePassword(false)
      if (result.passwordChanged) {
        setPassword(newPassword)
      }
      setProfileName(result.name)
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Profile updated successfully. Redirecting to dashboard.')
      navigate('/dashboard')
    } catch {
      setMessage('Profile update failed. Verify your current credentials and retry.')
    }
  }

  return (
    <ModulePage
      title="Student Login"
      purpose="Login with your student credentials to view and continue your assigned work."
      status="available"
      nextActionLabel="Open Task Assignment"
      nextActionTo="/task-assignment"
    >
      <section className="card assignment-page-grid">
        <div>
          <h2>Student Sign In</h2>
          <div className="assignment-form">
            <label>
              Username (USN)
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your USN"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </label>
            <button type="button" className="button-link" onClick={handleLogin}>
              Login
            </button>
          </div>
          <p>{message}</p>
        </div>

        {loggedInUsn && (
          <div>
            <h2>Update Profile</h2>
            <p>{mustChangePassword ? 'First-time login requires password change.' : 'Update your name or password anytime.'}</p>
            <div className="assignment-form">
              <label>
                Name
                <input
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Enter your full name"
                />
              </label>
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
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat new password"
                />
              </label>
              <button type="button" className="button-link secondary" onClick={handleUpdateProfile}>
                Save Profile Changes
              </button>
            </div>
          </div>
        )}
      </section>
    </ModulePage>
  )
}
