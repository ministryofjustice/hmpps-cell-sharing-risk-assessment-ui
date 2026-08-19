import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'

test.describe('Reviews in progress', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('renders reviews in progress and resolves staff display names from Manage Users', async ({ page }) => {
    await login(page, {
      activeCaseLoad: { caseLoadId: 'LEI', description: 'Leeds (HMP)' },
      roles: ['ROLE_CSRA__REVIEW_EDIT'],
    })
    await csraApi.stubGetReviewsInProgress('LEI')
    await manageUsersApi.stubGetUserDetails('SCARTER', 'Sue Carter')

    await page.goto('/reviews-in-progress')

    await expect(page.getByRole('heading', { level: 1, name: 'Reviews in progress' })).toBeVisible()
    await expect(page.getByText('Prisoners who have a cell sharing risk review in progress.')).toBeVisible()

    const table = page.locator('.csra-reviews-in-progress-table')
    await expect(table.locator('tbody tr')).toHaveCount(1)
    await expect(table).toContainText('Kettleby, Simon')
    await expect(table).toContainText('A9354JF')
    await expect(table).toContainText('Sue Carter on Friday 3 July 2026')
    await expect(table).toContainText('Continue review')
    await expect(table).toContainText('Cancel review')
  })

  test('does not show continue/cancel review actions when user does not have the role', async ({ page }) => {
    await login(page, { activeCaseLoad: { caseLoadId: 'LEI', description: 'Leeds (HMP)' }, roles: [] })
    await csraApi.stubGetReviewsInProgress('LEI')
    await manageUsersApi.stubGetUserDetails('SCARTER', 'Sue Carter')

    await page.goto('/reviews-in-progress')

    const table = page.locator('.csra-reviews-in-progress-table')
    await expect(table).not.toContainText('Continue review')
    await expect(table).not.toContainText('Cancel review')
  })

  test('renders empty state when there are no reviews in progress', async ({ page }) => {
    await login(page, { activeCaseLoad: { caseLoadId: 'LEI', description: 'Leeds (HMP)' } })
    await csraApi.stubGetReviewsInProgress('LEI', { content: [], totalResults: 0 })

    await page.goto('/reviews-in-progress')

    await expect(page.getByRole('heading', { level: 1, name: 'Reviews in progress' })).toBeVisible()
    await expect(page.getByText('There are no prisoners with a review in progress.')).toBeVisible()
  })
})
