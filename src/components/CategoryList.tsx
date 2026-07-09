/**
 * One MYWN category block on the dashboard/focus screens (ports
 * `action_items/_category_list` + `_new`): a header with the item count (turning
 * red past the Rails thresholds), an inline add-item form (optional url attaches
 * a child link), the Tomorrow-only bulk category moves, and the item rows.
 * `items` arrive already filtered + sorted by the caller.
 */
import { useState } from 'react'
import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TextField,
  Typography
} from '@mui/material'
import { createActionItem, createWebLink } from '@/domain/factories'
import { categoryMove } from '@/domain/actionItems'
import { getDeviceId } from '@/stores/storageManager'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import { ActionItemRow } from './ActionItemRow'
import type { ActionItemDoc, Area, MywnCategory } from '@/types/domain'

function isOverThreshold(category: MywnCategory, count: number): boolean {
  return (
    (category === 'critical' && count > 5) ||
    (category === 'opportunity' && count > 20)
  )
}

export function CategoryList({
  category,
  items,
  focusArea
}: {
  category: MywnCategory
  items: ActionItemDoc[]
  focusArea: Area
}) {
  const insertItem = useActionItems((s) => s.insert)
  const updateItem = useActionItems((s) => s.update)
  const insertLink = useWebLinks((s) => s.insert)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  async function add() {
    const trimmed = name.trim()
    if (trimmed === '') {
      return
    }
    const item = createActionItem({
      name: trimmed,
      mywnCategory: category,
      area: focusArea,
      deviceId: getDeviceId()
    })
    await insertItem(item)
    if (url.trim() !== '') {
      await insertLink(
        createWebLink({
          url: url.trim(),
          parentType: 'action_item',
          parentKey: item.id,
          deviceId: getDeviceId()
        })
      )
    }
    setName('')
    setUrl('')
  }

  async function bulkMove(to: MywnCategory) {
    const { moved } = categoryMove(items, category, to)
    for (const doc of moved) {
      await updateItem(doc)
    }
  }

  return (
    <Box sx={{ mb: 3 }} data-testid={`category-list-${category}`}>
      <Typography
        variant="h6"
        sx={{ color: isOverThreshold(category, items.length) ? 'error.main' : undefined }}
      >
        {category.charAt(0).toUpperCase() + category.slice(1)} ({items.length})
      </Typography>
      <Stack direction="row" spacing={1} sx={{ my: 1, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="New item"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void add()
            }
          }}
          slotProps={{ htmlInput: { 'data-testid': `new-item-input-${category}` } }}
        />
        <TextField
          size="small"
          label="url (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          slotProps={{ htmlInput: { 'data-testid': `new-item-url-${category}` } }}
        />
        <Button
          variant="contained"
          onClick={() => void add()}
          data-testid={`add-item-${category}`}
        >
          Add Item
        </Button>
        {category === 'tomorrow' && items.length > 0 && (
          <>
            <Button
              variant="outlined"
              onClick={() => void bulkMove('critical')}
              data-testid="move-tomorrow-to-critical"
            >
              Move to Today
            </Button>
            <Button
              variant="outlined"
              onClick={() => void bulkMove('opportunity')}
              data-testid="move-tomorrow-to-opportunity"
            >
              Move to Opportunity
            </Button>
          </>
        )}
      </Stack>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {category === 'critical'
            ? 'You have triumphed Against The Day.'
            : 'No items for this category.'}
        </Typography>
      ) : (
        <Table size="small">
          <TableBody>
            {items.map((item) => (
              <ActionItemRow key={item.id} item={item} />
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}
