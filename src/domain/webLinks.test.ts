/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { fromActionItem, linkLabel, toActionItem } from './webLinks'
import { createActionItem, createWebLink } from './factories'

const D = 'dev'
const NOW = '2026-07-06T12:00:00.000Z'
const TODAY = '2026-07-06'
const link = (o: Omit<Parameters<typeof createWebLink>[0], 'writerId'>) =>
  createWebLink({ ...o, writerId: D }, NOW, undefined, TODAY)

describe('linkLabel', () => {
  it('returns the name when present', () => {
    expect(linkLabel(link({ name: 'My Link', url: 'https://x.com' }))).toBe('My Link')
  })

  it('returns the full url when the name is blank', () => {
    const url = 'https://example.com/' + 'a'.repeat(80)
    expect(linkLabel(link({ name: '', url }))).toBe(url)
  })

  it('treats a whitespace-only name as blank', () => {
    expect(linkLabel(link({ name: '   ', url: 'https://x.com' }))).toBe('https://x.com')
  })
})

describe('toActionItem', () => {
  it('creates an item keeping the parent, plus a child link, and deletes the original', () => {
    const original = link({
      name: 'Read this',
      url: 'https://x.com/a',
      parentType: 'day',
      parentKey: TODAY
    })
    const { item, link: child, deleteWebLinkId } = toActionItem(original, {
      writerId: D,
      now: NOW,
      itemId: 'item-1',
      linkId: 'link-1'
    })
    expect(item.name).toBe('Read this')
    expect(item.parentType).toBe('day')
    expect(item.parentKey).toBe(TODAY)
    expect(child.url).toBe('https://x.com/a')
    expect(child.name).toBe('')
    expect(child.parentType).toBe('actionItem')
    expect(child.parentKey).toBe('item-1')
    expect(deleteWebLinkId).toBe(original.id)
  })
})

describe('fromActionItem', () => {
  it('creates a link from the item and its first link, deleting item and links', () => {
    const item = createActionItem(
      { writerId: D, name: 'A task', parentType: 'day', parentKey: TODAY },
      NOW,
      'item-1'
    )
    const l1 = createWebLink(
      { writerId: D, url: 'https://x.com/first', parentType: 'actionItem', parentKey: 'item-1' },
      NOW,
      'l1',
      TODAY
    )
    const l2 = createWebLink(
      { writerId: D, url: 'https://x.com/second', parentType: 'actionItem', parentKey: 'item-1' },
      NOW,
      'l2',
      TODAY
    )
    const { link: newLink, deleteActionItemId, deleteWebLinkIds } = fromActionItem(
      item,
      [l1, l2],
      { writerId: D, now: NOW }
    )
    expect(newLink.name).toBe('A task')
    expect(newLink.url).toBe('https://x.com/first')
    expect(newLink.parentType).toBe('day')
    expect(newLink.parentKey).toBe(TODAY)
    expect(deleteActionItemId).toBe('item-1')
    expect(deleteWebLinkIds).toEqual(['l1', 'l2'])
  })

  it('throws when the item has no links', () => {
    const item = createActionItem({ writerId: D, name: 'x' }, NOW)
    expect(() => fromActionItem(item, [], { writerId: D })).toThrow()
  })
})

describe('link/item round trip', () => {
  it('preserves the url through toActionItem then fromActionItem', () => {
    const original = link({ name: 'orig', url: 'https://x.com/keep', parentType: 'day', parentKey: TODAY })
    const forward = toActionItem(original, { writerId: D, now: NOW, itemId: 'item-1' })
    const back = fromActionItem(forward.item, [forward.link], { writerId: D, now: NOW })
    expect(back.link.url).toBe('https://x.com/keep')
    expect(back.link.name).toBe('orig')
  })
})
