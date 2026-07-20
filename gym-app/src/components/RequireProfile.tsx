import { Navigate, Outlet } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export function RequireProfile() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  if (activeProfileId == null) {
    return <Navigate to="/select" replace />
  }
  return <Outlet />
}
