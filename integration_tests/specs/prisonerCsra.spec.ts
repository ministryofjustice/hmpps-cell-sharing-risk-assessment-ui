import { expect, test, type Page } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { login, resetStubs } from '../testUtils'
import PrisonerCsraPage from '../pages/prisonerCsraPage'
import type { CsraAssessmentStageAnswers } from '../../server/data/csraApiTypes'
import { getMatchingRequests } from '../mockApis/wiremock'

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
  await login(page, {
    roles: ['ROLE_CSRA__ASSESSMENT_EDIT', 'ROLE_CSRA__REVIEW_EDIT'],
    activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
  })
  await csraApi.stubGetInfo(['MDI'])
  await prisonerSearchApi.stubGetPrisoner(prisoner)
  await prisonApi.stubGetPrisonerImage('A1234BC')
  await manageUsersApi.stubGetUserCaseloads(['MDI'])
  await csraApi.stubGetCurrentRating('A1234BC', currentRating)
  await page.goto('/prisoner/A1234BC')
  return PrisonerCsraPage.verifyOnPage(page, 'John Smith')
}

const completeAssessmentAnswers = (
  overrides: Partial<CsraAssessmentStageAnswers> = {},
): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: prisoner.prisonId,
  dpsChecked: true,
  perChecked: true,
  warrantChecked: true,
  pncChecked: true,
  offenceMurderManslaughter: false,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [],
  officerSpokeToPrisoner: true,
  likelyToHarmCellmate: false,
  significantlyVulnerable: false,
  causeForConcernSharing: false,
  otherHighRiskIndicators: false,
  seenByHealthcare: true,
  healthcareIncreasedRisk: false,
  riskTo: [],
  vulnerabilities: [],
  version: 0,
  ...overrides,
})

const stubRatingSelectionAssessment = async (page: Page, answers: CsraAssessmentStageAnswers) => {
  await login(page, {
    roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
    activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
  })
  await csraApi.stubGetInfo(['MDI'])
  await prisonerSearchApi.stubGetPrisoner(prisoner)
  await prisonApi.stubGetPrisonerImage(prisoner.prisonerNumber)
  await manageUsersApi.stubGetUserCaseloads(['MDI'])
  await csraApi.stubGetCurrentRating(prisoner.prisonerNumber, { status: 'NO_RATING', rating: null })
  await csraApi.stubGetAssessment(prisoner.prisonerNumber, 'assessment-123', {
    status: 'IN_PROGRESS',
    stages: [answers],
  })
}

test.describe('Prisoner CSRA', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  test('shows the current CSRA rating and supporting detail for a prisoner', async ({ page }) => {
    await login(page, { activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName } })
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
    await login(page, { activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName } })
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

  test('hides assessment and review sections when the user does not have the required roles', async ({ page }) => {
    await login(page, {
      roles: [],
      activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
    })
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A1234BC')
    await manageUsersApi.stubGetUserCaseloads(['MDI'])
    await csraApi.stubGetCurrentRating('A1234BC', {
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      nextReviewDate: '2027-05-06',
      inProgress: {
        reviewId: 'review-123',
        type: 'CSRA_REVIEW',
        startedBy: 'AUSER_GEN',
        startedAt: '2026-08-06T09:15:00',
      },
    })

    await page.goto('/prisoner/A1234BC')

    const prisonerCsraPage = await PrisonerCsraPage.verifyOnPage(page, 'John Smith')
    await expect(prisonerCsraPage.assessmentSection).toBeHidden()
    await expect(prisonerCsraPage.reviewSection).toBeHidden()
    await expect(prisonerCsraPage.reviewDueDateSection).toBeVisible()
  })

  test('hides assessment and review sections when the prison is disabled', async ({ page }) => {
    await login(page, {
      roles: ['ROLE_CSRA__ASSESSMENT_EDIT', 'ROLE_CSRA__REVIEW_EDIT'],
      activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
    })
    await csraApi.stubGetInfo([])
    await prisonerSearchApi.stubGetPrisoner(prisoner)
    await prisonApi.stubGetPrisonerImage('A1234BC')
    await manageUsersApi.stubGetUserCaseloads(['MDI'])
    await csraApi.stubGetCurrentRating('A1234BC', {
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      nextReviewDate: '2027-05-06',
      inProgress: {
        reviewId: 'review-123',
        type: 'CSRA_REVIEW',
        startedBy: 'AUSER_GEN',
        startedAt: '2026-08-06T09:15:00',
      },
    })

    await page.goto('/prisoner/A1234BC')

    const prisonerCsraPage = await PrisonerCsraPage.verifyOnPage(page, 'John Smith')
    await expect(prisonerCsraPage.assessmentSection).toBeHidden()
    await expect(prisonerCsraPage.reviewSection).toBeHidden()
    await expect(prisonerCsraPage.reviewDueDateSection).toBeVisible()
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
    await login(page, {
      roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
      activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
    })
    await csraApi.stubGetInfo(['MDI'])
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

  test('can reach the check answers page for a provisional rating', async ({ page }) => {
    await csraApi.stubGetInfo(['MDI'])
    await login(page, {
      roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
      activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
    })
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
          offenceMurderManslaughter: false,
          offenceAssistingSuicide: false,
          offenceSexualAssault: false,
          offenceRepeatedViolence: false,
          offencePrejudiceMotivated: false,
          offenceArson: false,
          offenceKidnapHostage: false,
          offenceEvidence: [],
          riskTo: [],
          vulnerabilities: [],
          version: 0,
        },
      ],
    })

    await page.goto('/prisoner/A1234BC/csra/assessment-123')
    await page.getByRole('link', { name: 'Check answers and confirm rating' }).click()

    await expect(page.getByRole('heading', { name: 'Check answers before you confirm a CSRA rating' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue to provisional rating' })).toBeVisible()
    await expect(page.getByText('Warrant', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Remaining tasks to complete' })).toBeVisible()
    await expect(page.getByText('check remaining evidence sources (Warrant)')).toBeVisible()
  })

  test('selects a rating with an accessible validation error and preserves the choice', async ({ page }) => {
    await stubRatingSelectionAssessment(page, completeAssessmentAnswers())

    await page.goto('/prisoner/A1234BC/csra/assessment-123/select-rating')

    await expect(page.getByRole('heading', { name: 'Select a CSRA rating' })).toBeVisible()
    await expect(page.getByText('This prisoner does not have a current CSRA rating.')).toBeVisible()
    await expect(page.getByRole('radio', { name: /High risk – general/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /High risk – specific/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Standard risk/ })).toBeVisible()

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('alert')).toContainText('Select a CSRA rating')

    await page.goto('/prisoner/A1234BC/csra/assessment-123/select-rating?selectedRating=HIGH_SPECIFIC')
    await expect(page.getByRole('radio', { name: /High risk – specific/ })).toBeChecked()
  })

  test('offers the local or remand exception for an incomplete assessment without a clear high-risk offence', async ({
    page,
  }) => {
    await stubRatingSelectionAssessment(page, completeAssessmentAnswers({ seenByHealthcare: false }))

    await page.goto('/prisoner/A1234BC/csra/assessment-123/select-rating')

    await expect(page.getByRole('heading', { name: 'Provisional CSRA rating' })).toBeVisible()
    await expect(page.getByText('This is because the assessment is incomplete.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Exception for local or remand prisons' })).toBeVisible()
    await expect(page.getByText(/manager to approve who the prisoner shares a cell with/)).toBeVisible()

    const exceptionButton = page.getByRole('button', {
      name: 'Continue with high risk – specific (provisional)',
    })
    await expect(exceptionButton).toBeVisible()
    await exceptionButton.click()
    await expect(page).toHaveURL(/\/confirm-rating\/HIGH_SPECIFIC$/)
    await expect(page.getByRole('heading', { name: 'Confirm provisional CSRA rating' })).toBeVisible()
    await expect(page.locator('.moj-ticket-panel')).toContainText('High risk – specific (provisional)')
    await expect(page.getByLabel('Review date')).toHaveCount(0)

    await csraApi.stubSubmitProvisionalRating(prisoner.prisonerNumber, 'assessment-123')
    await page.getByLabel('Assessment comment').fill('All available sources checked. Manager approved sharing.')
    await page.getByRole('button', { name: 'Confirm rating' }).click()
    await expect(page).toHaveURL('/prisoner/A1234BC')
    await expect(page.getByRole('alert')).toContainText(
      'John’s CSRA rating has been confirmed as high risk – specific (provisional).',
    )
    const submissions = await getMatchingRequests({
      method: 'PUT',
      urlPath: '/csra-api/csra-review/prisoner/A1234BC/assessment/assessment-123/provisional',
    })
    expect(submissions.body.requests).toHaveLength(1)
    expect(JSON.parse(submissions.body.requests[0].body)).toMatchObject({
      rating: 'HIGH_SPECIFIC',
      assessmentComment: 'All available sources checked. Manager approved sharing.',
    })
    await page.reload()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('does not offer the local or remand exception when a clear high-risk offence requires high-general provisional', async ({
    page,
  }) => {
    await stubRatingSelectionAssessment(
      page,
      completeAssessmentAnswers({
        offenceMurderManslaughter: true,
        offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Evidence details' }],
        seenByHealthcare: false,
      }),
    )

    await page.goto('/prisoner/A1234BC/csra/assessment-123/select-rating')

    await expect(page.getByRole('heading', { name: 'Provisional CSRA rating' })).toBeVisible()
    await expect(page.getByRole('button')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Continue with high risk – general (provisional)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Exception for local or remand prisons' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Continue with high risk – general (provisional)' }).click()
    await expect(page).toHaveURL(/\/confirm-rating\/HIGH_GENERAL$/)
    await expect(page.getByRole('heading', { name: 'Confirm provisional CSRA rating' })).toBeVisible()
    await expect(page.locator('.moj-ticket-panel')).toContainText('High risk – general (provisional)')
    await expect(page.getByLabel('Review date')).toHaveCount(0)

    await csraApi.stubSubmitProvisionalRating(prisoner.prisonerNumber, 'assessment-123')
    await page.getByLabel('Assessment comment').fill('High-risk evidence found. Awaiting healthcare assessment.')
    await page.getByRole('button', { name: 'Confirm rating' }).click()
    await expect(page).toHaveURL('/prisoner/A1234BC')
    await expect(page.getByRole('alert')).toContainText(
      'John’s CSRA rating has been confirmed as high risk – general (provisional).',
    )
    const submissions = await getMatchingRequests({
      method: 'PUT',
      urlPath: '/csra-api/csra-review/prisoner/A1234BC/assessment/assessment-123/provisional',
    })
    expect(submissions.body.requests).toHaveLength(1)
    expect(JSON.parse(submissions.body.requests[0].body)).toMatchObject({
      rating: 'HIGH_GENERAL',
      assessmentComment: 'High-risk evidence found. Awaiting healthcare assessment.',
    })
    expect(JSON.parse(submissions.body.requests[0].body)).not.toHaveProperty('nextReviewDate')
  })

  test('shows the fixed high-general rating when a clear high-risk offence is recorded', async ({ page }) => {
    await stubRatingSelectionAssessment(
      page,
      completeAssessmentAnswers({
        offenceMurderManslaughter: true,
        offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Evidence details' }],
      }),
    )

    await page.goto('/prisoner/A1234BC/csra/assessment-123/select-rating')

    await expect(page.getByRole('heading', { name: 'CSRA rating' })).toBeVisible()
    await expect(
      page.getByText('The rating must be high risk – general and the prisoner must not share a cell.'),
    ).toBeVisible()
    await expect(page.getByText('murder, manslaughter or life-threatening assault in custody')).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue with high risk – general' })).toBeVisible()

    await page.getByRole('button', { name: 'Continue with high risk – general' }).click()
    await expect(page.getByRole('heading', { name: 'Confirm CSRA rating', exact: true })).toBeVisible()
    await expect(page.getByLabel('Review date')).toBeVisible()

    await page.getByRole('button', { name: 'Confirm rating' }).click()
    await expect(page.getByRole('alert')).toContainText('Enter an assessment comment')
    await expect(page.getByRole('alert')).toContainText('Enter or select a date')

    await page.getByLabel('Assessment comment').fill('Clear evidence requires the prisoner not to share a cell.')
    await page.getByLabel('Review date').fill('31/2/2099')
    await page.getByRole('button', { name: 'Confirm rating' }).click()
    await expect(page.getByRole('alert')).toContainText('Enter a real date')
    await expect(page.getByLabel('Assessment comment')).toHaveValue(
      'Clear evidence requires the prisoner not to share a cell.',
    )

    await csraApi.stubSubmitFinalRating(prisoner.prisonerNumber, 'assessment-123')
    await page.getByLabel('Review date').fill('17/5/2099')
    await page.getByRole('button', { name: 'Confirm rating' }).click()
    await expect(page).toHaveURL('/prisoner/A1234BC')
    await expect(page.getByRole('alert')).toContainText('John’s CSRA rating has been confirmed as high risk – general.')
    const submissions = await getMatchingRequests({
      method: 'PUT',
      urlPath: '/csra-api/csra-review/prisoner/A1234BC/assessment/assessment-123/final',
    })
    expect(submissions.body.requests).toHaveLength(1)
    expect(JSON.parse(submissions.body.requests[0].body)).toMatchObject({
      rating: 'HIGH_GENERAL',
      assessmentComment: 'Clear evidence requires the prisoner not to share a cell.',
      nextReviewDate: '2099-05-17',
    })
  })

  test('confirms a standard final rating without a review date and can return to change the selection', async ({
    page,
  }) => {
    await stubRatingSelectionAssessment(page, completeAssessmentAnswers())
    await csraApi.stubSubmitFinalRating(prisoner.prisonerNumber, 'assessment-123')
    await page.goto('/prisoner/A1234BC/csra/assessment-123/select-rating')
    await page.getByRole('radio', { name: 'Standard risk', exact: true }).check()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page).toHaveURL(/\/confirm-rating\/STANDARD$/)
    await expect(page.getByLabel('Review date')).toHaveCount(0)
    await page.getByRole('link', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Standard risk', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByLabel('Assessment comment').fill('No increased risks identified.')
    await page.getByRole('button', { name: 'Confirm rating' }).click()
    await expect(page).toHaveURL('/prisoner/A1234BC')
    await expect(page.getByRole('alert')).toContainText('John’s CSRA rating has been confirmed as standard.')
    const submissions = await getMatchingRequests({
      method: 'PUT',
      urlPath: '/csra-api/csra-review/prisoner/A1234BC/assessment/assessment-123/final',
    })
    expect(submissions.body.requests).toHaveLength(1)
    expect(JSON.parse(submissions.body.requests[0].body)).toMatchObject({ rating: 'STANDARD' })
    expect(JSON.parse(submissions.body.requests[0].body)).not.toHaveProperty('nextReviewDate')
  })
})
