import { useEffect, useState } from 'react'
import {
  applyTheme,
  getInitialTheme,
  saveTheme,
  THEME_BACKUP_KEY,
  THEME_STORAGE_KEY,
  type Theme,
} from '../services/theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = getInitialTheme()
    applyTheme(initial)
    return initial
  })

  // Apply whenever theme state changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Listen to system preference changes if user hasn't explicitly set a preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const hasStored =
        window.localStorage.getItem(THEME_STORAGE_KEY) || window.localStorage.getItem(THEME_BACKUP_KEY)
      if (!hasStored) {
        const systemTheme: Theme = e.matches ? 'dark' : 'light'
        setTheme(systemTheme)
        applyTheme(systemTheme)
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  // Synchronize theme changes across open tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === THEME_BACKUP_KEY) {
        if (e.newValue === 'light' || e.newValue === 'dark') {
          setTheme(e.newValue)
          applyTheme(e.newValue)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleToggle = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    saveTheme(nextTheme)
    applyTheme(nextTheme)
  }

  const isDark = theme === 'dark'

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      className={`theme-toggle-btn ${isDark ? 'is-dark' : 'is-light'}`}
      onClick={handleToggle}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (currently ${isDark ? 'Dark' : 'Light'} Mode)`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      <span className="theme-toggle-slider-wrap" aria-hidden="true">
        <span className="theme-icon sun-icon" title="Light Mode">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        </span>
        <span className="theme-icon moon-icon" title="Dark Mode">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
        <span className="theme-toggle-thumb" />
      </span>
      <span className="theme-toggle-label">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  )
}
