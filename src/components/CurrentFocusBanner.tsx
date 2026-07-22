/**
 * The current-focus banner, shown only when a non-default focus is set
 * (`nonDefaultFocusExists`). It names the focused entity (or day) and offers a
 * reset back to today's default. The link targets the entity's show page.
 */
import { Link as RouterLink } from 'react-router'
import { Alert, Button, Link } from '@mui/material'
import { currentFocus, nonDefaultFocusExists } from '@/domain/focus'
import { useFocus } from '@/stores/entities/focus'
import { useProjects } from '@/stores/entities/projects'
import { useActionItems } from '@/stores/entities/actionItems'
import { useGoals } from '@/stores/entities/goals'
import { useQuestions } from '@/stores/entities/questions'
import type { ResolvedFocus } from '@/domain/focus'

function useFocusLabel(
  focus: ResolvedFocus
): { text: string; to: string | null } {
  const projects = useProjects((s) => s.byId)
  const items = useActionItems((s) => s.byId)
  const goals = useGoals((s) => s.byId)
  const questions = useQuestions((s) => s.byId)
  switch (focus.focusType) {
    case 'project': {
      const p = projects.get(focus.focusKey)
      return { text: p ? p.name : 'a project', to: `/projects/${focus.focusKey}` }
    }
    case 'actionItem': {
      const i = items.get(focus.focusKey)
      return {
        text: i ? i.name : 'an action item',
        to: `/action-items/${focus.focusKey}`
      }
    }
    case 'goal': {
      const g = goals.get(focus.focusKey)
      return { text: g ? g.name : 'a goal', to: `/goals/${focus.focusKey}` }
    }
    case 'question': {
      const q = questions.get(focus.focusKey)
      return {
        text: q ? q.name : 'a question',
        to: `/questions/${focus.focusKey}`
      }
    }
    default:
      return { text: focus.focusKey, to: null }
  }
}

export function CurrentFocusBanner() {
  const doc = useFocus((s) => s.doc)
  const reset = useFocus((s) => s.reset)
  const focus = currentFocus(doc)
  const label = useFocusLabel(focus)

  if (!nonDefaultFocusExists(doc)) {
    return null
  }

  return (
    <Alert
      severity="info"
      data-testid="current-focus-banner"
      sx={{ mb: 2 }}
      action={
        <Button
          color="inherit"
          size="small"
          data-testid="reset-focus"
          onClick={() => void reset()}
        >
          Reset
        </Button>
      }
    >
      Current focus:{' '}
      {label.to ? (
        <Link component={RouterLink} to={label.to}>
          {label.text}
        </Link>
      ) : (
        label.text
      )}
    </Alert>
  )
}
