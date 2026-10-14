import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  '/task-assignment': 'Task Assignment',
}

export default function AppShell({ navItems, children }: AppShellProps) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    saveLastModule(location.pathname)
  }, [location.pathname])

  const currentModule = useMemo(() => pathToLabel[location.pathname] ?? 'Module', [location.pathname])
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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}
