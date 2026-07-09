/**
 * Current-focus banner (set on a project, reset back to default) and the history
 * journal rendering after an item is completed.
 */
import { test, expect } from '@playwright/test'

test('sets and resets the current focus banner', async ({ page }) => {
  await page.goto('/#/projects')
  await page.getByTestId('new-project-input').fill('Focus target')
  await page.getByTestId('add-project').click()
  await page
    .getByTestId('project-row')
    .filter({ hasText: 'Focus target' })
    .getByRole('link', { name: 'Focus target' })
    .click()
  await expect(page.getByTestId('project-show-page')).toBeVisible()

  // No banner by default.
  await expect(page.getByTestId('current-focus-banner')).toHaveCount(0)

  await page.getByTestId('make-current-focus').click()
  const banner = page.getByTestId('current-focus-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Focus target')

  await page.getByTestId('reset-focus').click()
  await expect(page.getByTestId('current-focus-banner')).toHaveCount(0)
})

test('history renders activity after completing an item', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('dashboard-page')).toBeVisible()

  await page.getByTestId('new-item-input-critical').fill('Ship it today')
  await page.getByTestId('add-item-critical').click()

  const row = page
    .getByTestId('category-list-critical')
    .getByTestId('action-item-row')
    .filter({ hasText: 'Ship it today' })
  await row.getByTestId('toggle-done').click()

  await page.getByTestId('nav-history').click()
  await expect(page.getByTestId('history-page')).toBeVisible()
  // Today's entry (first) should show the completed item.
  await expect(
    page.getByTestId('history-day').first()
  ).toContainText('Ship it today')
})
