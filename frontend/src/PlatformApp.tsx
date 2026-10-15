import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import RequireAdminRoute from './components/RequireAdminRoute'
import './shell.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const LearnPage = lazy(() => import('./pages/LearnPage'))
const DatasetsPage = lazy(() => import('./pages/DatasetsPage'))
const DataExplorerPage = lazy(() => import('./pages/DataExplorerPage'))
const LegacyDataExplorerPage = lazy(() => import('./pages/LegacyDataExplorerPage'))
const DataCleaningLabPage = lazy(() => import('./pages/DataCleaningLabPage'))
const VisualizationLabPage = lazy(() => import('./pages/VisualizationLabPage'))
const StatisticsLabPage = lazy(() => import('./pages/StatisticsLabPage'))
const InsightsLabPage = lazy(() => import('./pages/InsightsLabPage'))
const PracticePage = lazy(() => import('./pages/PracticePage'))
const ChallengesPage = lazy(() => import('./pages/ChallengesPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'))
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const CommonLoginPage = lazy(() => import('./pages/CommonLoginPage'))
const TaskAssignmentPage = lazy(() => import('./pages/TaskAssignmentPage'))
const StudentLoginPage = lazy(() => import('./pages/StudentLoginPage'))
const AdminAssignmentsDashboardPage = lazy(() => import('./pages/AdminAssignmentsDashboardPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/learn', label: 'Learn' },
  { to: '/datasets', label: 'Datasets' },
  { to: '/data-explorer', label: 'Data Explorer' },
  { to: '/data-explorer/legacy', label: 'Legacy Workspace' },
  { to: '/data-cleaning-lab', label: 'Data Cleaning Lab' },
  { to: '/visualization-lab', label: 'Visualization Lab' },
  { to: '/statistics-lab', label: 'Statistics Lab' },
  { to: '/insights-lab', label: 'Insights Lab' },
  { to: '/practice', label: 'Practice' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/projects', label: 'Projects' },
  { to: '/learning-path', label: 'Learning Path' },
  { to: '/resources', label: 'Resources' },
  { to: '/progress', label: 'Progress' },
  { to: '/login', label: 'Login Portal' },
  { to: '/task-assignment', label: 'Task Assignment' },
  { to: '/admin-assignments', label: 'Admin Dashboard' },
]

export default function PlatformApp() {
  return (
    <BrowserRouter>
      <AppShell navItems={navItems}>
        <Suspense fallback={<div className="route-loading">Loading module...</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/datasets" element={<DatasetsPage />} />
            <Route path="/data-explorer" element={<DataExplorerPage />} />
            <Route path="/data-explorer/legacy" element={<LegacyDataExplorerPage />} />
            <Route path="/data-cleaning-lab" element={<DataCleaningLabPage />} />
            <Route path="/visualization-lab" element={<VisualizationLabPage />} />
            <Route path="/statistics-lab" element={<StatisticsLabPage />} />
            <Route path="/insights-lab" element={<InsightsLabPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/challenges" element={<ChallengesPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/learning-path" element={<LearningPathPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/login" element={<CommonLoginPage />} />
            <Route path="/student-login" element={<StudentLoginPage />} />
            <Route path="/task-assignment" element={<TaskAssignmentPage />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />
            <Route
              path="/admin-assignments"
              element={
                <RequireAdminRoute>
                  <AdminAssignmentsDashboardPage />
                </RequireAdminRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  )
}
