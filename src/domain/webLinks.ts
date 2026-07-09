/**
 * Web-link domain operations, ported from the Rails WebLink model plus the
 * link/action-item conversion round trip in the controllers.
 */
import { nowIso, todayKey } from '@/lib/dates'
import type { ActionItemDoc, WebLinkDoc } from '@/types/domain'
import { createActionItem, createWebLink } from './factories'

// Re-exported so link/thought callers have one import site for the day default.
export { enforceDefaultDayParent } from './parent'

/** Rails `String#truncate`: keep the whole string, or `n - 3` chars plus `...`. */
function rubyTruncate(text: string, length: number): string {
  if (text.length <= length) {
    return text
  }
  return text.slice(0, length - 3) + '...'
}

/** Whitespace-only, empty, or absent counts as blank (Rails `blank?`). */
function isBlank(value: string | undefined): boolean {
  return value == null || value.trim() === ''
}

/**
 * Display label: the name, or -- when the name is blank and a url is present --
 * the url truncated to 50 characters (`name_display`).
 */
export function nameDisplay(link: WebLinkDoc): string {
  if (isBlank(link.name) && !isBlank(link.url)) {
    return rubyTruncate(link.url, 50)
  }
  return link.name ?? ''
}

/**
 * Convert a standalone web link into an action item (`from_web_link` +
 * `save_related`, then destroy the original). The new action item keeps the
 * link's parent and gains a child link (blank name, same url); the original link
 * is deleted. Caller persists the returned docs.
 */
export function toActionItem(
  link: WebLinkDoc,
  opts: {
    deviceId: string
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
      deviceId: opts.deviceId
    },
    now,
    opts.itemId
  )
  const childLink = createWebLink(
    {
      name: '',
      url: link.url,
      parentType: 'action_item',
      parentKey: item.id,
      deviceId: opts.deviceId
    },
    now,
    opts.linkId,
    today
  )
  return { item, link: childLink, deleteWebLinkId: link.id }
}

/**
 * Convert an action item back into a standalone web link (`from_action_item`,
 * then destroy the item and its links). The new link takes the item's name, the
 * url of the item's first link, and the item's parent. Requires at least one
 * link. Caller persists.
 */
export function fromActionItem(
  item: ActionItemDoc,
  links: WebLinkDoc[],
  opts: { deviceId: string; now?: string; linkId?: string; today?: string }
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
      deviceId: opts.deviceId
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
