/**
 * The dashboard: the Pensieve capture box, the strip of active projects that
 * have a next action, and the five MYWN category lists with inline toggle /
 * category-move / bump. The `someday` list excludes parented (project) items.
 */
import { Typography } from '@mui/material'
import { useShallow } from 'zustand/react/shallow'
import { allTodo, allForStatus } from '@/domain/queries'
import { nextAction } from '@/domain/projects'
import { compareActionItems } from '@/domain/sort'
import { useActionItems } from '@/stores/entities/actionItems'
import { useProjects } from '@/stores/entities/projects'
import { NewThoughtBox } from '@/components/NewThoughtBox'
import { CategoryList } from '@/components/CategoryList'
import { ProjectCard } from '@/components/ProjectCard'
import type { MywnCategory } from '@/types/domain'

export function DashboardPage() {
  const items = useActionItems(useShallow((s) => [...s.byId.values()]))
  const projects = useProjects(useShallow((s) => [...s.byId.values()]))

  const todo = (category: MywnCategory, includeProjects = true) =>
    allTodo(items, category, undefined, includeProjects).sort(compareActionItems)

  const active = allForStatus(projects, 'active')
    .map((project) => ({ project, next: nextAction(project, items) }))
    .filter(({ next }) => next != null)

  return (
    <div data-testid="dashboard-page">
      <NewThoughtBox />

      <Typography variant="h5" align="center" gutterBottom>
        Active Projects
      </Typography>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {active.length === 0 ? (
          <Typography color="text.secondary">No active projects.</Typography>
        ) : (
          active.map(({ project, next }) => (
            <ProjectCard key={project.id} project={project} nextAction={next} />
          ))
        )}
      </div>

      <Typography variant="h5" align="center" gutterBottom>
        Action Items
      </Typography>
      <CategoryList category="critical" items={todo('critical')} focusArea="admin" />
      <CategoryList category="tomorrow" items={todo('tomorrow')} focusArea="admin" />
      <CategoryList
        category="opportunity"
        items={todo('opportunity')}
        focusArea="admin"
      />
      <CategoryList category="horizon" items={todo('horizon')} focusArea="admin" />
      <CategoryList
        category="someday"
        items={todo('someday', false)}
        focusArea="admin"
      />
    </div>
  )
}
