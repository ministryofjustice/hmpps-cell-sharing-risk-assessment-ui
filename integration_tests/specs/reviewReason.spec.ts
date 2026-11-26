import { expect, test, type Page } from '@playwright/test'
import type { CsraDetailedRating } from '../../server/data/csraApiTypes'
import csraApi from '../mockApis/csraApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import prisonApi from '../mockApis/prisonApi'
import manageUsersApi from '../mockApis/manageUsersApi'
import { getMatchingRequests } from '../mockApis/wiremock'
import { login, resetStubs } from '../testUtils'

const prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  dateOfBirth: '1972-02-03',
  prisonId: 'MDI',
  prisonName: 'Moorland (HMP)',
  cellLocation: 'A-1-001',
}
const overviewUrl = `/prisoner/${prisoner.prisonerNumber}`
const reviewUrl = `${overviewUrl}/review`
const reviewApiUrl = `/csra-api/csra-review/prisoner/${prisoner.prisonerNumber}/review`

const reasons = [
  {
    value: 'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
    text: 'Scheduled long term high risk review',
    hint: 'A routine review for high risk prisoners, carried out at least once a year as part of offender management.',
    destination: 'scheduled-review',
  },
  {
    value: 'SHORT_TERM_HIGH_RISK_REVIEW',
    text: 'Short term high risk review',
    hint: 'The person was given a high risk rating due to temporary circumstances, for example due to drug or alcohol withdrawal.',
    destination: 'short-term-review',
  },
  {
    value: 'NEW_OR_ADDITIONAL_INFORMATION',
    text: 'New or additional information',
    hint: 'New information has been identified (for example, PNC, warrant or case notes) that may affect the prisoner’s risk rating.',
    destination: 'multidisciplinary-team-review',
  },
  {
    value: 'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING',
    text: 'Recent change in behaviour or thinking',
    hint: 'You or others have observed changes that may affect the prisoner’s risk rating (for example, talking to themselves or expressing violent thoughts).',
    destination: 'multidisciplinary-team-review',
  },
]

async function setup(page: Page, rating: Partial<CsraDetailedRating>, roles = ['ROLE_CSRA__REVIEW_EDIT']) {
  await login(page, {
    roles,
    activeCaseLoad: { caseLoadId: prisoner.prisonId, description: prisoner.prisonName },
  })
  await Promise.all([
    csraApi.stubGetInfo(['MDI']),
    prisonerSearchApi.stubGetPrisoner(prisoner),
    prisonApi.stubGetPrisonerImage(prisoner.prisonerNumber),
    manageUsersApi.stubGetUserCaseloads(['MDI']),
    csraApi.stubGetCurrentRating(prisoner.prisonerNumber, rating),
  ])
  await page.goto(overviewUrl)
}

async function assertNoReviewSaved() {
  const creation = await getMatchingRequests({ method: 'POST', url: reviewApiUrl })
  const updates = await getMatchingRequests({ method: 'PUT', urlPathPattern: `${reviewApiUrl}/.*` })
  expect(creation.body.requests).toHaveLength(0)
  expect(updates.body.requests).toHaveLength(0)
}

test.describe('Review reason', () => {
  test.afterEach(async () => {
    await resetStubs()
  })

  const ratingCases: { description: string; rating: Partial<CsraDetailedRating>; expected: number[] }[] = [
    { description: 'standard', rating: { finalRating: 'STANDARD' }, expected: [2, 3] },
    { description: 'high general', rating: { finalRating: 'HIGH_GENERAL' }, expected: [0, 1] },
    { description: 'high specific', rating: { finalRating: 'HIGH_SPECIFIC' }, expected: [0, 1, 2, 3] },
    {
      description: 'inherited provisional',
      rating: {
        status: 'PROVISIONAL',
        provisionalRating: 'STANDARD',
        assessmentType: 'ASSESSMENT',
        ratingStage: 'PROVISIONAL',
        inheritedAfterTransfer: true,
      },
      expected: [0, 1, 2, 3],
    },
    {
      description: 'inherited interim',
      rating: {
        status: 'PROVISIONAL',
        provisionalRating: 'HIGH_GENERAL',
        assessmentType: 'REVIEW',
        ratingStage: 'INTERIM',
        inheritedAfterTransfer: true,
      },
      expected: [0, 1, 2, 3],
    },
    { description: 'legacy high (assumed)', rating: { type: 'FULL', finalRating: 'HIGH' }, expected: [0, 1, 2, 3] },
    { description: 'legacy standard (assumed)', rating: { type: 'FULL', finalRating: 'STANDARD' }, expected: [2, 3] },
  ]

  for (const { description, rating, expected } of ratingCases) {
    test(`shows the correct reasons and hints for ${description}`, async ({ page }) => {
      await setup(page, rating)
      await page.getByRole('link', { name: 'Start review', exact: true }).click()
      await expect(page).toHaveURL(`${reviewUrl}/reason`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('What is the reason for the review?')
      await expect(page.getByText('Choose the reason for reviewing the prisoner’s cell sharing risk.')).toBeVisible()
      await expect(page.locator('input[name="reviewReason"]')).toHaveCount(expected.length)
      const optionValues = await page
        .locator('input[name="reviewReason"]')
        .evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))
      expect(optionValues).toEqual(expected.map(index => reasons[index].value))
      await Promise.all(
        reasons.map(async (reason, index) => {
          const radio = page.getByRole('radio', { name: reason.text, exact: true })
          if (expected.includes(index)) {
            await expect(radio).toBeVisible()
            await expect(page.getByText(reason.hint, { exact: true })).toBeVisible()
          } else {
            await expect(radio).toHaveCount(0)
            await expect(page.getByText(reason.hint, { exact: true })).toHaveCount(0)
          }
        }),
      )
      await assertNoReviewSaved()
    })
  }

  test('denies access to a user without the reviewer role', async ({ page }) => {
    await setup(page, { finalRating: 'HIGH_SPECIFIC' }, ['ROLE_CSRA__ASSESSMENT_EDIT'])
    await expect(page.getByRole('link', { name: 'Start review', exact: true })).toHaveCount(0)
    await page.goto(`${reviewUrl}/reason`)
    await expect(page).toHaveURL(/\/auth\/sign-out/)
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
    await assertNoReviewSaved()
  })

  test('shows the validation error without creating a review', async ({ page }) => {
    await setup(page, { finalRating: 'HIGH_SPECIFIC' })
    await page.getByRole('link', { name: 'Start review', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.locator('.govuk-error-summary')).toContainText('Select the reason for review')
    await expect(page.locator('#reviewReason-error')).toContainText('Select the reason for review')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What is the reason for the review?')
    await assertNoReviewSaved()
  })

  for (const reason of reasons) {
    test(`continues from ${reason.text} without saving a review`, async ({ page }) => {
      await setup(page, { finalRating: 'HIGH_SPECIFIC' })
      await page.getByRole('link', { name: 'Start review', exact: true }).click()
      await page.getByRole('radio', { name: reason.text, exact: true }).check()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page).toHaveURL(`${reviewUrl}/${reason.destination}`)
      await expect(
        page.getByText('The questions for this review are not yet available.', { exact: false }),
      ).toBeVisible()
      await expect(page.getByText('No review has been started.', { exact: false })).toBeVisible()
      await assertNoReviewSaved()
      await page.getByRole('link', { name: 'Cancel', exact: true }).click()
      await expect(page).toHaveURL(overviewUrl)
      await expect(page.getByRole('link', { name: 'Start review', exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Continue review', exact: true })).toHaveCount(0)
      await assertNoReviewSaved()
    })
  }

  for (const link of ['Back', 'Cancel']) {
    test(`${link} from the reason page returns to the unchanged overview`, async ({ page }) => {
      await setup(page, { finalRating: 'HIGH_SPECIFIC' })
      await page.getByRole('link', { name: 'Start review', exact: true }).click()
      await page.getByRole('radio', { name: reasons[0].text, exact: true }).check()
      await page.getByRole('link', { name: link, exact: true }).click()
      await expect(page).toHaveURL(overviewUrl)
      await expect(page.getByRole('link', { name: 'Start review', exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Continue review', exact: true })).toHaveCount(0)
      await assertNoReviewSaved()
    })
  }
})
