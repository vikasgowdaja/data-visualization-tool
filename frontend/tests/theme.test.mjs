import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getInitialTheme,
  applyTheme,
  saveTheme,
  THEME_STORAGE_KEY,
  THEME_BACKUP_KEY,
} from '../src/services/theme.ts'

// Simple mock for localStorage
function createMockLocalStorage() {
  const store = new Map()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

// Simple mock for DOM document element
function createMockElement() {
  const attributes = new Map()
  const classListSet = new Set()
  return {
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
    classList: {
      add: (...tokens) => tokens.forEach((t) => classListSet.add(t)),
      remove: (...tokens) => tokens.forEach((t) => classListSet.delete(t)),
      contains: (token) => classListSet.has(token),
    },
    style: {},
  }
}

test('getInitialTheme defaults to light when no preference and no dark media match', () => {
  const originalWindow = globalThis.window
  const mockStorage = createMockLocalStorage()

  globalThis.window = {
    localStorage: mockStorage,
    matchMedia: () => ({ matches: false }),
  }

  try {
    assert.equal(getInitialTheme(), 'light')
  } finally {
    globalThis.window = originalWindow
  }
})

test('getInitialTheme returns dark when system prefers dark and no saved preference', () => {
  const originalWindow = globalThis.window
  const mockStorage = createMockLocalStorage()

  globalThis.window = {
    localStorage: mockStorage,
    matchMedia: (query) => ({ matches: query === '(prefers-color-scheme: dark)' }),
  }

  try {
    assert.equal(getInitialTheme(), 'dark')
  } finally {
    globalThis.window = originalWindow
  }
})

test('getInitialTheme respects saved theme in localStorage over system preference', () => {
  const originalWindow = globalThis.window
  const mockStorage = createMockLocalStorage()
  mockStorage.setItem(THEME_STORAGE_KEY, 'light')

  globalThis.window = {
    localStorage: mockStorage,
    matchMedia: () => ({ matches: true }), // system prefers dark, but user saved light
  }

  try {
    assert.equal(getInitialTheme(), 'light')
  } finally {
    globalThis.window = originalWindow
  }
})

test('getInitialTheme respects backup key dslab:theme in localStorage', () => {
  const originalWindow = globalThis.window
  const mockStorage = createMockLocalStorage()
  mockStorage.setItem(THEME_BACKUP_KEY, 'dark')

  globalThis.window = {
    localStorage: mockStorage,
    matchMedia: () => ({ matches: false }),
  }

  try {
    assert.equal(getInitialTheme(), 'dark')
  } finally {
    globalThis.window = originalWindow
  }
})

test('saveTheme writes preference to both theme and backup key', () => {
  const originalWindow = globalThis.window
  const mockStorage = createMockLocalStorage()

  globalThis.window = {
    localStorage: mockStorage,
  }

  try {
    saveTheme('dark')
    assert.equal(mockStorage.getItem(THEME_STORAGE_KEY), 'dark')
    assert.equal(mockStorage.getItem(THEME_BACKUP_KEY), 'dark')

    saveTheme('light')
    assert.equal(mockStorage.getItem(THEME_STORAGE_KEY), 'light')
    assert.equal(mockStorage.getItem(THEME_BACKUP_KEY), 'light')
  } finally {
    globalThis.window = originalWindow
  }
})

test('applyTheme sets data-theme, class list, and colorScheme on root and body', () => {
  const originalDoc = globalThis.document
  const root = createMockElement()
  const body = createMockElement()

  globalThis.document = {
    documentElement: root,
    body: body,
  }

  try {
    applyTheme('dark')
    assert.equal(root.getAttribute('data-theme'), 'dark')
    assert.equal(root.classList.contains('dark'), true)
    assert.equal(root.classList.contains('light'), false)
    assert.equal(root.style.colorScheme, 'dark')
    assert.equal(body.getAttribute('data-theme'), 'dark')
    assert.equal(body.classList.contains('dark'), true)

    applyTheme('light')
    assert.equal(root.getAttribute('data-theme'), 'light')
    assert.equal(root.classList.contains('light'), true)
    assert.equal(root.classList.contains('dark'), false)
    assert.equal(root.style.colorScheme, 'light')
    assert.equal(body.getAttribute('data-theme'), 'light')
    assert.equal(body.classList.contains('light'), true)
  } finally {
    globalThis.document = originalDoc
  }
})
