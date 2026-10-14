import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ModulePage from '../components/ModulePage'
import { loginAdmin, setAdminToken } from '../services/adminAuth'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorText, setErrorText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setErrorText('Username and password are required.')
      return
    }

    try {
      setLoading(true)
      setErrorText('')
      const result = await loginAdmin(username.trim(), password)
      setAdminToken(result.token)
      navigate('/admin-assignments', { replace: true })
    } catch {
      setErrorText('Invalid admin credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModulePage
      title="Admin Login"
      purpose="Authenticate once to access protected admin features."
      status="available"
      nextActionLabel="Back to Dashboard"
      nextActionTo="/dashboard"
    >
      <section className="card assignment-page-grid">
        <div>
          <h2>Admin Access</h2>
          <p>Only mentors/admins should use this login.</p>
          <div className="assignment-form">
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Admin username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Admin password"
              />
            </label>
            <button type="button" className="button-link" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          {errorText && <p>{errorText}</p>}
        </div>

        <div>
          <h2>Need student access only?</h2>
          <p>Students can continue using open assignment and dashboard pages without admin login.</p>
          <Link className="button-link secondary" to="/task-assignment">
            Open Task Assignment
          </Link>
        </div>
      </section>
    </ModulePage>
  )
}
