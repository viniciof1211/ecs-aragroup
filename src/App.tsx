import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Loader2 } from 'lucide-react'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const LeadExplorer = lazy(() => import('@/pages/LeadExplorer'))
const LeadProfile = lazy(() => import('@/pages/LeadProfile'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Automation = lazy(() => import('@/pages/Automation'))
const ABTesting = lazy(() => import('@/pages/ABTesting'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<LeadExplorer />} />
          <Route path="/leads/:id" element={<LeadProfile />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/ab-testing" element={<ABTesting />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
