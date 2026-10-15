import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clearAdminToken, getAdminToken } from '../services/adminAuth'
import { clearStudentSession, getStudentSession } from '../services/studentAuth'
import { saveLastModule } from '../services/studentState'

type NavItem = {
  to: string
  label: string
}

type AppShellProps = {
  navItems: NavItem[]
  children: ReactNode
}

const pathToLabel: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/learn': 'Learn',
  '/datasets': 'Datasets',
  '/data-explorer': 'Data Explorer',
  '/data-explorer/legacy': 'Legacy Workspace',
  '/data-cleaning-lab': 'Data Cleaning Lab',
  '/visualization-lab': 'Visualization Lab',
  '/statistics-lab': 'Statistics Lab',
  '/insights-lab': 'Insights Lab',
  '/practice': 'Practice',
  '/challenges': 'Challenges',
  '/projects': 'Projects',
  '/learning-path': 'Learning Path',
  '/resources': 'Resources',
  '/progress': 'Progress',
  '/login': 'Login Portal',
  '/student-login': 'Student Login',
  '/task-assignment': 'Task Assignment',
  '/admin-login': 'Admin Login',
  '/admin-assignments': 'Admin Dashboard',
}

export default function AppShell({ navItems, children }: AppShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hasAdminSession, setHasAdminSession] = useState(getAdminToken().length > 0)
  const [studentUsn, setStudentUsn] = useState(getStudentSession()?.usn ?? '')

  useEffect(() => {
    saveLastModule(location.pathname)
    setHasAdminSession(getAdminToken().length > 0)
    setStudentUsn(getStudentSession()?.usn ?? '')
  }, [location.pathname])

  const handleAdminLogout = () => {
    clearAdminToken()
    setHasAdminSession(false)
    navigate('/admin-login')
  }

  const handleStudentLogout = () => {
    clearStudentSession()
    setStudentUsn('')
    navigate('/student-login')
  }

  const currentModule = useMemo(() => pathToLabel[location.pathname] ?? 'Module', [location.pathname])
  const visibleNavItems = useMemo(() => {
    const hiddenLoginRoutes = new Set(['/student-login', '/admin-login'])
    return navItems.filter((item) => {
      if (hiddenLoginRoutes.has(item.to)) {
        return false
      }
      if (item.to === '/admin-assignments' && !hasAdminSession) {
        return false
      }
      return true
    })
  }, [navItems, hasAdminSession])
  const breadcrumbs = useMemo(() => {
    if (location.pathname === '/') {
      return ['Home']
    }
    return ['Home', currentModule]
  }, [location.pathname, currentModule])

  return (
    <div className="platform-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-block">
          <p className="brand-kicker">University Edition</p>
          <h2>DataScience Lab</h2>
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/data-explorer'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="top-header">
          <button
            type="button"
            className="menu-button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          <div className="header-meta">
            <p className="breadcrumbs">{breadcrumbs.join(' / ')}</p>
            <h1 className="module-indicator">{currentModule}</h1>
          </div>
          {studentUsn && (
            <div className="profile-chip" aria-label="Student profile">
              <span>Student: {studentUsn}</span>
              <button type="button" className="button-link secondary" onClick={handleStudentLogout}>
                Student Logout
              </button>
            </div>
          )}
          {hasAdminSession && (
            <button type="button" className="button-link secondary" onClick={handleAdminLogout}>
              Admin Logout
            </button>
          )}
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}
