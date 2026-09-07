import { expect, test, type Page } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import HomePage from '../pages/homePage'
import csraApi from '../mockApis/csraApi'

const MOORLAND = { caseLoadId: 'MDI', description: 'Moorland (HMP)' }
const LEEDS = { caseLoadId: 'LEI', description: 'Leeds (HMP)' }

test.describe('Index page', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  const loginAtMoorland = async (page: Page) => {
    await csraApi.stubGetRatingSummary(MOORLAND.caseLoadId)
    await login(page, { activeCaseLoad: MOORLAND })
  }

  test('renders the page title and heading', async ({ page }) => {
    await loginAtMoorland(page)

    await page.goto('/')

    const homePage = await HomePage.verifyOnPage(page)
    await expect(homePage.header).toBeVisible()
    await expect(page.locator('h1')).toHaveText('Cell sharing risk assessment (CSRA)')
  })

  test('renders the start and complete assessments card section', async ({ page }) => {
    await loginAtMoorland(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Start and complete assessments' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Recent arrivals' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Assessments in progress' })).toBeVisible()
  })

  test('renders the reviews card section', async ({ page }) => {
    await loginAtMoorland(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'View upcoming and incomplete reviews' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'High risk prisoners due for review' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reviews in progress' })).toBeVisible()
  })

  test('renders CSRA ratings stats', async ({ page }) => {
    await loginAtMoorland(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: /CSRA ratings at/ })).toBeVisible()
    await expect(page.locator('[data-qa="no-rating-card"]')).toContainText('Prisoners with no rating')
    await expect(page.locator('[data-qa="high-csra-card"]')).toContainText('High risk prisoners')
    await expect(page.locator('[data-qa="standard-csra-card"]')).toContainText('Standard risk prisoners')
  })

  test('renders a link to view all prisoners', async ({ page }) => {
    await loginAtMoorland(page)

    await page.goto('/')

    await expect(page.getByRole('link', { name: 'View all prisoners' })).toBeVisible()
  })

  test('links the journey tiles at an establishment that is not switched on for CSRA', async ({ page }) => {
    // Leeds is not in the active set, but the worklists are read-only and open to any user with the
    // prisoner in their caseload, so the tiles still work and nothing says otherwise.
    await csraApi.stubGetInfo([MOORLAND.caseLoadId])
    await csraApi.stubGetRatingSummary(LEEDS.caseLoadId)
    await login(page, { activeCaseLoad: LEEDS })

    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Recent arrivals' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reviews in progress' })).toBeVisible()
    await expect(page.getByTestId('nomis-banner')).toHaveCount(0)
  })

  test('hides the admin tile from a user without the admin role', async ({ page }) => {
    await loginAtMoorland(page)

    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Manage enabled prisons' })).toHaveCount(0)
  })
})
