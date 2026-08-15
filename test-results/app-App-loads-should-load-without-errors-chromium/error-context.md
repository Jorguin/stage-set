# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> App loads >> should load without errors
- Location: e2e\app.spec.ts:4:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('App loads', () => {
  4  |   test('should load without errors', async ({ page }) => {
  5  |     const errors: string[] = []
  6  |     page.on('console', msg => {
  7  |       if (msg.type() === 'error') errors.push(msg.text())
  8  |     })
  9  |     page.on('pageerror', err => errors.push(err.message))
  10 | 
  11 |     await page.goto('/')
  12 | 
> 13 |     expect(errors.filter(e => !e.includes('favicon')).length).toBe(0)
     |                                                               ^ Error: expect(received).toBe(expected) // Object.is equality
  14 |   })
  15 | 
  16 |   test('should show auth page when not logged in', async ({ page }) => {
  17 |     await page.goto('/')
  18 |     await expect(page.locator('text=Entrar con Magic Link')).toBeVisible()
  19 |     await expect(page.locator('text=Google')).toBeVisible()
  20 |   })
  21 | })
```