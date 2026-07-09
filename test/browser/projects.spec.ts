/**
 * Project lifecycle: create a project, drive the status machine (completed stamps
 * a completion time, canceled a cancellation time, and it can be reactivated),
 * and toggle a served goal.
 */
import { test, expect } from '@playwright/test'

async function createProject(page: import('@playwright/test').Page, name: string) {
  await page.goto('/#/projects')
  await expect(page.getByTestId('projects-index-page')).toBeVisible()
  await page.getByTestId('new-project-input').fill(name)
  await page.getByTestId('add-project').click()
  await page
    .getByTestId('project-row')
    .filter({ hasText: name })
    .getByRole('link', { name })
    .click()
  await expect(page.getByTestId('project-show-page')).toBeVisible()
}

test('creates a project and runs the status machine', async ({ page }) => {
  await createProject(page, 'Launch rocket')

  await expect(page.getByTestId('project-status')).toHaveText(/idea/)

  // idea -> completed stamps completedAt
  await page.getByTestId('status-to-completed').click()
  await expect(page.getByTestId('project-status')).toHaveText(/completed/)
  await expect(page.getByTestId('project-completed-at')).toBeVisible()

  // completed -> active (Not Done!)
  await page.getByTestId('status-to-active').click()
  await expect(page.getByTestId('project-status')).toHaveText(/active/)

  // active -> canceled stamps canceledAt
  await page.getByTestId('status-to-canceled').click()
  await expect(page.getByTestId('project-status')).toHaveText(/canceled/)
  await expect(page.getByTestId('project-canceled-at')).toBeVisible()

  // canceled -> someday -> active (reactivate)
  await page.getByTestId('status-to-someday').click()
  await expect(page.getByTestId('project-status')).toHaveText(/someday/)
  await page.getByTestId('status-to-active').click()
  await expect(page.getByTestId('project-status')).toHaveText(/active/)
})

test('toggles a served goal on and off', async ({ page }) => {
  // A goal to serve.
  await page.goto('/#/goals')
  await expect(page.getByTestId('goals-index-page')).toBeVisible()
  await page.getByTestId('new-goal-input').fill('Financial freedom')
  await page.getByTestId('add-goal').click()
  await expect(
    page.getByTestId('goal-row').filter({ hasText: 'Financial freedom' })
  ).toBeVisible()

  await createProject(page, 'Save money')
  await page.getByTestId('set-goals').click()
  await expect(page.getByTestId('project-set-goals-page')).toBeVisible()

  const checkbox = page.locator('[data-testid^="serve-goal-"]').first()
  await checkbox.click()
  await expect(checkbox.locator('input')).toBeChecked()

  // Back on the project it now lists the served goal.
  await page.getByTestId('set-goals-done').click()
  await expect(page.getByTestId('project-show-page')).toBeVisible()
  await expect(page.getByText('Financial freedom')).toBeVisible()

  // Toggle it back off.
  await page.getByTestId('set-goals').click()
  const checkbox2 = page.locator('[data-testid^="serve-goal-"]').first()
  await checkbox2.click()
  await expect(checkbox2.locator('input')).not.toBeChecked()
})
