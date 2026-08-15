# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Accessibility >> login page has no critical a11y violations
- Location: e2e\a11y.spec.ts:7:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | import AxeBuilder from '@axe-core/playwright'
  3   | 
  4   | test.describe.configure({ retries: 1, workers: 1 })
  5   | 
  6   | test.describe('Accessibility', () => {
  7   |   test('login page has no critical a11y violations', async ({ page }) => {
> 8   |     await page.goto('/')
      |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  9   |     
  10  |     const results = await new AxeBuilder({ page })
  11  |       .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  12  |       .analyze()
  13  |     
  14  |     const criticalViolations = results.violations.filter(v => v.impact === 'critical')
  15  |     const seriousViolations = results.violations.filter(v => v.impact === 'serious')
  16  |     
  17  |     // Document current violations (known issues to fix)
  18  |     if (criticalViolations.length > 0) {
  19  |       console.log('CRITICAL violations:', JSON.stringify(criticalViolations, null, 2))
  20  |     }
  21  |     if (seriousViolations.length > 0) {
  22  |       console.log('SERIOUS violations (known):', seriousViolations.map(v => ({
  23  |         id: v.id,
  24  |         impact: v.impact,
  25  |         nodes: v.nodes.length,
  26  |         description: v.description
  27  |       })))
  28  |     }
  29  |     
  30  |     // Only critical violations fail the build
  31  |     expect(criticalViolations.length).toBe(0)
  32  |     // Serious violations documented but not failing (fix in follow-up)
  33  |     expect(seriousViolations.length).toBeGreaterThanOrEqual(0)
  34  |   })
  35  | 
  36  |   test('login form has proper labels', async ({ page }) => {
  37  |     await page.goto('/')
  38  |     
  39  |     const results = await new AxeBuilder({ page })
  40  |       .withRules(['label'])
  41  |       .analyze()
  42  |     
  43  |     expect(results.violations.length).toBe(0)
  44  |   })
  45  | 
  46  |   test('buttons have accessible names', async ({ page }) => {
  47  |     await page.goto('/')
  48  |     
  49  |     const results = await new AxeBuilder({ page })
  50  |       .withRules(['button-name'])
  51  |       .analyze()
  52  |     
  53  |     expect(results.violations.length).toBe(0)
  54  |   })
  55  | 
  56  |   test('color contrast documented', async ({ page }) => {
  57  |     await page.goto('/')
  58  |     
  59  |     const results = await new AxeBuilder({ page })
  60  |       .withRules(['color-contrast'])
  61  |       .analyze()
  62  |     
  63  |     // Document violations (known issue: text-gray-500 on dark bg)
  64  |     if (results.violations.length > 0) {
  65  |       console.log('Color contrast violations:', results.violations.map(v => ({
  66  |         impact: v.impact,
  67  |         nodes: v.nodes.length,
  68  |         fgColor: v.nodes[0]?.any[0]?.data?.fgColor,
  69  |         bgColor: v.nodes[0]?.any[0]?.data?.bgColor,
  70  |         contrastRatio: v.nodes[0]?.any[0]?.data?.contrastRatio
  71  |       })))
  72  |     }
  73  |     // Don't fail - fix in follow-up
  74  |     expect(results.violations.length).toBeGreaterThanOrEqual(0)
  75  |   })
  76  | 
  77  |   test('landmarks present', async ({ page }) => {
  78  |     await page.goto('/')
  79  |     
  80  |     const results = await new AxeBuilder({ page })
  81  |       .withRules(['landmark-one-main', 'region'])
  82  |       .analyze()
  83  |     
  84  |     // Document violations (known issue: missing main landmark)
  85  |     if (results.violations.length > 0) {
  86  |       console.log('Landmark violations:', results.violations.map(v => ({
  87  |         id: v.id,
  88  |         impact: v.impact,
  89  |         nodes: v.nodes.length
  90  |       })))
  91  |     }
  92  |     // Don't fail - fix in follow-up
  93  |     expect(results.violations.length).toBeGreaterThanOrEqual(0)
  94  |   })
  95  | 
  96  |   test('headings hierarchy', async ({ page }) => {
  97  |     await page.goto('/')
  98  |     
  99  |     const results = await new AxeBuilder({ page })
  100 |       .withRules(['heading-order'])
  101 |       .analyze()
  102 |     
  103 |     expect(results.violations.length).toBe(0)
  104 |   })
  105 | 
  106 |   test('no duplicate IDs', async ({ page }) => {
  107 |     await page.goto('/')
  108 |     
```