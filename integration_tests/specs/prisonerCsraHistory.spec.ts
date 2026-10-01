import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'
import PrisonerCsraHistoryPage from '../pages/prisonerCsraHistoryPage'
import type { CsraReviewHistory } from '../../server/data/csraApiTypes'

const prisoner = {
  prisonerNumber: 'A5197BD',
  firstName: 'DANIEL',
  lastName: 'HAVERS',
  dateOfBirth: '1972-02-03',
  pncNumber: '15/17564AG',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
  cellLocation: 'A-1-001',
}

const history: CsraReviewHistory = {
  summary: {
    totalCsras: 13,
    highCount: 2,
    standardCount: 11,
    firstAssessmentDate: '2011-06-15',
    lastAssessmentDate: '2025-10-11',
    lastHighDate: '2013-07-14',
    ratings: ['HIGH', 'HIGH_SPECIFIC', 'STANDARD'],
    establishments: [
      { prisonId: 'HLI', prisonName: 'Hull (HMP)' },
      { prisonId: 'LEI', prisonName: 'Leeds (HMP)' },
    ],
  },
  content: [
    {
      id: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
      type: 'CSRA_REVIEW',
      assessmentType: 'REVIEW',
      rating: 'STANDARD',
      reviewComment: 'No concerns identified at this review.',
      recordedDate: '2025-10-11',
      finalRating: 'STANDARD',
      finalReviewComment: 'No concerns identified at this review.',
      finalRecordedDate: '2025-10-11',
      finalPrisonId: 'LEI',
      finalPrisonName: 'Leeds (HMP)',
      provisionalRating: null,
      provisionalRecordedDate: null,
      provisionalPrisonId: null,
      provisionalPrisonName: null,
      interimReviewer: null,
      closureReason: null,
      riskTo: [],
      vulnerabilities: [],
      prisonId: 'LEI',
      prisonName: 'Leeds (HMP)',
    },
    {
      id: 'a2b3c4d5-e6f7-4890-a123-b456c789d012',
      type: 'CSRA_REVIEW',
      assessmentType: 'REVIEW',
      rating: 'HIGH_SPECIFIC',
      reviewComment: 'Cannot share with specific groups.',
      recordedDate: '2024-07-23',
      finalRating: 'HIGH_SPECIFIC',
      finalReviewComment: 'Cannot share with specific groups.',
      finalRecordedDate: '2024-07-23',
      finalPrisonId: 'LEI',
      finalPrisonName: 'Leeds (HMP)',
      provisionalRating: null,
      provisionalRecordedDate: null,
      provisionalPrisonId: null,
      provisionalPrisonName: null,
      interimReviewer: null,
      closureReason: null,
      riskTo: [],
      vulnerabilities: [],
      prisonId: 'LEI',
      prisonName: 'Leeds (HMP)',
    },
  ],
  page: 0,
  size: 10,
  totalElements: 13,
  totalPages: 2,
}

test.describe('Prisoner CSRA history', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('shows the summary, banner and history reviews for a prisoner', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCsraHistory('A5197BD', history)

    await page.goto('/prisoner/A5197BD/history')

    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.prisonerBanner).toContainText('Daniel Havers')
    await expect(historyPage.prisonerBanner).toContainText('15/17564AG')
    await expect(historyPage.totalCsras).toHaveText('13')
    await expect(historyPage.highCount).toHaveText('2')
    await expect(historyPage.standardCount).toHaveText('11')
    await expect(historyPage.summary).toContainText('June 2011')
    await expect(historyPage.summary).toContainText('October 2025')
    await expect(historyPage.summary).toContainText('Last high 14 July 2013')
    await expect(historyPage.reviews).toHaveCount(2)
    await expect(historyPage.reviews.first()).toContainText('STANDARD RISK')
    await expect(historyPage.reviews.first()).toContainText('No concerns identified at this review.')
    await expect(historyPage.reviews.nth(1)).toContainText('HIGH RISK SPECIFIC')
    await expect(historyPage.pagination).toContainText('of 13 CSRAs')
    await expect(page.getByTestId('pagination')).toHaveCount(2)
    // Establishment filter checkboxes and resolved prison name in the review card
    await expect(historyPage.filters).toContainText('Hull (HMP)')
    await expect(historyPage.filters).toContainText('Leeds (HMP)')
    await expect(historyPage.reviews.first()).toContainText('Assessed at Leeds (HMP)')
  })

  test('keeps personal details unchanged when a DPS user switches from Current rating to CSRA history', async ({
    page,
  }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCurrentRating('A5197BD', { status: 'COMPLETE', rating: 'STANDARD' })
    await csraApi.stubGetCsraHistory('A5197BD', history)

    await page.goto('/prisoner/A5197BD')
    const currentBanner = await page.getByTestId('prisoner-banner').innerText()
    await page.getByRole('link', { name: 'CSRA history', exact: true }).click()

    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.prisonerBanner).toHaveText(currentBanner)
    await expect(page.getByRole('link', { name: 'Digital Prison Services' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'CSRA', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'CSRA history', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('filters by establishment and passes the selection to the API', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCsraHistory('A5197BD', history)

    await page.goto('/prisoner/A5197BD/history')

    await page.getByLabel('Leeds (HMP)').check()
    await page.getByTestId('apply-filters').click()

    await expect(page).toHaveURL(/establishments=LEI/)
  })

  test('filters by rating type and passes the selection to the API', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCsraHistory('A5197BD', history)

    await page.goto('/prisoner/A5197BD/history')

    await page.getByRole('checkbox', { name: 'High risk', exact: true }).check()
    await page.getByTestId('apply-filters').click()

    await expect(page).toHaveURL(/ratings=HIGH/)
    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.reviews.first()).toBeVisible()
  })

  test('applies multiple selections and open-ended dates, then clears all filters', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCsraHistory('A5197BD', history)
    await page.goto('/prisoner/A5197BD/history')

    await page.getByRole('checkbox', { name: 'High risk', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Standard risk', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Hull (HMP)' }).check()
    await page.locator('#fromDate').fill('1/1/2020')
    await page.getByTestId('apply-filters').click()

    const url = new URL(page.url())
    expect(url.searchParams.getAll('ratings')).toEqual(['HIGH', 'STANDARD'])
    expect(url.searchParams.getAll('establishments')).toEqual(['HLI'])
    expect(url.searchParams.get('fromDate')).toBe('1/1/2020')
    expect(url.searchParams.get('toDate')).toBe('')
    await expect(page.getByTestId('summary-total')).toHaveText('13')

    await page.getByRole('link', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL('/prisoner/A5197BD/history')
    await expect(page.getByRole('checkbox', { name: 'High risk', exact: true })).not.toBeChecked()
    await expect(page.locator('#fromDate')).toBeEmpty()
  })

  test('rejects a reversed date range without applying it', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCsraHistory('A5197BD', history)
    await page.goto('/prisoner/A5197BD/history')

    await page.locator('#fromDate').fill('2/1/2025')
    await page.locator('#toDate').fill('1/1/2025')
    await page.getByTestId('apply-filters').click()

    await expect(page.getByRole('alert')).toContainText("'Date from' must be on or before 'Date to'")
    await expect(page.getByTestId('summary-total')).toHaveText('13')
    await expect(page.locator('#fromDate')).toHaveValue('2/1/2025')
    await expect(page.locator('#toDate')).toHaveValue('1/1/2025')
  })

  test('shows an empty message when the prisoner has no history', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCsraHistory('A5197BD', {
      summary: {
        totalCsras: 0,
        highCount: 0,
        standardCount: 0,
        firstAssessmentDate: null,
        lastAssessmentDate: null,
        lastHighDate: null,
        ratings: [],
        establishments: [],
      },
      content: [],
      totalElements: 0,
      totalPages: 0,
    })

    await page.goto('/prisoner/A5197BD/history')

    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.noHistory).toContainText('There are no CSRA assessments or reviews for this prisoner.')
    await expect(historyPage.summary).toBeHidden()
    await expect(historyPage.filters).toBeHidden()
    await expect(historyPage.reviews).toHaveCount(0)
  })

  test('shows a no-results message when the selected filters return nothing', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await manageUsersApi.stubGetUserCaseloads(['LEI'])
    await csraApi.stubGetCsraHistory('A5197BD', {
      summary: history.summary,
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    })

    await page.goto('/prisoner/A5197BD/history?ratings=HIGH')

    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.summary).toBeVisible()
    await expect(historyPage.filters).toBeVisible()
    await expect(historyPage.noResults).toContainText('No history has been found for the selected filters.')
    await expect(historyPage.totalCsras).toHaveText('13')
    await expect(historyPage.highCount).toHaveText('2')
    await expect(historyPage.reviews).toHaveCount(0)
  })
})
