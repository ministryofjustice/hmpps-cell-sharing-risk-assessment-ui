import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import { login, resetStubs } from '../testUtils'
import DueForReviewPage from '../pages/dueForReviewPage'
import type { CsraHighRiskDueForReview } from '../../server/data/csraApiTypes'

const defaultDueForReview: CsraHighRiskDueForReview = {
  content: [
    {
      prisonerNumber: 'A1049JF',
      firstName: 'CALLUM',
      lastName: 'REID',
      reviewDueBy: '2026-06-29',
      ratingType: 'HIGH_GENERAL',
      rating: 'HIGH_GENERAL',
      provisional: false,
      lastRatingSource: 'ASSESSMENT',
      lastRatingDate: '2025-06-24',
    },
    {
      prisonerNumber: 'A5197BD',
      firstName: 'DANIEL',
      lastName: 'HAVERS',
      reviewDueBy: '2026-08-15',
      ratingType: 'HIGH_SPECIFIC',
      rating: 'HIGH_SPECIFIC',
      provisional: false,
      lastRatingSource: 'REVIEW',
      lastRatingDate: '2025-02-01',
    },
  ],
  totalResults: 2,
  availableRatingTypes: ['HIGH_GENERAL', 'HIGH_SPECIFIC'],
}

test.describe('High risk prisoners due for review', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('renders the page heading and table with all rows', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    await expect(dueForReviewPage.table).toBeVisible()
    await expect(dueForReviewPage.tableRows).toHaveCount(2)
  })

  test('renders prisoner name as a link with last name first', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    const firstRow = dueForReviewPage.tableRows.first()
    await expect(firstRow.getByRole('link')).toHaveText('Reid, Callum')
    await expect(firstRow.getByRole('link')).toHaveAttribute('href', '/prisoner/A1049JF')
  })

  test('renders prison number and formatted review due date', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    const firstRow = dueForReviewPage.tableRows.first()
    await expect(firstRow).toContainText('A1049JF')
    await expect(firstRow).toContainText('29 June 2026')
  })

  test('shows overdue message when review date is in the past', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    await expect(dueForReviewPage.tableRows.first().locator('.govuk-error-message')).toContainText('days overdue')
  })

  test('renders CSRA rating with "Last assessed" for assessment source', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    const firstRow = dueForReviewPage.tableRows.first()
    await expect(firstRow).toContainText('High risk – general')
    await expect(firstRow.locator('.csra-due-for-review-table__rating-meta')).toContainText(
      'Last assessed: 24 June 2025',
    )
  })

  test('renders CSRA rating with "Last reviewed" for review source', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    const secondRow = dueForReviewPage.tableRows.nth(1)
    await expect(secondRow).toContainText('High risk – specific')
    await expect(secondRow.locator('.csra-due-for-review-table__rating-meta')).toContainText(
      'Last reviewed: 1 February 2025',
    )
  })

  test('renders the filter panel with checkboxes for available rating types', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    await expect(dueForReviewPage.filterPanel).toBeVisible()
    await expect(page.getByLabel('High risk – general')).toBeVisible()
    await expect(page.getByLabel('High risk – specific')).toBeVisible()
  })

  test('submits selected filter values in the URL when Apply is clicked', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review')
    await DueForReviewPage.verifyOnPage(page)

    await page.getByLabel('High risk – general').check()
    await page.getByLabel('Review date from').fill('1/8/2026')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(page).toHaveURL(/ratingType=HIGH_GENERAL/)
    await expect(page).toHaveURL(/reviewDateFrom=1%2F8%2F2026/)
  })

  test('restores checked rating type checkboxes after filter submission', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review?ratingType=HIGH_GENERAL')

    await DueForReviewPage.verifyOnPage(page)
    await expect(page.getByLabel('High risk – general')).toBeChecked()
    await expect(page.getByLabel('High risk – specific')).not.toBeChecked()
  })

  test('shows no-results message with filter guidance when filtered results are empty', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', {
      content: [],
      totalResults: 0,
      availableRatingTypes: ['HIGH_GENERAL'],
    })

    await page.goto('/due-for-review?ratingType=HIGH_GENERAL')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    await expect(dueForReviewPage.noResultsMessage).toBeVisible()
    await expect(dueForReviewPage.filterPanel).toBeVisible()
    await expect(page.getByText('select different CSRA rating types')).toBeVisible()
  })

  test('shows no-data message and no table when no prisoners are due for review', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', { content: [], totalResults: 0, availableRatingTypes: [] })

    await page.goto('/due-for-review')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    await expect(dueForReviewPage.noDataMessage).toBeVisible()
    await expect(dueForReviewPage.table).not.toBeVisible()
  })

  test('shows error summary and inline errors for invalid date inputs', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review?reviewDateFrom=31%2F4%2Fabcd&reviewDateTo=zzxxyy')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    await expect(dueForReviewPage.errorSummary).toBeVisible()
    await expect(dueForReviewPage.errorSummary).toContainText('There is a problem')
    await expect(
      dueForReviewPage.errorSummary.getByRole('link', { name: "'Review date from' must be a real date" }),
    ).toBeVisible()
    await expect(
      dueForReviewPage.errorSummary.getByRole('link', { name: "'Review date to' must be a real date" }),
    ).toBeVisible()
    await expect(
      page.locator('#reviewDateFrom').locator('xpath=ancestor::*[contains(@class,"govuk-form-group")][1]'),
    ).toContainText("'Review date from' must be a real date")
    await expect(
      page.locator('#reviewDateTo').locator('xpath=ancestor::*[contains(@class,"govuk-form-group")][1]'),
    ).toContainText("'Review date to' must be a real date")
  })

  test('page title is prefixed with "Error:" when there are validation errors', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review?reviewDateFrom=notadate')

    await expect(page).toHaveTitle(/^Error:/)
  })

  test('clear filters link navigates back to the unfiltered page', async ({ page }) => {
    await login(page)
    await csraApi.stubGetHighRiskDueForReview('LEI', defaultDueForReview)

    await page.goto('/due-for-review?ratingType=HIGH_GENERAL')

    const dueForReviewPage = await DueForReviewPage.verifyOnPage(page)
    await dueForReviewPage.clearFiltersLink.click()

    await expect(page).toHaveURL('/due-for-review')
  })
})
