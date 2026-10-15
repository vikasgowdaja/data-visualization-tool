import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import RequireAdminRoute from './components/RequireAdminRoute'
import { ROUTES } from './constants/routes'
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
<<<<<<< HEAD
  { to: ROUTES.DASHBOARD, label: 'Dashboard' },
  { to: ROUTES.LEARN, label: 'Learn' },
  { to: ROUTES.DATASETS, label: 'Datasets' },
  { to: ROUTES.DATA_EXPLORER, label: 'Data Explorer' },
  { to: ROUTES.DATA_CLEANING_LAB, label: 'Data Cleaning Lab' },
  { to: ROUTES.VISUALIZATION_LAB, label: 'Visualization Lab' },
  { to: ROUTES.STATISTICS_LAB, label: 'Statistics Lab' },
  { to: ROUTES.INSIGHTS_LAB, label: 'Insights Lab' },
  { to: ROUTES.PRACTICE, label: 'Practice' },
  { to: ROUTES.CHALLENGES, label: 'Challenges' },
  { to: ROUTES.PROJECTS, label: 'Projects' },
  { to: ROUTES.LEARNING_PATH, label: 'Learning Path' },
  { to: ROUTES.RESOURCES, label: 'Resources' },
  { to: ROUTES.PROGRESS, label: 'Progress' },
  { to: ROUTES.LOGIN, label: 'Login Portal' },
  { to: ROUTES.TASK_ASSIGNMENT, label: 'Task Assignment' },
  { to: ROUTES.ADMIN_ASSIGNMENTS, label: 'Admin Dashboard' },
=======
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
>>>>>>> cf1483947e4a717dc2330f6f54b1dbfe96c4457d
]

export default function PlatformApp() {
  return (
    <BrowserRouter>
      <AppShell navItems={navItems}>
        <Suspense fallback={<div className="route-loading">Loading module...</div>}>
          <Routes>
            <Route path={ROUTES.HOME} element={<LandingPage />} />
            <Route path={ROUTES.HOME_REDIRECT} element={<Navigate to={ROUTES.HOME} replace />} />
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.LEARN} element={<LearnPage />} />
            <Route path={ROUTES.DATASETS} element={<DatasetsPage />} />
            <Route path={ROUTES.DATA_EXPLORER} element={<DataExplorerPage />} />
            <Route path={ROUTES.DATA_EXPLORER_LEGACY} element={<LegacyDataExplorerPage />} />
            <Route path={ROUTES.DATA_CLEANING_LAB} element={<DataCleaningLabPage />} />
            <Route path={ROUTES.VISUALIZATION_LAB} element={<VisualizationLabPage />} />
            <Route path={ROUTES.STATISTICS_LAB} element={<StatisticsLabPage />} />
            <Route path={ROUTES.INSIGHTS_LAB} element={<InsightsLabPage />} />
            <Route path={ROUTES.PRACTICE} element={<PracticePage />} />
            <Route path={ROUTES.CHALLENGES} element={<ChallengesPage />} />
            <Route path={ROUTES.PROJECTS} element={<ProjectsPage />} />
            <Route path={ROUTES.LEARNING_PATH} element={<LearningPathPage />} />
            <Route path={ROUTES.RESOURCES} element={<ResourcesPage />} />
            <Route path={ROUTES.PROGRESS} element={<ProgressPage />} />
            <Route path={ROUTES.LOGIN} element={<CommonLoginPage />} />
            <Route path={ROUTES.STUDENT_LOGIN} element={<StudentLoginPage />} />
            <Route path={ROUTES.TASK_ASSIGNMENT} element={<TaskAssignmentPage />} />
            <Route path={ROUTES.ADMIN_LOGIN} element={<AdminLoginPage />} />
            <Route
              path={ROUTES.ADMIN_ASSIGNMENTS}
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
