/**
 * Web links index (ports `web_links#index`): an add-link box (standalone links
 * default onto today's day parent) and the links list, each with edit / delete
 * and the "To Action Item" conversion.
 */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link as RouterLink } from 'react-router'
import {
  Box,
  Button,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { createWebLink } from '@/domain/factories'
import { nameDisplay } from '@/domain/webLinks'
import { compareChildren } from '@/domain/sort'
import { getClientId } from '@interop/was-react'
import { useWebLinks } from '@/stores/entities/webLinks'
import { convertLinkToActionItem } from '@/stores/entityActions'

export function WebLinksIndexPage() {
  const links = useWebLinks(useShallow((s) => [...s.byId.values()].sort(compareChildren)))
  const insert = useWebLinks((s) => s.insert)
  const remove = useWebLinks((s) => s.remove)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')

  async function add() {
    if (url.trim() === '' && name.trim() === '') {
      return
    }
    await insert(
      createWebLink({
        url: url.trim(),
        name: name.trim() || undefined,
        clientId: getClientId()
      })
    )
    setUrl('')
    setName('')
  }

  return (
    <Box data-testid="web-links-index-page">
      <Typography variant="h4" gutterBottom>
        Web Links
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'weblink-url-input' } }}
        />
        <TextField
          size="small"
          label="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'weblink-name-input' } }}
        />
        <Button
          variant="contained"
          onClick={() => void add()}
          data-testid="add-weblink"
        >
          Add Link
        </Button>
      </Stack>
      {links.length === 0 ? (
        <Typography color="text.secondary">No links yet.</Typography>
      ) : (
        <Table size="small">
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id} data-testid="weblink-row">
                <TableCell>
                  {link.url ? (
                    <Link href={link.url} target="_blank" rel="noreferrer">
                      {nameDisplay(link)}
                    </Link>
                  ) : (
                    nameDisplay(link)
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => void convertLinkToActionItem(link)}
                    data-testid="weblink-to-action-item"
                  >
                    To Action Item
                  </Button>
                  <IconButton
                    size="small"
                    component={RouterLink}
                    to={`/web-links/${link.id}/edit`}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => void remove(link.id)}
                    data-testid="delete-weblink"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
