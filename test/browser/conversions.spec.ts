/**
 * The web-link / action-item conversion round trip: a standalone link becomes an
 * action item (carrying a child link), and that action item converts back into a
 * standalone link.
 */
import { test, expect } from '@playwright/test'

test('converts a web link to an action item and back', async ({ page }) => {
  await page.goto('/#/web-links')
  await expect(page.getByTestId('web-links-index-page')).toBeVisible()

  await page.getByTestId('weblink-url-input').fill('https://example.com/read')
  await page.getByTestId('weblink-name-input').fill('Read later')
  await page.getByTestId('add-weblink').click()

  const linkRow = page
    .getByTestId('weblink-row')
    .filter({ hasText: 'Read later' })
  await expect(linkRow).toBeVisible()

  // Link -> action item. The named standalone link is gone (a blank-named child
  // link remains, showing its url, which is expected).
  await linkRow.getByTestId('weblink-to-action-item').click()
  await expect(
    page.getByTestId('weblink-row').filter({ hasText: 'Read later' })
  ).toHaveCount(0)

  await page.goto('/#/action-items/all')
  const itemRow = page
    .getByTestId('action-item-row')
    .filter({ hasText: 'Read later' })
  await expect(itemRow).toBeVisible()

  // Action item -> link (the item carries the child link, so "To Link" shows).
  await itemRow.getByTestId('item-to-link').click()
  await expect(
    page.getByTestId('action-item-row').filter({ hasText: 'Read later' })
  ).toHaveCount(0)

  await page.goto('/#/web-links')
  await expect(
    page.getByTestId('weblink-row').filter({ hasText: 'Read later' })
  ).toBeVisible()
})
