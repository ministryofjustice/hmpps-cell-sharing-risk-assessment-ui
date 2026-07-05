import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
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
  },
  content: [
    {
      id: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
      type: 'REVIEW',
      rating: 'STANDARD',
      reviewComment: 'No concerns identified at this review.',
      prisonId: 'LEI',
      recordedDate: '2025-10-11',
    },
    {
      id: 'a2b3c4d5-e6f7-4890-a123-b456c789d012',
      type: 'REVIEW',
      rating: 'HIGH_SPECIFIC',
      reviewComment: 'Cannot share with specific groups.',
      prisonId: 'LEI',
      recordedDate: '2024-07-23',
    },
  ],
  page: 0,
  size: 20,
  totalElements: 13,
  totalPages: 5,
}

test.describe('Prisoner CSRA history', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('shows the summary, banner and history reviews for a prisoner', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await csraApi.stubGetCsraHistory('A5197BD', history)

    await page.goto('/prisoner/A5197BD/history')

    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.prisonerBanner).toContainText('Daniel Havers')
    await expect(historyPage.prisonerBanner).toContainText('15/17564AG')
    await expect(historyPage.totalCsras).toHaveText('13')
    await expect(historyPage.highCount).toHaveText('2')
    await expect(historyPage.standardCount).toHaveText('11')
    await expect(historyPage.summary).toContainText('June 2011')
    await expect(historyPage.summary).toContainText('Last high 14 July 2013')
    await expect(historyPage.reviews).toHaveCount(2)
    await expect(historyPage.reviews.first()).toContainText('Standard')
    await expect(historyPage.reviews.first()).toContainText('No concerns identified at this review.')
    await expect(historyPage.reviews.nth(1)).toContainText('High risk – specific')
    await expect(historyPage.pagination).toContainText('of 13 CSRAs')
  })

  test('filters by rating type and passes the selection to the API', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await csraApi.stubGetCsraHistory('A5197BD', history)

    await page.goto('/prisoner/A5197BD/history')

    await page.getByLabel('High (2)').check()
    await page.getByTestId('apply-filters').click()

    await expect(page).toHaveURL(/ratings=HIGH/)
    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.reviews.first()).toBeVisible()
  })

  test('shows an empty message when the prisoner has no history', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A5197BD')
    await csraApi.stubGetCsraHistory('A5197BD', {
      summary: { totalCsras: 0, highCount: 0, standardCount: 0 },
      content: [],
      totalElements: 0,
      totalPages: 0,
    })

    await page.goto('/prisoner/A5197BD/history')

    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await expect(historyPage.noResults).toContainText('No CSRAs found.')
  })
})
