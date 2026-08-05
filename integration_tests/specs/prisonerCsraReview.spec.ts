import { expect, test } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'
import PrisonerCsraReviewPage from '../pages/prisonerCsraReviewPage'
import PrisonerCsraHistoryPage from '../pages/prisonerCsraHistoryPage'
import type { CsraReviewDetail, CsraReviewHistory } from '../../server/data/csraApiTypes'

const REVIEW_ID = 'de91dfa7-821f-4552-a427-bf2f32eafeb0'

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

const legacy: Partial<CsraReviewDetail> = {
  finalResult: 'HIGH',
  finalResultDate: '2016-10-31',
  legacy: {
    level: 'HI',
    approvedResult: 'HI',
    calculatedResult: 'STANDARD',
    approvalCommitteeComment: 'Agreed at review board.',
    approvalCommittee: { code: 'REVIEW', name: 'Review Board' },
    approvalDate: '2016-11-02',
    assessmentComment: 'Previous violence towards cellmates.',
    assessmentCommittee: { code: 'RECP', name: 'Reception' },
    nextReviewDate: '2017-10-31',
    questions: [
      { question: 'Select Risk Rating', answer: 'High', additionalAnswers: [] },
      { question: 'Who is this person a risk to?', answer: 'Different ethnicity', additionalAnswers: ['Transgender'] },
      { question: 'Never answered', answer: null, additionalAnswers: [] },
    ],
  },
}

const history: CsraReviewHistory = {
  summary: { totalCsras: 1, highCount: 1, standardCount: 0 },
  content: [
    {
      id: REVIEW_ID,
      type: 'REVIEW',
      rating: 'HIGH',
      reviewComment: 'Previous violence towards cellmates.',
      prisonId: 'LEI',
      recordedDate: '2016-10-31',
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
}

const signInAs = async (page: Parameters<typeof login>[0]) => {
  await login(page)
  await prisonerSearchApi.stubGetPrisoner(prisoner)
  await prisonApi.stubGetPrisonerImage('A5197BD')
  await manageUsersApi.stubGetUserCaseloads(['LEI'])
}

test.describe('CSRA review detail', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('shows the legacy NOMIS record and its questions and answers', async ({ page }) => {
    await signInAs(page)
    await csraApi.stubGetCsraReview(REVIEW_ID, legacy)

    await page.goto(`/prisoner/A5197BD/history/${REVIEW_ID}`)

    const reviewPage = await PrisonerCsraReviewPage.verifyOnPage(page)
    await expect(reviewPage.heading).toContainText('31 October 2016')
    await expect(reviewPage.prisonerBanner).toContainText('Daniel Havers')
    await expect(reviewPage.rating).toHaveText('High')

    await expect(reviewPage.details).toContainText('Approved result')
    await expect(reviewPage.details).toContainText('Agreed at review board.')
    await expect(reviewPage.details).toContainText('Review Board')
    await expect(reviewPage.details).toContainText('2 November 2016')
    await expect(reviewPage.details).toContainText('Previous violence towards cellmates.')
    await expect(reviewPage.details).toContainText('Leeds (HMP)')
    await expect(reviewPage.details).toContainText('Reception')
    await expect(reviewPage.details).toContainText('31 October 2017')
    // Not in the NOMIS migration contract, so never offered.
    await expect(reviewPage.details).not.toContainText('Override')

    await expect(reviewPage.questions).toContainText('Select Risk Rating')
    // The additional answer the existing DPS profile page drops.
    await expect(reviewPage.questions).toContainText('Transgender')
    await expect(reviewPage.questions).not.toContainText('Never answered')
  })

  test('says the captured answers are not available for a review created in this service', async ({ page }) => {
    await signInAs(page)
    await csraApi.stubGetCsraReview(REVIEW_ID, {
      type: 'CSRA_INITIAL_REVIEW',
      interimResult: 'STANDARD',
      interimResultDate: '2026-08-03',
      legacy: null,
    })

    await page.goto(`/prisoner/A5197BD/history/${REVIEW_ID}`)

    const reviewPage = await PrisonerCsraReviewPage.verifyOnPage(page)
    await expect(reviewPage.details).toContainText('CSRA initial review')
    await expect(reviewPage.dpsAnswersNote).toContainText('not available in this service yet')
    await expect(reviewPage.questions).toHaveCount(0)
  })

  test('is reachable from the history page, and keeps the worklist in the breadcrumbs', async ({ page }) => {
    await signInAs(page)
    await csraApi.stubGetCsraHistory('A5197BD', history)
    await csraApi.stubGetCsraReview(REVIEW_ID, legacy)

    await page.goto('/prisoner/A5197BD/history?from=due-for-review')

    const historyPage = await PrisonerCsraHistoryPage.verifyOnPage(page)
    await historyPage.reviews.first().getByTestId('view-full-review').click()

    const reviewPage = await PrisonerCsraReviewPage.verifyOnPage(page)
    await expect(reviewPage.breadcrumbs).toContainText('High risk prisoners due for review')
    await expect(reviewPage.breadcrumbs).toContainText('Daniel Havers')
    await expect(reviewPage.breadcrumbs).toContainText('CSRA history')
    await expect(reviewPage.breadcrumbs.getByRole('link', { name: 'Daniel Havers' })).toHaveAttribute(
      'href',
      '/prisoner/A5197BD?from=due-for-review',
    )
  })

  test('shows the not-found page when the review does not exist', async ({ page }) => {
    await signInAs(page)
    await csraApi.stubGetCsraReviewNotFound(REVIEW_ID)

    const response = await page.goto(`/prisoner/A5197BD/history/${REVIEW_ID}`)

    expect(response?.status()).toBe(404)
  })
})
