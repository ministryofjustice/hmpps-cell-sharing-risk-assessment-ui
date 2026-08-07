import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import { login, resetStubs } from '../testUtils'
import RecentArrivalsPage from '../pages/recentArrivalsPage'
import type { CsraRecentArrivals } from '../../server/data/csraApiTypes'

const emptyRecentArrivals: CsraRecentArrivals = {
  days: [
    { date: '2026-08-06', arrivals: [] },
    { date: '2026-08-05', arrivals: [] },
    { date: '2026-08-04', arrivals: [] },
  ],
  totalResults: 0,
  arrivalTypeCounts: { NEW_ADMISSION: 0, TRANSFER_IN: 0, COURT_RETURN: 0, TEMPORARY_ABSENCE_RETURN: 0 },
  fromDate: '2026-08-04',
  toDate: '2026-08-06',
}

test.describe('Recent arrivals', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('renders the page heading and filter panel', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals')

    const recentArrivalsPage = await RecentArrivalsPage.verifyOnPage(page)
    await expect(recentArrivalsPage.filterPanel).toBeVisible()
    await expect(recentArrivalsPage.applyButton).toBeVisible()
  })

  test('renders a day heading and table row for each arrival', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals')

    await RecentArrivalsPage.verifyOnPage(page)
    // Default stub has one arrival on 2026-08-06
    await expect(page.locator('.csra-recent-arrivals tbody tr')).toHaveCount(1)
    await expect(page.locator('.csra-recent-arrivals tbody tr')).toContainText('Havers, Daniel')
    await expect(page.locator('.csra-recent-arrivals tbody tr')).toContainText('A5197BD')
  })

  test('renders prisoner name as a link', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals')

    await RecentArrivalsPage.verifyOnPage(page)
    await expect(page.getByRole('link', { name: 'Havers, Daniel' })).toHaveAttribute('href', '/prisoner/A5197BD')
  })

  test('renders the arrival type label', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals')

    await RecentArrivalsPage.verifyOnPage(page)
    await expect(page.locator('.csra-recent-arrivals tbody tr')).toContainText('New admission')
  })

  test('renders "No prisoners arrived on this day." for empty days', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals')

    await RecentArrivalsPage.verifyOnPage(page)
    const emptyDayMessages = page.locator('.csra-recent-arrivals p', { hasText: 'No prisoners arrived on this day.' })
    // Default stub has two empty days
    await expect(emptyDayMessages).toHaveCount(2)
  })

  test('renders filter checkboxes with counts from arrivalTypeCounts', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals')

    await RecentArrivalsPage.verifyOnPage(page)
    await expect(page.getByLabel('New admissions (1)')).toBeVisible()
    await expect(page.getByLabel('Transfers in (0)')).toBeVisible()
    await expect(page.getByLabel('Court returns (0)')).toBeVisible()
    await expect(page.getByLabel('Temporary absence returns (0)')).toBeVisible()
  })

  test('submits selected filter values in the URL when Apply is clicked', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals')
    await RecentArrivalsPage.verifyOnPage(page)

    await page.getByLabel('New admissions (1)').check()
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(page).toHaveURL(/arrivalType=NEW_ADMISSION/)
  })

  test('restores checked checkboxes after filter submission', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI')

    await page.goto('/recent-arrivals?arrivalType=TRANSFER_IN')

    await RecentArrivalsPage.verifyOnPage(page)
    await expect(page.getByLabel('Transfers in (0)')).toBeChecked()
    await expect(page.getByLabel('New admissions (1)')).not.toBeChecked()
  })

  test('shows "No prisoners arrived on this day." for all days when there are no arrivals', async ({ page }) => {
    await login(page)
    await csraApi.stubGetRecentArrivals('LEI', emptyRecentArrivals)

    await page.goto('/recent-arrivals')

    await RecentArrivalsPage.verifyOnPage(page)
    await expect(page.locator('.csra-recent-arrivals tbody tr')).toHaveCount(0)
    const emptyDayMessages = page.locator('.csra-recent-arrivals p', { hasText: 'No prisoners arrived on this day.' })
    await expect(emptyDayMessages).toHaveCount(3)
  })
})
