/**
 * Web links attached to a parent (project / action item / question), with an
 * inline add-link form, per-row delete, and the "To Action Item" conversion
 *. Links are ordered createdAt DESC via the
 * Parentable `forParent`.
 */
import { useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { createWebLink } from '@/domain/factories'
import { linkLabel } from '@/domain/webLinks'
import { forParent } from '@/domain/parent'
import { getClientId } from '@interop/was-react'
import { useWebLinks } from '@/stores/entities/webLinks'
import { convertLinkToActionItem } from '@/stores/entityActions'
import type { ParentType } from '@/types/domain'

export function LinksTable({
  parentType,
  parentKey
}: {
  parentType: ParentType
  parentKey: string
}) {
  const byId = useWebLinks((s) => s.byId)
  const insert = useWebLinks((s) => s.insert)
  const remove = useWebLinks((s) => s.remove)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')

  const links = forParent([...byId.values()], parentType, parentKey)

  async function add() {
    if (url.trim() === '' && name.trim() === '') {
      return
    }
    await insert(
      createWebLink({
        url: url.trim(),
        name: name.trim() || undefined,
        parentType,
        parentKey,
        clientId: getClientId()
      })
    )
    setUrl('')
    setName('')
  }

  return (
    <Box data-testid="links-table">
      <Typography variant="subtitle2" gutterBottom>
        Links
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          label="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'link-url-input' } }}
        />
        <TextField
          size="small"
          label="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'link-name-input' } }}
        />
        <Button
          variant="outlined"
          onClick={() => void add()}
          data-testid="add-link"
        >
          Add Link
        </Button>
      </Stack>
      {links.length > 0 && (
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell>Link</TableCell>
              <TableCell align="right" sx={{ width: 200 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id} data-testid="link-row">
                <TableCell
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {link.url ? (
                    <Link href={link.url} target="_blank" rel="noreferrer">
                      {linkLabel(link)}
                    </Link>
                  ) : (
                    linkLabel(link)
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button
                    size="small"
                    onClick={() => void convertLinkToActionItem(link)}
                    data-testid="link-to-action-item"
                  >
                    To Action Item
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => void remove(link.id)}
                    data-testid="delete-link"
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
