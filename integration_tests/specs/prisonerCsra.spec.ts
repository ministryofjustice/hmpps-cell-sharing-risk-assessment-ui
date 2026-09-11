import { expect, test, type Page } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'
import PrisonerCsraPage from '../pages/prisonerCsraPage'

const prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  dateOfBirth: '1972-02-03',
  pncNumber: '15/17564AG',
  prisonId: 'MDI',
  prisonName: 'Moorland (HMP)',
  cellLocation: 'A-1-001',
}

const stubPrisonerPage = async (page: Page, currentRating: Parameters<typeof csraApi.stubGetCurrentRating>[1]) => {
  await login(page, { roles: ['ROLE_CSRA__ASSESSMENT_EDIT', 'ROLE_CSRA__REVIEW_EDIT'] })
  await prisonerSearchApi.stubGetPrisoner(prisoner)
  await prisonApi.stubGetPrisonerImage('A1234BC')
  await manageUsersApi.stubGetUserCaseloads(['MDI'])
  await csraApi.stubGetCurrentRating('A1234BC', currentRating)
  await page.goto('/prisoner/A1234BC')
  return PrisonerCsraPage.verifyOnPage(page, 'John Smith')
}

test.describe('Prisoner CSRA', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('shows the current CSRA rating and supporting detail for a prisoner', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A1234BC')
    await manageUsersApi.stubGetUserCaseloads(['MDI'])
    await csraApi.stubGetCurrentRating('A1234BC', {
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      provisional: false,
      assessmentComment: 'PNC checked. No issues found.',
      riskTo: [{ category: 'DIFFERENT_ETHNICITY', details: 'Racist towards other ethnicities.' }],
      vulnerabilities: [{ category: 'NEURODIVERSITY', details: null }],
      finalDate: '2026-07-01',
      nextReviewDate: '2027-05-06',
    })

    await page.goto('/prisoner/A1234BC')

    const prisonerCsraPage = await PrisonerCsraPage.verifyOnPage(page, 'John Smith')
    await expect(prisonerCsraPage.prisonerBanner).toContainText('A1234BC')
    await expect(prisonerCsraPage.prisonerBanner).toContainText('3 February 1972')
    await expect(prisonerCsraPage.prisonerBanner).toContainText('15/17564AG')
    await expect(prisonerCsraPage.rating).toHaveText('High risk – specific')
    await expect(prisonerCsraPage.summary).toContainText('PNC checked. No issues found.')
    await expect(prisonerCsraPage.summary).toContainText('1 July 2026')
    await expect(prisonerCsraPage.reviewDueDateSection).toContainText('6 May 2027')
    await expect(prisonerCsraPage.riskTo).toContainText('Different ethnicity')
    await expect(prisonerCsraPage.vulnerabilities).toContainText('Neurodiversity')
  })

  test('shows a no-CSRA message when the prisoner has no current rating', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A1234BC')
    await manageUsersApi.stubGetUserCaseloads(['MDI'])
    await csraApi.stubGetCurrentRating('A1234BC', { status: 'NO_RATING', rating: null })

    await page.goto('/prisoner/A1234BC')

    const prisonerCsraPage = await PrisonerCsraPage.verifyOnPage(page, 'John Smith')
    await expect(prisonerCsraPage.noCsra).toContainText('No rating')
    await expect(prisonerCsraPage.noCsra).toContainText('This person requires an assessment.')
  })

  test('shows the assessment section when there is no rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, { status: 'NO_RATING', rating: null })

    await expect(prisonerCsraPage.assessmentSection).toBeVisible()
    await expect(prisonerCsraPage.reviewSection).toBeHidden()
    await expect(prisonerCsraPage.noCsra).toBeVisible()
  })

  test('shows an assessment in progress when an unrated assessment has started', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'NO_RATING',
      rating: null,
      inProgress: {
        reviewId: 'assessment-123',
        type: 'CSRA_INITIAL_REVIEW',
        startedBy: 'AUSER_GEN',
        startedAt: '2026-08-06T09:15:00',
      },
    })

    await expect(prisonerCsraPage.assessmentSection).toContainText('Assessment in progress')
    await expect(prisonerCsraPage.assessmentSection.getByRole('link', { name: 'Continue assessment' })).toBeVisible()
    await expect(prisonerCsraPage.reviewSection).toBeHidden()
  })

  test('shows an assessment in progress for a provisional high general rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'PROVISIONAL',
      rating: 'HIGH_GENERAL',
      provisional: true,
      ratingStage: 'PROVISIONAL',
      inProgress: { reviewId: 'assessment-123', type: 'CSRA_INITIAL_REVIEW' },
    })

    await expect(prisonerCsraPage.assessmentSection).toContainText('A provisional rating has been entered')
    await expect(prisonerCsraPage.assessmentSection.getByRole('link', { name: 'Continue assessment' })).toBeVisible()
    await expect(prisonerCsraPage.reviewSection).toBeHidden()
    await expect(prisonerCsraPage.reviewDueDateSection).toBeHidden()
  })

  test('shows an assessment in progress for a provisional high specific rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'PROVISIONAL',
      rating: 'HIGH_SPECIFIC',
      provisional: true,
      ratingStage: 'PROVISIONAL',
      inProgress: { reviewId: 'assessment-123', type: 'CSRA_INITIAL_REVIEW' },
    })

    await expect(prisonerCsraPage.assessmentSection.getByRole('link', { name: 'Continue assessment' })).toBeVisible()
    await expect(prisonerCsraPage.reviewSection).toBeHidden()
  })

  test('does not show a review due date for a standard rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, { status: 'COMPLETE', rating: 'STANDARD' })

    await expect(prisonerCsraPage.assessmentSection).toBeVisible()
    await expect(prisonerCsraPage.reviewSection).toBeVisible()
    await expect(prisonerCsraPage.reviewDueDateSection).toBeHidden()
  })

  test('shows the review due date for a high specific rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      nextReviewDate: '2027-05-06',
    })

    await expect(prisonerCsraPage.reviewDueDateSection).toContainText('6 May 2027')
    await expect(prisonerCsraPage.overdueMessage).toBeHidden()
  })

  test('shows an overdue message for a high general rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'COMPLETE',
      rating: 'HIGH_GENERAL',
      nextReviewDate: '2026-09-01',
    })

    await expect(prisonerCsraPage.reviewDueDateSection).toBeVisible()
    await expect(prisonerCsraPage.overdueMessage).toBeVisible()
  })

  test('shows the transfer message and hides the review due date for an inherited provisional rating', async ({
    page,
  }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'PROVISIONAL',
      rating: 'HIGH_GENERAL',
      provisional: true,
      ratingStage: 'PROVISIONAL',
      inheritedAfterTransfer: true,
      nextReviewDate: '2027-05-06',
    })

    await expect(prisonerCsraPage.transferMessage).toContainText('Review not completed due to prisoner transfer')
    await expect(prisonerCsraPage.reviewDueDateSection).toBeHidden()
  })

  test('shows a review in progress for a standard rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'COMPLETE',
      rating: 'STANDARD',
      inProgress: {
        reviewId: 'review-123',
        type: 'CSRA_REVIEW',
        startedBy: 'AUSER_GEN',
        startedAt: '2026-08-06T09:15:00',
      },
    })

    await expect(prisonerCsraPage.reviewSection).toContainText('Review in progress')
    await expect(prisonerCsraPage.reviewSection.getByRole('link', { name: 'Continue review' })).toBeVisible()
    await expect(prisonerCsraPage.assessmentSection).toBeHidden()
  })

  test('shows a review in progress for an interim high general rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'PROVISIONAL',
      rating: 'HIGH_GENERAL',
      provisional: true,
      ratingStage: 'INTERIM',
      inProgress: { reviewId: 'review-123', type: 'CSRA_REVIEW' },
      nextReviewDate: '2027-05-06',
    })

    await expect(prisonerCsraPage.reviewSection).toContainText('An interim rating has been entered')
    await expect(prisonerCsraPage.reviewSection.getByRole('link', { name: 'Continue review' })).toBeVisible()
    await expect(prisonerCsraPage.reviewDueDateSection).toBeVisible()
  })

  test('shows an existing review comment for a standard rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'COMPLETE',
      rating: 'STANDARD',
      assessmentComment: 'Review comment recorded.',
    })

    await expect(prisonerCsraPage.assessmentComment).toContainText('Review comment recorded.')
  })

  test('shows an existing review comment for a high specific rating', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      assessmentComment: 'Review comment recorded.',
    })

    await expect(prisonerCsraPage.assessmentComment).toBeVisible()
  })

  test('shows an overdue message and existing review comment together', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'COMPLETE',
      rating: 'HIGH_GENERAL',
      nextReviewDate: '2026-09-01',
      assessmentComment: 'Review comment recorded.',
    })

    await expect(prisonerCsraPage.overdueMessage).toBeVisible()
    await expect(prisonerCsraPage.assessmentComment).toBeVisible()
  })

  test('shows an inherited interim rating and existing review comment', async ({ page }) => {
    const prisonerCsraPage = await stubPrisonerPage(page, {
      status: 'PROVISIONAL',
      rating: 'HIGH_GENERAL',
      provisional: true,
      ratingStage: 'INTERIM',
      inheritedAfterTransfer: true,
      assessmentComment: 'Review comment recorded.',
    })

    await expect(prisonerCsraPage.transferMessage).toBeVisible()
    await expect(prisonerCsraPage.assessmentComment).toBeVisible()
  })

  test('starts a new assessment and lands on the task list', async ({ page }) => {
    await login(page, { roles: ['ROLE_CSRA__ASSESSMENT_EDIT'] })
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A1234BC')
    await manageUsersApi.stubGetUserCaseloads(['MDI'])
    await csraApi.stubGetCurrentRating('A1234BC', { status: 'NO_RATING', rating: null })
    await csraApi.stubStartAssessment('A1234BC', 'assessment-123')
    await csraApi.stubGetAssessment('A1234BC', 'assessment-123', {
      status: 'IN_PROGRESS',
      stages: [
        {
          stage: 'PROVISIONAL',
          prisonId: 'MDI',
          dpsChecked: true,
          perChecked: false,
          warrantChecked: false,
          pncChecked: true,
          offenceEvidence: [],
          riskTo: [],
          vulnerabilities: [],
          version: 0,
        },
      ],
    })

    await page.goto('/prisoner/A1234BC')
    await page.getByRole('link', { name: 'Start assessment' }).click()

    await expect(page).toHaveURL(/\/prisoner\/A1234BC\/csra\/assessment-123$/)
    await expect(page.getByRole('heading', { name: 'CSRA for John Smith' })).toBeVisible()
    await expect(page.getByText('Evidence sources and offences')).toBeVisible()
    await expect(page.getByText('Check answers and confirm rating')).toBeVisible()
  })

  test('can reach the confirm-rating page and submit the provisional rating', async ({ page }) => {
    await login(page)
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A1234BC')
    await manageUsersApi.stubGetUserCaseloads(['MDI'])
    await csraApi.stubGetCurrentRating('A1234BC', { status: 'NO_RATING', rating: null })
    await csraApi.stubGetAssessment('A1234BC', 'assessment-123', {
      status: 'IN_PROGRESS',
      stages: [
        {
          stage: 'PROVISIONAL',
          prisonId: 'MDI',
          dpsChecked: true,
          perChecked: true,
          warrantChecked: false,
          pncChecked: true,
          officerSpokeToPrisoner: true,
          likelyToHarmCellmate: true,
          likelyToHarmCellmateDetail: 'Threatened to assault a cellmate.',
          significantlyVulnerable: false,
          causeForConcernSharing: false,
          otherHighRiskIndicators: false,
          seenByHealthcare: true,
          healthcareIncreasedRisk: true,
          healthcareIncreasedRiskDetail: 'Healthcare flagged an increased risk.',
          offenceEvidence: [],
          riskTo: [],
          vulnerabilities: [],
          version: 0,
        },
      ],
    })
    await csraApi.stubSubmitProvisionalRating('A1234BC', 'assessment-123')

    await page.goto('/prisoner/A1234BC/csra/assessment-123/confirm-rating')

    await expect(page.getByRole('heading', { name: 'Check answers before you confirm a CSRA rating' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'WIP: Save provisional rating' })).toBeVisible()

    await page.getByRole('button', { name: 'WIP: Save provisional rating' }).click()

    await expect(page).toHaveURL('/prisoner/A1234BC')
  })
})
