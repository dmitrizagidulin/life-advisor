/**
 * Export-all-JSON flow over the offline local store: create a thought, trigger
 * the Export action, and assert the downloaded file is valid JSON keyed by the
 * eight WAS collection names with the created doc present.
 */
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

test('exports all collections as a JSON download', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('dashboard-page')).toBeVisible()

  await page.getByTestId('new-thought-input').fill('Exported thought')
  await page.getByTestId('new-thought-save').click()
  await page.getByTestId('nav-thoughts').click()
  await expect(
    page.getByTestId('thought-row').filter({ hasText: 'Exported thought' })
  ).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json').click()
  ])
  const path = await download.path()
  const bundle = JSON.parse(readFileSync(path, 'utf8')) as Record<
    string,
    Array<{ name?: string }>
  >

  expect(Object.keys(bundle).sort()).toEqual(
    [
      'action-items',
      'answers',
      'current-focus',
      'goals',
      'projects',
      'questions',
      'thoughts',
      'web-links'
    ].sort()
  )
  expect(bundle.thoughts?.some((t) => t.name === 'Exported thought')).toBe(true)
})
