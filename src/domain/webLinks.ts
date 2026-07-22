/**
 * Web-link domain operations, including the link/action-item conversion round
 * trip.
 */
import { nowIso, todayKey } from '@/lib/dates'
import type { ActionItemDoc, WebLinkDoc } from '@/types/domain'
import { createActionItem, createWebLink } from './factories'

// Re-exported so link/thought callers have one import site for the day default.
export { enforceDefaultDayParent } from './parent'

/** Whitespace-only, empty, or absent counts as blank. */
function isBlank(value: string | undefined): boolean {
  return value == null || value.trim() === ''
}

/**
 * Display label: the name, or the url when the name is blank. Overflow is the
 * renderer's concern (CSS ellipsis), so the url is returned untruncated.
 */
export function linkLabel(link: WebLinkDoc): string {
  if (isBlank(link.name) && !isBlank(link.url)) {
    return link.url
  }
  return link.name ?? ''
}

/**
 * Convert a standalone web link into an action item. The new action item keeps
 * the link's parent and gains a child link (blank name, same url); the original
 * link is deleted. Caller persists the returned docs.
 */
export function toActionItem(
  link: WebLinkDoc,
  opts: {
    clientId: string
    now?: string
    itemId?: string
    linkId?: string
    today?: string
  }
): { item: ActionItemDoc; link: WebLinkDoc; deleteWebLinkId: string } {
  const now = opts.now ?? nowIso()
  const today = opts.today ?? todayKey()
  const item = createActionItem(
    {
      name: link.name ?? '',
      parentType: link.parentType,
      parentKey: link.parentKey,
      clientId: opts.clientId
    },
    now,
    opts.itemId
  )
  const childLink = createWebLink(
    {
      name: '',
      url: link.url,
      parentType: 'actionItem',
      parentKey: item.id,
      clientId: opts.clientId
    },
    now,
    opts.linkId,
    today
  )
  return { item, link: childLink, deleteWebLinkId: link.id }
}

/**
 * Convert an action item back into a standalone web link; the item and its
 * links are deleted. The new link takes the item's name, the url of the item's
 * first link, and the item's parent. Requires at least one link. Caller
 * persists.
 */
export function fromActionItem(
  item: ActionItemDoc,
  links: WebLinkDoc[],
  opts: { clientId: string; now?: string; linkId?: string; today?: string }
): {
  link: WebLinkDoc
  deleteActionItemId: string
  deleteWebLinkIds: string[]
} {
  const first = links[0]
  if (!first) {
    throw new Error('Cannot convert an action item with no links to a link')
  }
  const now = opts.now ?? nowIso()
  const link = createWebLink(
    {
      name: item.name,
      url: first.url,
      parentType: item.parentType,
      parentKey: item.parentKey,
      clientId: opts.clientId
    },
    now,
    opts.linkId,
    opts.today ?? todayKey()
  )
  return {
    link,
    deleteActionItemId: item.id,
    deleteWebLinkIds: links.map((l) => l.id)
  }
}
