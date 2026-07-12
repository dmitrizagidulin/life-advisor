/**
 * Project detail (ports `projects#show`): next action, status-machine buttons,
 * goals served, inline add-question and add-action-item, the todo and completed
 * item tables, the links table, and "Make Current Focus". All computed values
 * come from the domain layer (`nextAction`, `timeElapsed`, `changeStatus`).
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link as RouterLink, useParams } from 'react-router'
import {
  Box,
  Button,
  Collapse,
  Divider,
  Link,
  Stack,
  Table,
  TableBody,
  TextField,
  Typography
} from '@mui/material'
import { createActionItem, createQuestion, createWebLink } from '@/domain/factories'
import { changeStatus, nextAction, timeElapsed } from '@/domain/projects'
import { isChildOf } from '@/domain/parent'
import {
  compareActionItems,
  compareQuestions,
  sortActionItemsCompletedDesc
} from '@/domain/sort'
import { formatTimestamp } from '@/lib/dates'
import { getDeviceId } from '@/stores/storageManager'
import { useProjects } from '@/stores/entities/projects'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import { useQuestions } from '@/stores/entities/questions'
import { useGoals } from '@/stores/entities/goals'
import { useFocus } from '@/stores/entities/focus'
import { StatusButtons } from '@/components/StatusButtons'
import { EntityShowHeader } from '@/components/EntityShowHeader'
import { NotFound } from '@/components/NotFound'
import { LinksTable } from '@/components/LinksTable'
import { QuestionList } from '@/components/QuestionList'
import { ActionItemRow } from '@/components/ActionItemRow'
import { AREA_COLORS } from '@/themes/theme'
import type { ProjectStatus } from '@/types/domain'

export function ProjectShowPage() {
  const { id } = useParams()
  const project = useProjects((s) => (id ? s.byId.get(id) : undefined))
  const updateProject = useProjects((s) => s.update)
  const allItems = useActionItems(useShallow((s) => [...s.byId.values()]))
  const insertItem = useActionItems((s) => s.insert)
  const insertLink = useWebLinks((s) => s.insert)
  const allQuestions = useQuestions(useShallow((s) => [...s.byId.values()]))
  const insertQuestion = useQuestions((s) => s.insert)
  const goals = useGoals(useShallow((s) => [...s.byId.values()]))
  const setFocus = useFocus((s) => s.setFocus)

  const [questionName, setQuestionName] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemUrl, setItemUrl] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  if (!project) {
    return <NotFound label="Project" />
  }

  const projectItems = allItems.filter(isChildOf('project', project.id))
  const todoItems = projectItems.filter((i) => !i.done).sort(compareActionItems)
  const completedItems = sortActionItemsCompletedDesc(
    projectItems.filter((i) => i.done)
  )
  const next = nextAction(project, allItems)
  const questions = allQuestions
    .filter(isChildOf('project', project.id))
    .sort(compareQuestions)
  const goalsServed = goals.filter((g) => project.goalIds.includes(g.id))

  function setStatus(status: ProjectStatus) {
    void updateProject(changeStatus(project!, status))
  }

  async function addQuestion() {
    if (questionName.trim() === '') {
      return
    }
    await insertQuestion(
      createQuestion({
        name: questionName.trim(),
        parentType: 'project',
        parentKey: project!.id,
        deviceId: getDeviceId()
      })
    )
    setQuestionName('')
  }

  async function addItem() {
    if (itemName.trim() === '') {
      return
    }
    const item = createActionItem({
      name: itemName.trim(),
      mywnCategory: 'someday',
      area: project!.area,
      parentType: 'project',
      parentKey: project!.id,
      deviceId: getDeviceId()
    })
    await insertItem(item)
    if (itemUrl.trim() !== '') {
      await insertLink(
        createWebLink({
          url: itemUrl.trim(),
          parentType: 'action_item',
          parentKey: item.id,
          deviceId: getDeviceId()
        })
      )
    }
    setItemName('')
    setItemUrl('')
  }

  return (
    <Box data-testid="project-show-page">
      <EntityShowHeader
        backTo="/projects"
        backLabel="Projects"
        editTo={`/projects/${project.id}/edit`}
        extras={
          <Button
            size="small"
            variant="contained"
            onClick={() => void setFocus('project', project.id)}
            data-testid="make-current-focus"
          >
            Make Current Focus
          </Button>
        }
      />

      <Typography variant="h4" sx={{ color: AREA_COLORS[project.area] }}>
        {project.name}
      </Typography>

      <Stack spacing={0.5} sx={{ my: 2 }}>
        <Typography>
          Action:{' '}
          {next ? (
            <Link component={RouterLink} to={`/action-items/${next.id}`}>
              {next.name}
            </Link>
          ) : (
            '-'
          )}
        </Typography>
        {project.url && (
          <Typography>
            URL:{' '}
            <Link href={project.url} target="_blank" rel="noreferrer">
              {project.url}
            </Link>
          </Typography>
        )}
        {project.description && (
          <Typography>Description: {project.description}</Typography>
        )}
        <Typography>
          Complete: {completedItems.length} / {projectItems.length} action items
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography data-testid="project-status">
            Status: {project.status}
          </Typography>
          <StatusButtons status={project.status} onChange={setStatus} />
        </Stack>
        {project.status === 'completed' && project.completedAt && (
          <Typography variant="body2" color="success.main" data-testid="project-completed-at">
            Completed {formatTimestamp(project.completedAt)}
          </Typography>
        )}
        {project.status === 'canceled' && project.canceledAt && (
          <Typography variant="body2" color="text.secondary" data-testid="project-canceled-at">
            Canceled {formatTimestamp(project.canceledAt)}
          </Typography>
        )}
        <Typography>Area: {project.area}</Typography>
        <Typography>Bumped: {project.bumpCount} times</Typography>
        <Typography>Elapsed Time: {timeElapsed(projectItems)} hrs</Typography>
      </Stack>

      <Divider sx={{ my: 2 }} />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="h6">Life Goals Served</Typography>
        <Button
          size="small"
          component={RouterLink}
          to={`/projects/${project.id}/set-goals`}
          data-testid="set-goals"
        >
          Set Goals
        </Button>
      </Stack>
      {goalsServed.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None
        </Typography>
      ) : (
        goalsServed.map((g) => (
          <Typography key={g.id}>
            <Link component={RouterLink} to={`/goals/${g.id}`}>
              {g.name}
            </Link>
          </Typography>
        ))
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6">Questions</Typography>
      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <TextField
          size="small"
          label="New question"
          value={questionName}
          onChange={(e) => setQuestionName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'new-question-input' } }}
        />
        <Button
          variant="outlined"
          onClick={() => void addQuestion()}
          data-testid="add-question"
        >
          Add Question
        </Button>
      </Stack>
      <QuestionList questions={questions} />

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6">Action Items</Typography>
      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <TextField
          size="small"
          label="New action item"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'new-project-item-input' } }}
        />
        <TextField
          size="small"
          label="url (optional)"
          value={itemUrl}
          onChange={(e) => setItemUrl(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'new-project-item-url' } }}
        />
        <Button
          variant="contained"
          onClick={() => void addItem()}
          data-testid="add-project-item"
        >
          Add Item
        </Button>
      </Stack>

      {completedItems.length > 0 && (
        <>
          <Button
            size="small"
            onClick={() => setShowCompleted((v) => !v)}
            data-testid="reveal-completed"
          >
            {completedItems.length} completed items
          </Button>
          <Collapse in={showCompleted}>
            <Table size="small">
              <TableBody>
                {completedItems.map((item) => (
                  <ActionItemRow key={item.id} item={item} />
                ))}
              </TableBody>
            </Table>
          </Collapse>
        </>
      )}

      {todoItems.length > 0 && (
        <Table size="small">
          <TableBody>
            {todoItems.map((item) => (
              <ActionItemRow key={item.id} item={item} />
            ))}
          </TableBody>
        </Table>
      )}

      <Divider sx={{ my: 2 }} />
      <LinksTable parentType="project" parentKey={project.id} />
    </Box>
  )
}
