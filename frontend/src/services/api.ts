const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const isConfiguredLocalTarget =
  !!configuredApiBase && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredApiBase)
const inferredApiBase = isLocalHost ? 'http://localhost:8000/api' : '/api'

export const API_BASE = (
  configuredApiBase && configuredApiBase.length > 0 && (isLocalHost || !isConfiguredLocalTarget)
    ? configuredApiBase
    : inferredApiBase
).replace(
  /\/$/,
  '',
)
