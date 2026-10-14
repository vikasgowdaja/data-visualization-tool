import axios from 'axios'
import { API_BASE } from './api'

const ADMIN_TOKEN_KEY = 'dslab:adminToken'

type AdminLoginApiResponse = {
  token: string
  expires_at: string
}

type AdminSessionApiResponse = {
  username: string
  is_admin: boolean
  expires_at: string
}

export type AdminSession = {
  username: string
  isAdmin: boolean
  expiresAt: string
}

export function getAdminToken(): string {
  return localStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function getAdminAuthHeaders(): Record<string, string> {
  const token = getAdminToken()
  if (!token) {
    return {}
  }
  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function loginAdmin(username: string, password: string): Promise<{ token: string; expiresAt: string }> {
  const response = await axios.post<AdminLoginApiResponse>(`${API_BASE}/admin/login`, { username, password })
  return {
    token: response.data.token,
    expiresAt: response.data.expires_at,
  }
}

export async function getAdminSession(): Promise<AdminSession> {
  const response = await axios.get<AdminSessionApiResponse>(`${API_BASE}/admin/me`, {
    headers: getAdminAuthHeaders(),
  })
  return {
    username: response.data.username,
    isAdmin: response.data.is_admin,
    expiresAt: response.data.expires_at,
  }
}
