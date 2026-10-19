import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ensureExercisesSeeded } from './db/seed'
import { ensureExercisePhotosSeeded } from './db/seedPhotos'
import { useAppStore } from './store/useAppStore'
import { AppShell } from './components/AppShell'
import { RequireProfile } from './components/RequireProfile'
import { SelectProfile } from './pages/SelectProfile'
import { ProfileSetup } from './pages/ProfileSetup'
import { Home } from './pages/Home'
import { StartWorkout } from './pages/StartWorkout'
import { ActiveWorkout } from './pages/ActiveWorkout'
import { LadderWorkout } from './pages/LadderWorkout'
import { Exercises } from './pages/Exercises'
import { RoutineBuilder } from './pages/RoutineBuilder'
import { AiProgram } from './pages/AiProgram'
import { History } from './pages/History'
import { HistoryDetail } from './pages/HistoryDetail'
import { CardioDetail } from './pages/CardioDetail'
import { Nutrition } from './pages/Nutrition'
import { Settings } from './pages/Settings'

// Progreso carries the charting library; load it only when that tab is opened.
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })))

function App() {
  const [ready, setReady] = useState(false)
  const activeProfileId = useAppStore((s) => s.activeProfileId)

  useEffect(() => {
    ensureExercisesSeeded().then(() => {
      setReady(true)
      void ensureExercisePhotosSeeded()
    })
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
        <Route path="/workout/ladder/:routineId" element={<LadderWorkout />} />
        <Route path="/workout/ladder/session/:sessionId" element={<LadderWorkout />} />

        <Route element={<RequireProfile />}>
          <Route element={<AppShell />}>
            <Route path="/home" element={<Home />} />
            <Route path="/workout/start" element={<StartWorkout />} />
            <Route path="/workout/routines/new" element={<RoutineBuilder />} />
            <Route path="/workout/routines/ai" element={<AiProgram />} />
            <Route path="/workout/routines/:routineId/edit" element={<RoutineBuilder />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:sessionId" element={<HistoryDetail />} />
            <Route path="/history/cardio/:sessionId" element={<CardioDetail />} />
            <Route path="/food" element={<Nutrition />} />
            <Route
              path="/progress"
              element={
                <Suspense fallback={null}>
                  <Progress />
                </Suspense>
              }
            />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
