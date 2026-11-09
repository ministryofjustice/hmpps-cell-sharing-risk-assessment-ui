import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import csraApi from '../mockApis/csraApi'
import courtDataApi from '../mockApis/courtDataApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { getMatchingRequests, stubFor } from '../mockApis/wiremock'
import { login, resetStubs } from '../testUtils'
import type { CsraAssessment, CsraAssessmentStageAnswers } from '../../server/data/csraApiTypes'

const ASSESSMENT_ID = 'a1b2c3d4-0000-4000-a000-000000000003'
const TASK_LIST_URL = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`
const REVIEW_URL = `${TASK_LIST_URL}/review-provisional`
const ASSESSMENT_API_URL = `/csra-api/csra-review/prisoner/A1234BC/assessment/${ASSESSMENT_ID}`
const ANSWERS_API_URL = `${ASSESSMENT_API_URL}/stage/FINAL/answers`
const REVIEW_LINK = 'Review provisional assessment'
const YES = "Yes, I've reviewed it"
const NO = "No, I'll come back to it later"

const completeAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
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
  version: 1,
  ...overrides,
})

const provisionalAnswers = completeAnswers({
  pncChecked: false,
  warrantChecked: false,
  officerSpokeToPrisoner: false,
  likelyToHarmCellmate: true,
  likelyToHarmCellmateDetail: 'Hidden conversation detail',
  significantlyVulnerable: true,
  significantlyVulnerableDetail: 'Hidden vulnerability detail',
  causeForConcernSharing: null,
  otherHighRiskIndicators: null,
  seenByHealthcare: false,
  healthcareIncreasedRisk: true,
  healthcareIncreasedRiskDetail: 'Hidden healthcare detail',
})

const assessment = (stages = [provisionalAnswers]): CsraAssessment => ({
  assessmentId: ASSESSMENT_ID,
  prisonerNumber: 'A1234BC',
  prisonId: 'MDI',
  status: 'IN_PROGRESS',
  startedBy: 'AUSER_GEN',
  startedAt: '2026-07-06T20:00:00',
  interimResult: 'HIGH_SPECIFIC',
  stages,
})

const reviewTask = (page: Page) => page.locator('.govuk-task-list__item').filter({ hasText: REVIEW_LINK })
const ratingTask = (page: Page) =>
  page.locator('.govuk-task-list__item').filter({ hasText: 'Check answers and confirm rating' })
const summarySection = (page: Page, heading: string) =>
  page.locator('.csra-check-answers-section').filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
const remainingTasks = (page: Page) => page.locator('.guidance-panel li')

const savedRequests = async () => {
  const response = await getMatchingRequests({ method: 'PUT', url: ANSWERS_API_URL })
  return response.body.requests as { body: string }[]
}

const stubReviewSaves = async (initial: CsraAssessment, savedStages: CsraAssessmentStageAnswers[]) => {
  const scenarioName = `Review provisional assessment ${randomUUID()}`
  const snapshots = [initial, ...savedStages.map(stage => ({ ...initial, stages: [initial.stages[0], stage] }))]
  await Promise.all(
    snapshots.map((snapshot, index) =>
      stubFor({
        priority: 1,
        scenarioName,
        requiredScenarioState: index === 0 ? 'Started' : `Saved ${index}`,
        request: { method: 'GET', url: ASSESSMENT_API_URL },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: snapshot,
        },
      }),
    ),
  )
  await Promise.all(
    savedStages.map((stage, index) =>
      stubFor({
        scenarioName,
        requiredScenarioState: index === 0 ? 'Started' : `Saved ${index}`,
        newScenarioState: `Saved ${index + 1}`,
        request: {
          method: 'PUT',
          url: ANSWERS_API_URL,
          bodyPatterns: [{ equalToJson: stage }],
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: snapshots[index + 1],
        },
      }),
    ),
  )
}

const stubPrisoner = async () => {
  await Promise.all([
    csraApi.stubGetInfo(['MDI']),
    prisonerSearchApi.stubGetPrisoner({
      prisonerNumber: 'A1234BC',
      firstName: 'JOHN',
      lastName: 'SMITH',
      dateOfBirth: '1972-02-03',
      prisonId: 'MDI',
      prisonName: 'Moorland (HMP)',
      cellLocation: 'A-1-001',
    }),
    prisonApi.stubGetPrisonerImage('A1234BC'),
    manageUsersApi.stubGetUserCaseloads(['MDI']),
    manageUsersApi.stubGetUserDetails('DBENTLEY', 'David Bentley'),
    courtDataApi.stubGetCourtHearings('A1234BC', []),
    csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID, assessment()),
    csraApi.stubGetDetailedRating('A1234BC', ASSESSMENT_ID, {
      prisonId: 'LEI',
      prisonName: 'Leeds (HMP)',
      provisionalAssessmentComment: 'Late arrival. No PNC or access to warrant.',
      provisionalDate: '2026-07-06',
      provisionalTime: '21:07:59',
      provisionalCompletedBy: 'DBENTLEY',
    }),
  ])
}

test.afterEach(async () => {
  await resetStubs()
})

test.describe('Review provisional assessment', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, {
      roles: ['ROLE_CSRA__ASSESSMENT_EDIT'],
      activeCaseLoad: { caseLoadId: 'MDI', description: 'Moorland (HMP)' },
    })
    await stubPrisoner()
    await page.goto(TASK_LIST_URL)
  })

  test('opens from the default task and shows recorded metadata and read-only provisional playback', async ({
    page,
  }) => {
    await csraApi.stubGetAssessment(
      'A1234BC',
      ASSESSMENT_ID,
      assessment([provisionalAnswers, completeAnswers({ stage: 'FINAL' })]),
    )
    await expect(page.getByRole('heading', { name: 'Provisional assessment', exact: true })).toBeVisible()
    await expect(reviewTask(page)).toContainText('Not yet started')
    await expect(page.getByRole('link', { name: REVIEW_LINK, exact: true })).toHaveAttribute('href', REVIEW_URL)
    await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()

    await expect(page).toHaveURL(REVIEW_URL)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Provisional cell sharing risk assessment - John Smith',
    )
    await expect(page.getByTestId('compact-prisoner-banner')).toContainText('Prison number: A1234BC')
    await expect(page.getByTestId('compact-prisoner-banner')).toContainText('Date of birth: 3 February 1972')
    await expect(page.getByTestId('compact-prisoner-banner')).toContainText('John Smith')
    await expect(page.getByText('Assessed at Leeds (HMP) on 6 July 2026 at 21:07', { exact: true })).toBeVisible()
    const rating = page.locator('.govuk-summary-list').first()
    await expect(rating).toContainText('High risk – specific (provisional)')
    await expect(rating).toContainText('Late arrival. No PNC or access to warrant.')
    await expect(rating).toContainText('David Bentley')
    await expect(rating.locator('.govuk-tag')).toHaveCount(0)
    await expect(page.locator('.csra-check-answers-section h2')).toHaveText([
      'Evidence sources',
      'Offences',
      'Prisoner conversation and vulnerability',
      'Officer observation',
      'Other risk factors',
      'Healthcare assessment',
    ])
    await expect(summarySection(page, 'Evidence sources').locator('.govuk-summary-list__value')).toHaveText([
      'Checked',
      'Checked',
      'Not checked',
      'Not checked',
    ])
    await expect(summarySection(page, 'Offences').locator('.govuk-summary-list__value')).toHaveText(Array(7).fill('No'))
    await expect(
      summarySection(page, 'Prisoner conversation and vulnerability').locator('.govuk-summary-list__value'),
    ).toHaveText(['No'])
    await expect(summarySection(page, 'Officer observation')).toContainText('Not answered')
    await expect(summarySection(page, 'Other risk factors')).toContainText('Not answered')
    await expect(summarySection(page, 'Healthcare assessment').locator('.govuk-summary-list__value')).toHaveText(['No'])
    await expect(page.getByRole('link', { name: /^Change/ })).toHaveCount(0)
    await expect(page.locator('.govuk-summary-list__actions')).toHaveCount(0)
    await expect(page.getByText('Hidden conversation detail')).toHaveCount(0)
    await expect(page.getByText('Hidden vulnerability detail')).toHaveCount(0)
    await expect(page.getByText('Hidden healthcare detail')).toHaveCount(0)
    await expect(page.getByText(/It will stay provisional/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Continue to provisional rating' })).toHaveCount(0)
    await expect(page.getByRole('group')).toContainText('Have you reviewed the provisional assessment?')
    await expect(page.getByRole('radio', { name: YES, exact: true })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: NO, exact: true })).not.toBeChecked()
    await expect(remainingTasks(page)).toHaveText([
      'check remaining evidence sources (PNC, Warrant)',
      'review offence questions after checking remaining evidence sources',
      'speak to the prisoner about sharing a cell',
      'record any observations that cause a cell sharing concern',
      'record any other indicators that suggest the prisoner is high risk',
      'ensure the prisoner has been seen by healthcare',
    ])
  })

  test('plays back offence evidence and applicable follow-up details without a remaining-tasks panel', async ({
    page,
  }) => {
    const answers = completeAnswers({
      offenceArson: true,
      offenceEvidence: [
        {
          offence: 'ARSON',
          sources: ['PNC', 'OTHER'],
          otherSourceDetail: 'Officer report',
          details: 'Recorded fire setting.',
        },
      ],
      likelyToHarmCellmate: true,
      likelyToHarmCellmateDetail: 'Threatened a cellmate.',
      significantlyVulnerable: true,
      significantlyVulnerableDetail: 'Targeted by other prisoners.',
      causeForConcernSharing: true,
      causeForConcernSharingDetail: 'Observed threatening behaviour.',
      otherHighRiskIndicators: true,
      otherHighRiskIndicatorsDetail: 'Additional risk evidence.',
      healthcareIncreasedRisk: true,
      healthcareIncreasedRiskDetail: 'Healthcare risk summary.',
    })
    await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID, assessment([answers]))
    await page.goto(REVIEW_URL)

    await expect(summarySection(page, 'Offences')).toContainText('Yes – Recorded fire setting.')
    await expect(summarySection(page, 'Offences')).toContainText('Sources: PNC and Other - Officer report')
    await expect(summarySection(page, 'Prisoner conversation and vulnerability')).toContainText(
      'Yes – Threatened a cellmate.',
    )
    await expect(summarySection(page, 'Prisoner conversation and vulnerability')).toContainText(
      'Yes – Targeted by other prisoners.',
    )
    await expect(summarySection(page, 'Officer observation')).toContainText('Yes – Observed threatening behaviour.')
    await expect(summarySection(page, 'Other risk factors')).toContainText('Yes – Additional risk evidence.')
    await expect(summarySection(page, 'Healthcare assessment')).toContainText('Yes – Healthcare risk summary.')
    await expect(page.getByRole('heading', { name: 'Remaining tasks to complete' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Change/ })).toHaveCount(0)
  })

  test('hides stale No follow-up details and shows only applicable remaining tasks', async ({ page }) => {
    await csraApi.stubGetAssessment(
      'A1234BC',
      ASSESSMENT_ID,
      assessment([
        completeAnswers({
          likelyToHarmCellmate: true,
          likelyToHarmCellmateDetail: null,
          significantlyVulnerableDetail: 'Stale vulnerability detail',
          causeForConcernSharingDetail: 'Stale observation detail',
          otherHighRiskIndicatorsDetail: 'Stale other risk detail',
          healthcareIncreasedRiskDetail: 'Stale healthcare detail',
        }),
      ]),
    )
    await page.goto(REVIEW_URL)

    await expect(remainingTasks(page)).toHaveText([
      'record if there is reason to believe the prisoner may harm someone they share a cell with',
    ])
    await expect(page.getByText(/Stale .* detail/)).toHaveCount(0)
  })

  for (const reviewed of [true, false]) {
    test(`saves ${reviewed ? 'Yes' : 'No'}, preserves final answers, updates status and preselects the saved answer`, async ({
      page,
    }) => {
      const finalAnswers = completeAnswers({ stage: 'FINAL', version: 5 })
      const saved = { ...finalAnswers, provisionalReviewed: reviewed }
      await stubReviewSaves(assessment([provisionalAnswers, finalAnswers]), [saved])
      await page.reload()
      await expect(ratingTask(page)).toContainText('Cannot start yet')
      await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()
      await page.getByRole('radio', { name: reviewed ? YES : NO, exact: true }).check()
      await page.getByRole('button', { name: 'Save and return', exact: true }).click()

      await expect(page).toHaveURL(TASK_LIST_URL)
      await expect(reviewTask(page)).toContainText(reviewed ? 'Completed' : 'Incomplete')
      await expect(page.getByRole('link', { name: REVIEW_LINK, exact: true })).toHaveAttribute('href', REVIEW_URL)
      const requests = await savedRequests()
      expect(requests).toHaveLength(1)
      expect(JSON.parse(requests[0].body)).toEqual(saved)
      if (reviewed) {
        await expect(page.getByRole('link', { name: 'Check answers and confirm rating', exact: true })).toBeVisible()
        await page.getByRole('link', { name: 'Check answers and confirm rating', exact: true }).click()
        await expect(page).toHaveURL(`${TASK_LIST_URL}/check-answers`)
        await expect(page.getByRole('link', { name: 'Continue to rating', exact: true })).toBeVisible()
      } else {
        await expect(ratingTask(page)).toContainText('Cannot start yet')
        await expect(page.getByRole('link', { name: 'Check answers and confirm rating', exact: true })).toHaveCount(0)
        await page.goto(`${TASK_LIST_URL}/select-rating`)
        await expect(page).toHaveURL(TASK_LIST_URL)
      }
      await page.goto(REVIEW_URL)
      await expect(page.getByRole('radio', { name: reviewed ? YES : NO, exact: true })).toBeChecked()
      await expect(page.getByRole('radio', { name: reviewed ? NO : YES, exact: true })).not.toBeChecked()
      await expect(summarySection(page, 'Evidence sources').locator('.govuk-summary-list__value')).toHaveText([
        'Checked',
        'Checked',
        'Not checked',
        'Not checked',
      ])
    })
  }

  test('changing saved Yes to No makes the review incomplete and locks final rating again', async ({ page }) => {
    const initialFinal = completeAnswers({ stage: 'FINAL', provisionalReviewed: true, version: 5 })
    const savedNo = { ...initialFinal, provisionalReviewed: false }
    await stubReviewSaves(assessment([provisionalAnswers, initialFinal]), [savedNo, initialFinal])
    await page.reload()
    await expect(reviewTask(page)).toContainText('Completed')
    await expect(page.getByRole('link', { name: 'Check answers and confirm rating', exact: true })).toBeVisible()
    await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()
    await expect(page.getByRole('radio', { name: YES, exact: true })).toBeChecked()
    await page.getByRole('radio', { name: NO, exact: true }).check()
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    await expect(reviewTask(page)).toContainText('Incomplete')
    await expect(ratingTask(page)).toContainText('Cannot start yet')
    await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()
    await expect(page.getByRole('radio', { name: NO, exact: true })).toBeChecked()
    await page.getByRole('radio', { name: YES, exact: true }).check()
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()
    await expect(page).toHaveURL(TASK_LIST_URL)
    await expect(reviewTask(page)).toContainText('Completed')
    await expect(page.getByRole('link', { name: 'Check answers and confirm rating', exact: true })).toBeVisible()
    const requests = await savedRequests()
    expect(requests).toHaveLength(2)
    expect(requests.map(request => JSON.parse(request.body))).toEqual([savedNo, initialFinal])
  })

  test('saving the review first creates the final stage without completing evidence and offences', async ({ page }) => {
    const initial = assessment([completeAnswers()])
    const saved = completeAnswers({
      stage: 'FINAL',
      provisionalReviewed: true,
      dpsChecked: null,
      perChecked: null,
      warrantChecked: null,
      pncChecked: null,
      offenceMurderManslaughter: null,
      offenceAssistingSuicide: null,
      offenceSexualAssault: null,
      offenceRepeatedViolence: null,
      offencePrejudiceMotivated: null,
      offenceArson: null,
      offenceKidnapHostage: null,
    })
    await stubReviewSaves(initial, [saved])
    await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()
    await page.getByRole('radio', { name: YES, exact: true }).check()
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()

    await expect(page).toHaveURL(TASK_LIST_URL)
    await expect(reviewTask(page)).toContainText('Completed')
    await expect(
      page.locator('.govuk-task-list__item').filter({ hasText: 'Evidence sources and offences' }),
    ).toContainText('Incomplete')
    await expect(ratingTask(page)).toContainText('Cannot start yet')
    const requests = await savedRequests()
    expect(requests).toHaveLength(1)
    expect(JSON.parse(requests[0].body)).toEqual(saved)
  })

  test('shows the validation error and does not save when neither radio is selected', async ({ page }) => {
    await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()
    await page.getByRole('button', { name: 'Save and return', exact: true }).click()

    await expect(page).toHaveURL(REVIEW_URL)
    await expect(page).toHaveTitle(/^Error:/)
    await expect(page.locator('.govuk-error-summary')).toContainText('There is a problem')
    await expect(page.locator('#provisionalReviewed-error')).toContainText(
      'Select yes if you have reviewed the provisional assessment',
    )
    await page
      .locator('.govuk-error-summary')
      .getByRole('link', {
        name: 'Select yes if you have reviewed the provisional assessment',
      })
      .click()
    await expect(page.getByRole('radio', { name: YES, exact: true })).toBeFocused()
    expect(await savedRequests()).toHaveLength(0)
    await page.getByRole('link', { name: 'Back', exact: true }).click()
    await expect(reviewTask(page)).toContainText('Not yet started')
  })

  for (const link of ['Back', 'Cancel']) {
    test(`${link} discards unsaved changes and leaves the saved review status unchanged`, async ({ page }) => {
      const finalAnswers = completeAnswers({ stage: 'FINAL', provisionalReviewed: true })
      await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID, assessment([provisionalAnswers, finalAnswers]))
      await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()
      await expect(page.getByRole('radio', { name: YES, exact: true })).toBeChecked()
      await page.getByRole('radio', { name: NO, exact: true }).check()
      await expect(page.getByRole('link', { name: link, exact: true })).toHaveAttribute('href', TASK_LIST_URL)
      await page.getByRole('link', { name: link, exact: true }).click()

      await expect(page).toHaveURL(TASK_LIST_URL)
      await expect(reviewTask(page)).toContainText('Completed')
      expect(await savedRequests()).toHaveLength(0)
      await page.getByRole('link', { name: REVIEW_LINK, exact: true }).click()
      await expect(page.getByRole('radio', { name: YES, exact: true })).toBeChecked()
    })
  }

  test('does not show the review task or permit direct access before a provisional rating is entered', async ({
    page,
  }) => {
    await csraApi.stubGetAssessment('A1234BC', ASSESSMENT_ID, { ...assessment(), interimResult: undefined })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Provisional assessment', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: REVIEW_LINK, exact: true })).toHaveCount(0)
    const response = await page.goto(REVIEW_URL)
    expect(response?.status()).toBe(404)
    expect(await savedRequests()).toHaveLength(0)
  })
})

test('Review provisional assessment requires the CSRA Assessor role', async ({ page }) => {
  await login(page, {
    roles: ['ROLE_CSRA__REVIEW_EDIT'],
    activeCaseLoad: { caseLoadId: 'MDI', description: 'Moorland (HMP)' },
  })
  await stubPrisoner()
  await page.goto(REVIEW_URL)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in')
  await expect(page.getByRole('radio', { name: YES, exact: true })).toHaveCount(0)
  expect(await savedRequests()).toHaveLength(0)
})
