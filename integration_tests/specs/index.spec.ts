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

  /** Sign in at Moorland with CSRA switched on there, so the journey tiles are available. */
  const loginAtSwitchedOnPrison = async (page: Page) => {
    await csraApi.stubGetInfo([MOORLAND.caseLoadId])
    await csraApi.stubGetRatingSummary(MOORLAND.caseLoadId)
    await login(page, { activeCaseLoad: MOORLAND })
  }

  test('renders the page title and heading', async ({ page }) => {
    await loginAtSwitchedOnPrison(page)

    await page.goto('/')

    const homePage = await HomePage.verifyOnPage(page)
    await expect(homePage.header).toBeVisible()
    await expect(page.locator('h1')).toHaveText('Cell sharing risk assessment (CSRA)')
  })

  test('renders the start and complete assessments card section', async ({ page }) => {
    await loginAtSwitchedOnPrison(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Start and complete assessments' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Recent arrivals' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Assessments in progress' })).toBeVisible()
  })

  test('renders the reviews card section', async ({ page }) => {
    await loginAtSwitchedOnPrison(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'View upcoming and incomplete reviews' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'High risk prisoners due for review' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reviews in progress' })).toBeVisible()
  })

  test('renders CSRA ratings stats', async ({ page }) => {
    await loginAtSwitchedOnPrison(page)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: /CSRA ratings at/ })).toBeVisible()
    await expect(page.locator('[data-qa="no-rating-card"]')).toContainText('Prisoners with no rating')
    await expect(page.locator('[data-qa="high-csra-card"]')).toContainText('High risk prisoners')
    await expect(page.locator('[data-qa="standard-csra-card"]')).toContainText('Standard risk prisoners')
  })

  test('renders a link to view all prisoners', async ({ page }) => {
    await loginAtSwitchedOnPrison(page)

    await page.goto('/')

    await expect(page.getByRole('link', { name: 'View all prisoners' })).toBeVisible()
  })

  test('says CSRA is still managed in NOMIS at an establishment that is not switched on', async ({ page }) => {
    // Signs in at Leeds, which is never in the active set any spec stubs. The app caches the active
    // agencies process-wide for a few minutes, so a spec that relied on an empty set here would pass
    // or fail depending on which spec ran first.
    await csraApi.stubGetInfo([MOORLAND.caseLoadId])
    await csraApi.stubGetRatingSummary(LEEDS.caseLoadId)
    await login(page, { activeCaseLoad: LEEDS })

    await page.goto('/')

    await expect(page.getByTestId('nomis-banner')).toContainText('still managed in NOMIS')
    // The tiles are still listed, so staff can see what is coming, but they do not lead anywhere yet.
    await expect(page.getByRole('link', { name: 'Recent arrivals' })).toHaveCount(0)
    await expect(page.getByText('Recent arrivals')).toBeVisible()
  })

  test('hides the admin tile from a user without the admin role', async ({ page }) => {
    await loginAtSwitchedOnPrison(page)

    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Manage enabled prisons' })).toHaveCount(0)
  })
})
