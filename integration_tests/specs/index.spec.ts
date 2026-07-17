import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import HomePage from '../pages/homePage'

test.describe('Index page', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('renders the page title and heading', async ({ page }) => {
    await login(page)

    await page.goto('/')

    const homePage = await HomePage.verifyOnPage(page)
    await expect(homePage.header).toBeVisible()
    await expect(page.locator('h1')).toHaveText('Cell sharing risk assessment (CSRA)')
  })

  test('renders the start and complete assessments card section', async ({ page }) => {
    await login(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Start and complete assessments' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Recent arrivals' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Assessments in progress' })).toBeVisible()
  })

  test('renders the reviews card section', async ({ page }) => {
    await login(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'View upcoming and incomplete reviews' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'High risk prisoners due for review' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reviews in progress' })).toBeVisible()
  })

  test('renders CSRA ratings stats', async ({ page }) => {
    await login(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: /CSRA ratings at/ })).toBeVisible()
    await expect(page.locator('[data-qa="no-rating-card"]')).toContainText('Prisoners with no rating')
    await expect(page.locator('[data-qa="high-csra-card"]')).toContainText('High risk prisoners')
    await expect(page.locator('[data-qa="standard-csra-card"]')).toContainText('Standard risk prisoners')
  })

  test('renders a link to view all prisoners', async ({ page }) => {
    await login(page)

    await page.goto('/')

    await expect(page.getByRole('link', { name: 'View all prisoners' })).toBeVisible()
  })
})
