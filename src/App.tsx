/**
 * App root: theme + CssBaseline, the HashRouter, and the lazy-loaded route
 * table. Everything renders inside the `AppShell` layout (so even the login
 * page carries the app's identity and navigation); the login page sits outside
 * the gate, while every other route renders behind the library's
 * `ProtectedRoute` (from `@interop/was-react/mui`), which redirects a
 * not-connected visitor to `/login`.
 */
import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import {
  Box,
  CircularProgress,
  CssBaseline,
  ThemeProvider
} from '@mui/material'
import { ProtectedRoute } from '@interop/was-react/mui'
import { theme } from '@/themes/theme'
import { AppShell } from '@/components/AppShell'

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage }))
)
const ActionItemsAllPage = lazy(() =>
  import('@/pages/actionItems/ActionItemsAllPage').then(m => ({
    default: m.ActionItemsAllPage
  }))
)
const ActionItemsCompletedPage = lazy(() =>
  import('@/pages/actionItems/ActionItemsCompletedPage').then(m => ({
    default: m.ActionItemsCompletedPage
  }))
)
const ActionItemShowPage = lazy(() =>
  import('@/pages/actionItems/ActionItemShowPage').then(m => ({
    default: m.ActionItemShowPage
  }))
)
const ActionItemFormPage = lazy(() =>
  import('@/pages/actionItems/ActionItemFormPage').then(m => ({
    default: m.ActionItemFormPage
  }))
)
const ProjectsIndexPage = lazy(() =>
  import('@/pages/projects/ProjectsIndexPage').then(m => ({
    default: m.ProjectsIndexPage
  }))
)
const ProjectsStatusPage = lazy(() =>
  import('@/pages/projects/ProjectsStatusPage').then(m => ({
    default: m.ProjectsStatusPage
  }))
)
const ProjectShowPage = lazy(() =>
  import('@/pages/projects/ProjectShowPage').then(m => ({
    default: m.ProjectShowPage
  }))
)
const ProjectSetGoalsPage = lazy(() =>
  import('@/pages/projects/ProjectSetGoalsPage').then(m => ({
    default: m.ProjectSetGoalsPage
  }))
)
const ProjectFormPage = lazy(() =>
  import('@/pages/projects/ProjectFormPage').then(m => ({
    default: m.ProjectFormPage
  }))
)
const GoalsIndexPage = lazy(() =>
  import('@/pages/goals/GoalsIndexPage').then(m => ({
    default: m.GoalsIndexPage
  }))
)
const GoalShowPage = lazy(() =>
  import('@/pages/goals/GoalShowPage').then(m => ({ default: m.GoalShowPage }))
)
const GoalFormPage = lazy(() =>
  import('@/pages/goals/GoalFormPage').then(m => ({ default: m.GoalFormPage }))
)
const QuestionsIndexPage = lazy(() =>
  import('@/pages/questions/QuestionsIndexPage').then(m => ({
    default: m.QuestionsIndexPage
  }))
)
const QuestionShowPage = lazy(() =>
  import('@/pages/questions/QuestionShowPage').then(m => ({
    default: m.QuestionShowPage
  }))
)
const QuestionFormPage = lazy(() =>
  import('@/pages/questions/QuestionFormPage').then(m => ({
    default: m.QuestionFormPage
  }))
)
const AnswerFormPage = lazy(() =>
  import('@/pages/answers/AnswerFormPage').then(m => ({
    default: m.AnswerFormPage
  }))
)
const ThoughtsIndexPage = lazy(() =>
  import('@/pages/thoughts/ThoughtsIndexPage').then(m => ({
    default: m.ThoughtsIndexPage
  }))
)
const ThoughtShowPage = lazy(() =>
  import('@/pages/thoughts/ThoughtShowPage').then(m => ({
    default: m.ThoughtShowPage
  }))
)
const ThoughtFormPage = lazy(() =>
  import('@/pages/thoughts/ThoughtFormPage').then(m => ({
    default: m.ThoughtFormPage
  }))
)
const WebLinksIndexPage = lazy(() =>
  import('@/pages/webLinks/WebLinksIndexPage').then(m => ({
    default: m.WebLinksIndexPage
  }))
)
const WebLinkShowPage = lazy(() =>
  import('@/pages/webLinks/WebLinkShowPage').then(m => ({
    default: m.WebLinkShowPage
  }))
)
const WebLinkFormPage = lazy(() =>
  import('@/pages/webLinks/WebLinkFormPage').then(m => ({
    default: m.WebLinkFormPage
  }))
)
const FocusAreaPage = lazy(() =>
  import('@/pages/FocusAreaPage').then(m => ({ default: m.FocusAreaPage }))
)
const HistoryPage = lazy(() =>
  import('@/pages/HistoryPage').then(m => ({ default: m.HistoryPage }))
)
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage }))
)

function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  )
}

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute loginPath="/login" />}>
                <Route index element={<DashboardPage />} />
                <Route
                  path="action-items/all"
                  element={<ActionItemsAllPage />}
                />
                <Route
                  path="action-items/completed"
                  element={<ActionItemsCompletedPage />}
                />
                <Route
                  path="action-items/new"
                  element={<ActionItemFormPage mode="new" />}
                />
                <Route
                  path="action-items/:id"
                  element={<ActionItemShowPage />}
                />
                <Route
                  path="action-items/:id/edit"
                  element={<ActionItemFormPage mode="edit" />}
                />
                <Route path="projects" element={<ProjectsIndexPage />} />
                <Route
                  path="projects/completed"
                  element={<ProjectsStatusPage status="completed" />}
                />
                <Route
                  path="projects/canceled"
                  element={<ProjectsStatusPage status="canceled" />}
                />
                <Route
                  path="projects/new"
                  element={<ProjectFormPage mode="new" />}
                />
                <Route path="projects/:id" element={<ProjectShowPage />} />
                <Route
                  path="projects/:id/edit"
                  element={<ProjectFormPage mode="edit" />}
                />
                <Route
                  path="projects/:id/set-goals"
                  element={<ProjectSetGoalsPage />}
                />
                <Route path="goals" element={<GoalsIndexPage />} />
                <Route path="goals/new" element={<GoalFormPage mode="new" />} />
                <Route path="goals/:id" element={<GoalShowPage />} />
                <Route
                  path="goals/:id/edit"
                  element={<GoalFormPage mode="edit" />}
                />
                <Route path="questions" element={<QuestionsIndexPage />} />
                <Route
                  path="questions/new"
                  element={<QuestionFormPage mode="new" />}
                />
                <Route path="questions/:id" element={<QuestionShowPage />} />
                <Route
                  path="questions/:id/edit"
                  element={<QuestionFormPage mode="edit" />}
                />
                <Route
                  path="answers/new"
                  element={<AnswerFormPage mode="new" />}
                />
                <Route
                  path="answers/:id/edit"
                  element={<AnswerFormPage mode="edit" />}
                />
                <Route path="thoughts" element={<ThoughtsIndexPage />} />
                <Route
                  path="thoughts/new"
                  element={<ThoughtFormPage mode="new" />}
                />
                <Route path="thoughts/:id" element={<ThoughtShowPage />} />
                <Route
                  path="thoughts/:id/edit"
                  element={<ThoughtFormPage mode="edit" />}
                />
                <Route path="web-links" element={<WebLinksIndexPage />} />
                <Route
                  path="web-links/new"
                  element={<WebLinkFormPage mode="new" />}
                />
                <Route path="web-links/:id" element={<WebLinkShowPage />} />
                <Route
                  path="web-links/:id/edit"
                  element={<WebLinkFormPage mode="edit" />}
                />
                <Route path="focus/:area" element={<FocusAreaPage />} />
                <Route path="history" element={<HistoryPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </ThemeProvider>
  )
}
