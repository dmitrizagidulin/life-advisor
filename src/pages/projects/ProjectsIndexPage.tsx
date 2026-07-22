/**
 * Projects index: a new-project quick box then the
 * Active / Someday / Ideas groups, each sorted by the project comparator.
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link as RouterLink } from 'react-router'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { createProject } from '@/domain/factories'
import { allForStatus } from '@/domain/queries'
import { compareProjects } from '@/domain/sort'
import { getClientId } from '@interop/was-react'
import { useProjects } from '@/stores/entities/projects'
import { ProjectListTable } from '@/components/ProjectListTable'

export function ProjectsIndexPage() {
  const projects = useProjects(useShallow((s) => [...s.byId.values()]))
  const insert = useProjects((s) => s.insert)
  const [name, setName] = useState('')

  async function add() {
    if (name.trim() === '') {
      return
    }
    await insert(
      createProject({ name: name.trim(), area: 'soul', clientId: getClientId() })
    )
    setName('')
  }

  const group = (status: 'active' | 'someday' | 'idea') =>
    allForStatus(projects, status).sort(compareProjects)

  return (
    <Box data-testid="projects-index-page">
      <Typography variant="h4" gutterBottom>
        Projects
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="New project"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void add()
            }
          }}
          slotProps={{ htmlInput: { 'data-testid': 'new-project-input' } }}
        />
        <Button
          variant="contained"
          onClick={() => void add()}
          data-testid="add-project"
        >
          Add Project
        </Button>
      </Stack>

      <Typography variant="h6">Active</Typography>
      <ProjectListTable projects={group('active')} />

      <Typography variant="h6" sx={{ mt: 3 }}>
        Someday / Maybe
      </Typography>
      <ProjectListTable projects={group('someday')} />

      <Typography variant="h6" sx={{ mt: 3 }}>
        Ideas / Hopper
      </Typography>
      <ProjectListTable projects={group('idea')} />

      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        <Button component={RouterLink} to="/projects/completed" size="small">
          Completed
        </Button>
        <Button component={RouterLink} to="/projects/canceled" size="small">
          Canceled
        </Button>
        <Button component={RouterLink} to="/projects/new" size="small" variant="outlined">
          New Project
        </Button>
      </Stack>
    </Box>
  )
}
