/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { fromActionItem, nameDisplay, toActionItem } from './webLinks'
import { createActionItem, createWebLink } from './factories'

const D = 'dev'
const NOW = '2026-07-06T12:00:00.000Z'
const TODAY = '2026-07-06'
const link = (o: Omit<Parameters<typeof createWebLink>[0], 'deviceId'>) =>
  createWebLink({ ...o, deviceId: D }, NOW, undefined, TODAY)

describe('nameDisplay', () => {
  it('returns the name when present', () => {
    expect(nameDisplay(link({ name: 'My Link', url: 'https://x.com' }))).toBe('My Link')
  })

  it('truncates a long url to 50 chars (47 + ...) when name blank', () => {
    const url = 'https://example.com/' + 'a'.repeat(80)
    const result = nameDisplay(link({ name: '', url }))
    expect(result.length).toBe(50)
    expect(result.endsWith('...')).toBe(true)
    expect(result).toBe(url.slice(0, 47) + '...')
  })

  it('returns a short url as-is', () => {
    expect(nameDisplay(link({ name: '   ', url: 'https://x.com' }))).toBe('https://x.com')
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
      deviceId: D,
      now: NOW,
      itemId: 'item-1',
      linkId: 'link-1'
    })
    expect(item.name).toBe('Read this')
    expect(item.parentType).toBe('day')
    expect(item.parentKey).toBe(TODAY)
    expect(child.url).toBe('https://x.com/a')
    expect(child.name).toBe('')
    expect(child.parentType).toBe('action_item')
    expect(child.parentKey).toBe('item-1')
    expect(deleteWebLinkId).toBe(original.id)
  })
})

describe('fromActionItem', () => {
  it('creates a link from the item and its first link, deleting item and links', () => {
    const item = createActionItem(
      { deviceId: D, name: 'A task', parentType: 'day', parentKey: TODAY },
      NOW,
      'item-1'
    )
    const l1 = createWebLink(
      { deviceId: D, url: 'https://x.com/first', parentType: 'action_item', parentKey: 'item-1' },
      NOW,
      'l1',
      TODAY
    )
    const l2 = createWebLink(
      { deviceId: D, url: 'https://x.com/second', parentType: 'action_item', parentKey: 'item-1' },
      NOW,
      'l2',
      TODAY
    )
    const { link: newLink, deleteActionItemId, deleteWebLinkIds } = fromActionItem(
      item,
      [l1, l2],
      { deviceId: D, now: NOW }
    )
    expect(newLink.name).toBe('A task')
    expect(newLink.url).toBe('https://x.com/first')
    expect(newLink.parentType).toBe('day')
    expect(newLink.parentKey).toBe(TODAY)
    expect(deleteActionItemId).toBe('item-1')
    expect(deleteWebLinkIds).toEqual(['l1', 'l2'])
  })

  it('throws when the item has no links', () => {
    const item = createActionItem({ deviceId: D, name: 'x' }, NOW)
    expect(() => fromActionItem(item, [], { deviceId: D })).toThrow()
  })
})

describe('link/item round trip', () => {
  it('preserves the url through toActionItem then fromActionItem', () => {
    const original = link({ name: 'orig', url: 'https://x.com/keep', parentType: 'day', parentKey: TODAY })
    const forward = toActionItem(original, { deviceId: D, now: NOW, itemId: 'item-1' })
    const back = fromActionItem(forward.item, [forward.link], { deviceId: D, now: NOW })
    expect(back.link.url).toBe('https://x.com/keep')
    expect(back.link.name).toBe('orig')
  })
})
