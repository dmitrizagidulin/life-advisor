/**
 * Project status-machine buttons (ports `projects/_status_buttons_*`). The
 * available transitions depend on the current status; each calls back with the
 * target status, which the caller feeds to `domain/projects.changeStatus`.
 */
import { ButtonGroup, Button } from '@mui/material'
import type { ProjectStatus } from '@/types/domain'

const TRANSITIONS: Record<
  ProjectStatus,
  Array<{ label: string; to: ProjectStatus }>
> = {
  idea: [
    { label: 'Accept', to: 'someday' },
    { label: 'Done!', to: 'completed' },
    { label: 'Cancel', to: 'canceled' }
  ],
  active: [
    { label: 'Done!', to: 'completed' },
    { label: 'Later', to: 'someday' },
    { label: 'Cancel', to: 'canceled' }
  ],
  someday: [
    { label: 'Focus', to: 'active' },
    { label: 'Done!', to: 'completed' },
    { label: 'Cancel', to: 'canceled' }
  ],
  canceled: [
    { label: 'Back to Maybe', to: 'someday' },
    { label: 'Back to Idea', to: 'idea' }
  ],
  completed: [
    { label: 'Not Done!', to: 'active' },
    { label: 'Cancel', to: 'canceled' }
  ]
}

export function StatusButtons({
  status,
  onChange
}: {
  status: ProjectStatus
  onChange: (status: ProjectStatus) => void
}) {
  return (
    <ButtonGroup size="small" data-testid="status-buttons">
      {TRANSITIONS[status].map((t) => (
        <Button
          key={t.to}
          onClick={() => onChange(t.to)}
          data-testid={`status-to-${t.to}`}
        >
          {t.label}
        </Button>
      ))}
    </ButtonGroup>
  )
}
