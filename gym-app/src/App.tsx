import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ensureSeeded } from './db/seed'
import { useAppStore } from './store/useAppStore'
import { AppShell } from './components/AppShell'
import { RequireProfile } from './components/RequireProfile'
import { SelectProfile } from './pages/SelectProfile'
import { ProfileSetup } from './pages/ProfileSetup'
import { Home } from './pages/Home'
import { StartWorkout } from './pages/StartWorkout'
import { ActiveWorkout } from './pages/ActiveWorkout'
import { History } from './pages/History'
import { HistoryDetail } from './pages/HistoryDetail'
import { Progress } from './pages/Progress'
import { Settings } from './pages/Settings'

function App() {
  const [ready, setReady] = useState(false)
  const activeProfileId = useAppStore((s) => s.activeProfileId)

  useEffect(() => {
    ensureSeeded().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to={activeProfileId != null ? '/home' : '/select'} replace />} />
        <Route path="/select" element={<SelectProfile />} />
        <Route path="/setup" element={<ProfileSetup />} />
        <Route path="/setup/:id/edit" element={<ProfileSetup />} />
        <Route path="/workout/active/:sessionId" element={<ActiveWorkout />} />

        <Route element={<RequireProfile />}>
          <Route element={<AppShell />}>
            <Route path="/home" element={<Home />} />
            <Route path="/workout/start" element={<StartWorkout />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:sessionId" element={<HistoryDetail />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
