import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { clearAdminToken, getAdminSession, getAdminToken } from '../services/adminAuth'

type RequireAdminRouteProps = {
  children: ReactNode
}

export default function RequireAdminRoute({ children }: RequireAdminRouteProps) {
  const token = getAdminToken()
  const sessionQuery = useQuery({
    queryKey: ['admin-session', 'route-guard'],
    queryFn: getAdminSession,
    enabled: token.length > 0,
    retry: false,
  })

  if (!token) {
    return <Navigate to="/admin-login" replace />
  }

  if (sessionQuery.isLoading) {
    return <div className="route-loading">Validating admin session...</div>
  }

  if (sessionQuery.isError || !sessionQuery.data?.isAdmin) {
    clearAdminToken()
    return <Navigate to="/admin-login" replace />
  }

  return <>{children}</>
}
