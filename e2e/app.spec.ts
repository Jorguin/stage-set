import { test, expect } from '@playwright/test'

test.describe('App loads', () => {
  test('should load without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')

    expect(errors.filter(e => !e.includes('favicon')).length).toBe(0)
  })

  test('should show auth page when not logged in', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Entrar con Magic Link')).toBeVisible()
    await expect(page.locator('text=Google')).toBeVisible()
  })
})