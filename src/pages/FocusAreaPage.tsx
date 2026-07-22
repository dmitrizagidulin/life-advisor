/**
 * Per-area planning screen: the area's active and someday projects plus the
 * area-filtered MYWN category lists. Critical is deliberately not area-filtered;
 * the rest filter by the route area, and someday excludes parented items.
 */
import { useParams } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { Typography } from '@mui/material'
import { AREAS } from '@/types/domain'
import { allTodo, focusOnArea } from '@/domain/queries'
import { compareActionItems, compareProjects } from '@/domain/sort'
import { useActionItems } from '@/stores/entities/actionItems'
import { useProjects } from '@/stores/entities/projects'
import { NewThoughtBox } from '@/components/NewThoughtBox'
import { CategoryList } from '@/components/CategoryList'
import { ProjectCard } from '@/components/ProjectCard'
import { nextAction } from '@/domain/projects'
import type { Area } from '@/types/domain'

function isArea(value: string | undefined): value is Area {
  return AREAS.includes(value as Area)
}

export function FocusAreaPage() {
  const { area } = useParams()
  const items = useActionItems(useShallow((s) => [...s.byId.values()]))
  const projects = useProjects(useShallow((s) => [...s.byId.values()]))

  if (!isArea(area)) {
    return <Typography>Unknown focus area.</Typography>
  }

  const activeProjects = focusOnArea(projects, area, 'active').sort(compareProjects)
  const somedayProjects = focusOnArea(projects, area, 'someday').sort(
    compareProjects
  )

  return (
    <div data-testid="focus-area-page">
      <Typography variant="h4" sx={{ mb: 2 }}>
        Focus! ({area.charAt(0).toUpperCase() + area.slice(1)})
      </Typography>
      <NewThoughtBox />

      <CategoryList
        category="critical"
        items={allTodo(items, 'critical').sort(compareActionItems)}
        focusArea={area}
      />
      <CategoryList
        category="opportunity"
        items={allTodo(items, 'opportunity', area).sort(compareActionItems)}
        focusArea={area}
      />
      <CategoryList
        category="horizon"
        items={allTodo(items, 'horizon', area).sort(compareActionItems)}
        focusArea={area}
      />
      <CategoryList
        category="someday"
        items={allTodo(items, 'someday', area, false).sort(compareActionItems)}
        focusArea={area}
      />

      <Typography variant="h5" sx={{ mt: 3 }}>
        Projects
      </Typography>
      {[...activeProjects, ...somedayProjects].map((p) => (
        <ProjectCard key={p.id} project={p} nextAction={nextAction(p, items)} />
      ))}
    </div>
  )
}
