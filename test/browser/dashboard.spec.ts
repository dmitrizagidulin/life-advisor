/**
 * Dashboard flows over the offline local store: capture a thought, create an
 * action item, toggle it done, bump it, and move its category. Each test runs in
 * an isolated browser context (fresh IndexedDB), so no cross-test cleanup.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('dashboard-page')).toBeVisible()
})

test('captures a thought into the Pensieve', async ({ page }) => {
  await page.getByTestId('new-thought-input').fill('Remember the milk')
  await page.getByTestId('new-thought-save').click()

  await page.getByTestId('nav-thoughts').click()
  await expect(
    page.getByTestId('thought-row').filter({ hasText: 'Remember the milk' })
  ).toBeVisible()
})

test('creates an action item in a category', async ({ page }) => {
  await page.getByTestId('new-item-input-someday').fill('Write the report')
  await page.getByTestId('add-item-someday').click()

  const list = page.getByTestId('category-list-someday')
  await expect(
    list.getByTestId('action-item-row').filter({ hasText: 'Write the report' })
  ).toBeVisible()
})

test('toggles an item done, removing it from the todo list', async ({
  page
}) => {
  await page.getByTestId('new-item-input-someday').fill('Toggle me')
  await page.getByTestId('add-item-someday').click()

  const row = page
    .getByTestId('category-list-someday')
    .getByTestId('action-item-row')
    .filter({ hasText: 'Toggle me' })
  await expect(row).toBeVisible()

  await row.getByTestId('toggle-done').click()
  await expect(row).toHaveCount(0)
})

test('bumps an item, showing the bump count', async ({ page }) => {
  await page.getByTestId('new-item-input-someday').fill('Bump me')
  await page.getByTestId('add-item-someday').click()

  const row = page
    .getByTestId('category-list-someday')
    .getByTestId('action-item-row')
    .filter({ hasText: 'Bump me' })
  await row.getByTestId('bump-item').click()
  await expect(row.getByTestId('bump-item')).toHaveText(/Bump! \(1\)/)
})

test('moves an item to another category', async ({ page }) => {
  await page.getByTestId('new-item-input-someday').fill('Urgent thing')
  await page.getByTestId('add-item-someday').click()

  const somedayRow = page
    .getByTestId('category-list-someday')
    .getByTestId('action-item-row')
    .filter({ hasText: 'Urgent thing' })
  await somedayRow.getByTestId('category-critical').click()

  await expect(
    page
      .getByTestId('category-list-critical')
      .getByTestId('action-item-row')
      .filter({ hasText: 'Urgent thing' })
  ).toBeVisible()
})
