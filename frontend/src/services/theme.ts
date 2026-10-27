export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'
export const THEME_BACKUP_KEY = 'dslab:theme'

/**
 * Retrieves the initial theme.
 * Priority:
 * 1. Saved preference in localStorage ('theme' or 'dslab:theme')
 * 2. System preference via window.matchMedia
 * 3. Default fallback: 'light'
 */
export function getInitialTheme(): Theme {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const saved =
        window.localStorage.getItem(THEME_STORAGE_KEY) || window.localStorage.getItem(THEME_BACKUP_KEY)
      if (saved === 'dark' || saved === 'light') {
        return saved
      }
    } catch {
      // localStorage may fail in restricted/private contexts
    }
  }

  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

/**
 * Applies the theme to document.documentElement and document.body
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme

  if (document.body) {
    document.body.setAttribute('data-theme', theme)
    document.body.classList.remove('light', 'dark')
    document.body.classList.add(theme)
  }
}

/**
 * Saves the selected theme to localStorage
 */
export function saveTheme(theme: Theme): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
      window.localStorage.setItem(THEME_BACKUP_KEY, theme)
    } catch {
      // ignore storage quota / permission errors
    }
  }
}
