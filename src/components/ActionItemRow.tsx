/**
 * One action item as a table row (ports `action_items/_action_item` +
 * `_action_item_category_buttons`): done checkbox, name link, area-colored,
 * inline category-move buttons, bump, child links, and the item-to-link
 * conversion + cascade delete. Domain operations come from `domain/*`; this row
 * only wires them to the store.
 */
import { Link as RouterLink } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  IconButton,
  Link,
  Stack,
  TableCell,
  TableRow,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { nowIso } from '@/lib/dates'
import { MYWN_CATEGORIES } from '@/types/domain'
import { bump, toggleDone } from '@/domain/actionItems'
import { forParent } from '@/domain/parent'
import { nameDisplay } from '@/domain/webLinks'
import { AREA_COLORS } from '@/themes/theme'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import {
  convertActionItemToLink,
  deleteActionItemCascade
} from '@/stores/entityActions'
import type { ActionItemDoc, MywnCategory } from '@/types/domain'

export function ActionItemRow({ item }: { item: ActionItemDoc }) {
  const update = useActionItems((s) => s.update)
  const links = useWebLinks(useShallow((s) =>
    forParent([...s.byId.values()], 'action_item', item.id)
  ))

  function setCategory(category: MywnCategory) {
    void update({ ...item, mywnCategory: category, updatedAt: nowIso() })
  }

  return (
    <TableRow data-testid="action-item-row" data-item-name={item.name}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={item.done}
          onChange={() => void update(toggleDone(item))}
          data-testid="toggle-done"
        />
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {item.parentType === 'project' && item.parentKey && (
            <Link
              component={RouterLink}
              to={`/projects/${item.parentKey}`}
              variant="caption"
            >
              [proj]
            </Link>
          )}
          <Link
            component={RouterLink}
            to={`/action-items/${item.id}`}
            sx={{
              color: AREA_COLORS[item.area],
              textDecoration: item.done ? 'line-through' : 'none'
            }}
          >
            {item.name}
          </Link>
        </Stack>
        {links.length > 0 && (
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {links.map((link) => (
              <li key={link.id}>
                <Link href={link.url} target="_blank" rel="noreferrer">
                  {nameDisplay(link)}
                </Link>
              </li>
            ))}
          </Box>
        )}
        {item.description && (
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        )}
        {item.timeElapsed > 0 && (
          <Typography variant="caption" color="text.secondary">
            Elapsed: {item.timeElapsed} hrs
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <ButtonGroup size="small" data-testid="category-buttons">
          {MYWN_CATEGORIES.map((category) => (
            <Button
              key={category}
              variant={item.mywnCategory === category ? 'contained' : 'outlined'}
              disabled={item.mywnCategory === category}
              onClick={() => setCategory(category)}
              data-testid={`category-${category}`}
            >
              {category}
            </Button>
          ))}
        </ButtonGroup>
      </TableCell>
      <TableCell>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void update(bump(item))}
          data-testid="bump-item"
        >
          Bump!{item.bumpCount > 0 ? ` (${item.bumpCount})` : ''}
        </Button>
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            component={RouterLink}
            to={`/action-items/${item.id}/edit`}
            data-testid="edit-item"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          {links.length > 0 && (
            <Button
              size="small"
              onClick={() => void convertActionItemToLink(item)}
              data-testid="item-to-link"
            >
              To Link
            </Button>
          )}
          <IconButton
            size="small"
            color="error"
            onClick={() => void deleteActionItemCascade(item)}
            data-testid="delete-item"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  )
}
