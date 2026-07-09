/**
 * Cross-store orchestration that a single entity store cannot express on its own:
 * the web-link/action-item conversion round trip and cascade deletes. Each
 * applies a pure `domain/*` function and then persists the resulting doc set
 * through the individual stores. Kept out of the stores themselves (which stay
 * single-collection) and out of the pure domain layer (which never persists).
 */
import { getDeviceId } from '@/stores/storageManager'
import { toActionItem, fromActionItem } from '@/domain/webLinks'
import { forParent } from '@/domain/parent'
import { useActionItems } from '@/stores/entities/actionItems'
import { useWebLinks } from '@/stores/entities/webLinks'
import type { ActionItemDoc, WebLinkDoc } from '@/types/domain'

/** The web links pointing at an action item (its child links). */
export function linksForItem(item: ActionItemDoc): WebLinkDoc[] {
  const links = [...useWebLinks.getState().byId.values()]
  return forParent(links, 'action_item', item.id)
}

/** Convert a standalone web link into an action item plus a child link. */
export async function convertLinkToActionItem(link: WebLinkDoc): Promise<void> {
  const { item, link: childLink, deleteWebLinkId } = toActionItem(link, {
    deviceId: getDeviceId()
  })
  await useActionItems.getState().insert(item)
  await useWebLinks.getState().insert(childLink)
  await useWebLinks.getState().remove(deleteWebLinkId)
}

/** Convert an action item (with at least one link) back into a standalone link. */
export async function convertActionItemToLink(
  item: ActionItemDoc
): Promise<void> {
  const links = linksForItem(item)
  const { link, deleteActionItemId, deleteWebLinkIds } = fromActionItem(
    item,
    links,
    { deviceId: getDeviceId() }
  )
  await useWebLinks.getState().insert(link)
  await useActionItems.getState().remove(deleteActionItemId)
  for (const id of deleteWebLinkIds) {
    await useWebLinks.getState().remove(id)
  }
}

/** Delete an action item and its child links (ports Rails `destroy_related`). */
export async function deleteActionItemCascade(
  item: ActionItemDoc
): Promise<void> {
  for (const link of linksForItem(item)) {
    await useWebLinks.getState().remove(link.id)
  }
  await useActionItems.getState().remove(item.id)
}
